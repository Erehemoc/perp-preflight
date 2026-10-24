// Pure order-grid maths for dreamDEX perps. No network, no SDK: everything here is
// unit-tested, because a wrong scale does not fail loudly on chain
// (0.1 SOL written with 18 decimals is 100,000,000 SOL and reverts InsufficientCollateral).

export interface Grid {
  tickSize: bigint; // raw quote units per whole base
  lotSize: bigint; // raw base units
  minQuantity: bigint; // raw base units
  baseDecimals: number;
  quoteDecimals: number;
}

export type Side = "long" | "short";

/** Parse a human decimal string into raw units, rejecting extra precision. */
export function toRaw(human: string, decimals: number): bigint {
  const s = human.trim();
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error(`not a positive decimal: "${human}"`);
  const [int, frac = ""] = s.split(".");
  if (frac.length > decimals) {
    throw new Error(`"${human}" has ${frac.length} decimals; this token has ${decimals}`);
  }
  return BigInt(int) * 10n ** BigInt(decimals) + BigInt((frac + "0".repeat(decimals)).slice(0, decimals) || "0");
}

/** Raw units back to a trimmed human string. */
export function toHuman(raw: bigint, decimals: number): string {
  const neg = raw < 0n;
  const v = neg ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const int = v / base;
  const frac = (v % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return (neg ? "-" : "") + int.toString() + (frac ? "." + frac : "");
}

/**
 * Snap a price to the tick grid on the side that does not cross further:
 * a long (bid) rounds DOWN, a short (ask) rounds UP, so snapping never makes the
 * order more aggressive than the trader asked for.
 */
export function snapPrice(price: bigint, tick: bigint, side: Side): bigint {
  if (tick <= 0n) throw new Error("tickSize must be positive");
  const r = price % tick;
  if (r === 0n) return price;
  return side === "long" ? price - r : price - r + tick;
}

/** Quantities always round DOWN to the lot grid (never size up silently). */
export function snapQuantity(qty: bigint, lot: bigint): bigint {
  if (lot <= 0n) throw new Error("lotSize must be positive");
  return qty - (qty % lot);
}

export interface Finding {
  level: "ok" | "warn" | "block";
  code: string;
  message: string;
}

export interface Plan {
  price: bigint;
  quantity: bigint;
  notional: bigint; // raw quote units
  initialMargin: bigint; // raw quote units at the market's initialMarginBps
  findings: Finding[];
}

/** Check one order against the market grid. Pure: the caller supplies the mark. */
export function planOrder(
  g: Grid,
  side: Side,
  priceHuman: string,
  qtyHuman: string,
  opts: { mark?: bigint; initialMarginBps: number; maxDeviationBps?: number },
): Plan {
  const findings: Finding[] = [];
  const rawPrice = toRaw(priceHuman, g.quoteDecimals);
  const rawQty = toRaw(qtyHuman, g.baseDecimals);
  const price = snapPrice(rawPrice, g.tickSize, side);
  const quantity = snapQuantity(rawQty, g.lotSize);

  if (price !== rawPrice) {
    findings.push({ level: "warn", code: "PRICE_SNAPPED", message: `price ${priceHuman} is off the ${toHuman(g.tickSize, g.quoteDecimals)} tick; snapped to ${toHuman(price, g.quoteDecimals)}` });
  }
  if (quantity !== rawQty) {
    findings.push({ level: "warn", code: "QTY_SNAPPED", message: `size ${qtyHuman} is off the ${toHuman(g.lotSize, g.baseDecimals)} lot; rounded down to ${toHuman(quantity, g.baseDecimals)}` });
  }
  if (quantity < g.minQuantity) {
    findings.push({ level: "block", code: "BELOW_MIN", message: `size ${toHuman(quantity, g.baseDecimals)} is below the minimum ${toHuman(g.minQuantity, g.baseDecimals)}: the pool reverts it` });
  }
  if (opts.mark && opts.mark > 0n) {
    const dev = ((price - opts.mark) * 10_000n) / opts.mark;
    const lim = BigInt(opts.maxDeviationBps ?? 500);
    const crossing = side === "long" ? price > opts.mark : price < opts.mark;
    if ((dev < 0n ? -dev : dev) > lim) {
      findings.push({ level: "warn", code: "FAR_FROM_MARK", message: `price is ${Number(dev) / 100}% from mark ${toHuman(opts.mark, g.quoteDecimals)}${crossing ? " on the crossing side: it fills at once as a taker" : ""}` });
    }
  }
  // notional in quote units: price (quote per whole base) * qty (raw base) / 10^baseDecimals
  const notional = (price * quantity) / 10n ** BigInt(g.baseDecimals);
  const initialMargin = (notional * BigInt(opts.initialMarginBps)) / 10_000n;
  if (!findings.some((f) => f.level === "block")) {
    findings.push({ level: "ok", code: "GRID_OK", message: "price and size sit on the market grid" });
  }
  return { price, quantity, notional, initialMargin, findings };
}

/**
 * Catch the silent scale bug: a raw quantity that only makes sense if it was
 * written with 18 decimals for a base that has fewer (or the reverse).
 * Returns the decimals the caller probably used, or null when the value is plausible.
 */
export function suspectScale(rawQty: bigint, baseDecimals: number, mark: bigint, quoteDecimals: number, maxNotionalHuman = 10_000_000n): number | null {
  if (rawQty <= 0n || mark <= 0n) return null;
  const notional = (mark * rawQty) / 10n ** BigInt(baseDecimals) / 10n ** BigInt(quoteDecimals);
  if (notional <= maxNotionalHuman) return null;
  for (const d of [18, 24, 9, 8, 6]) {
    if (d === baseDecimals) continue;
    const alt = (mark * rawQty) / 10n ** BigInt(d) / 10n ** BigInt(quoteDecimals);
    if (alt > 0n && alt <= maxNotionalHuman) return d;
  }
  return -1;
}

/** Funding rate per window (1e18-scaled) to hourly and APR fractions. */
export function fundingViews(rate: bigint, windowSec: number): { perHour: number; apr: number } {
  const perWindow = Number(rate) / 1e18;
  const perHour = (perWindow * 3600) / windowSec;
  return { perHour, apr: perHour * 24 * 365 };
}
