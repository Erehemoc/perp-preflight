// perp-preflight: check a dreamDEX perp order BEFORE you sign it. Read-only:
// no private key is read and no transaction is sent.
//
//   npm run preflight -- scan
//   npm run preflight -- check SOL long 100.5 0.25 [--account 0x...]
//
import { isAddress } from "viem";
import { SOMNIA_HIDEKI_TESTNET_ADDRESSES, SomniaMarkets } from "@somnia-chain/markets-sdk";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";
import { fundingViews, planOrder, suspectScale, toHuman, toRaw, type Side } from "./grid.js";

const INDEXER = process.env.INDEXER_URL ?? "https://hideki-dev.smk.somnia.host/v1/graphql";

function connect(): SomniaMarkets {
  return new SomniaMarkets({ chain: hidekiTestnet, indexerUrl: INDEXER, addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES } as never);
}

const fmt = (v: number) => (Math.abs(v) >= 1 ? v.toFixed(2) : v.toPrecision(4));
const pct = (x: number, d = 4) => `${(x * 100).toFixed(d)}%`;

async function markets(m: SomniaMarkets) {
  const list = await m.client.listPerpMarkets();
  return list.map((p: any) => ({ p, sym: String(p.baseSymbol ?? p.poolAddress) }));
}

async function scan(m: SomniaMarkets) {
  const rows = [];
  for (const { p, sym } of await markets(m)) {
    try {
      const s: any = await m.client.getPerpState(p.poolAddress);
      const f = fundingViews(s.fundingRate, s.fundingWindowSec);
      const mark = Number(toHuman(s.markPrice, p.quoteDecimals));
      const index = Number(toHuman(s.indexPrice, p.quoteDecimals));
      const ageSec = Math.round(Date.now() / 1000 - Number(s.indexUpdatedAt));
      rows.push({ sym, mark, gap: index ? (mark - index) / index : 0, perHour: f.perHour, apr: f.apr, ok: s.markPriceOk, ageSec, im: p.initialMarginBps });
    } catch (e) {
      rows.push({ sym, error: (e as Error).message.split("\n")[0] });
    }
  }
  rows.sort((a: any, b: any) => Math.abs(b.apr ?? 0) - Math.abs(a.apr ?? 0));
  console.log("market         mark          mark-index   funding/h    funding APR  pays    oracle age  max lev");
  for (const r of rows as any[]) {
    if (r.error) { console.log(`${r.sym.padEnd(12)} unreadable: ${r.error}`); continue; }
    console.log(
      `${(r.sym + "-PERP").padEnd(14)} ${fmt(r.mark).padEnd(13)} ${pct(r.gap, 3).padStart(10)}  ${pct(r.perHour).padStart(10)}  ${pct(r.apr, 2).padStart(11)}  ${(r.apr >= 0 ? "shorts" : "longs").padEnd(7)} ${(r.ok ? r.ageSec + "s" : "STALE").padStart(10)}  ${Math.round(10_000 / r.im)}x`,
    );
  }
}

async function caps(m: SomniaMarkets) {
  console.log("market         max lev  OI cap (base)        position cap (base)   OI/position");
  for (const { p, sym } of await markets(m)) {
    const rp: any = await m.client.getPerpRiskParams(p.poolAddress);
    const oi = BigInt(rp.maxOpenInterest), pos = BigInt(rp.maxPositionSize);
    const ratio = pos > 0n ? Number((oi * 100n) / pos) / 100 : 0;
    console.log(`${(sym + "-PERP").padEnd(14)} ${String(Math.round(10_000 / p.initialMarginBps) + "x").padEnd(8)} ${toHuman(oi, p.baseDecimals).padEnd(20)} ${toHuman(pos, p.baseDecimals).padEnd(21)} ${ratio}`);
  }
}

async function check(m: SomniaMarkets, sym: string, side: Side, price: string, size: string, account?: string) {
  const found = (await markets(m)).find((x) => x.sym.toUpperCase() === sym.toUpperCase());
  if (!found) throw new Error(`no perp market for ${sym}`);
  const p: any = found.p;
  const s: any = await m.client.getPerpState(p.poolAddress);
  const grid = { tickSize: BigInt(p.tickSize), lotSize: BigInt(p.lotSize), minQuantity: BigInt(p.minQuantity), baseDecimals: p.baseDecimals, quoteDecimals: p.quoteDecimals };
  const plan = planOrder(grid, side, price, size, { mark: s.markPriceOk ? s.markPrice : undefined, initialMarginBps: p.initialMarginBps });
  if (!s.markPriceOk) plan.findings.unshift({ level: "block", code: "MARK_STALE", message: "mark feed is not live: the SDK cannot size an order against it" });
  const scale = suspectScale(plan.quantity, p.baseDecimals, s.markPrice, p.quoteDecimals);
  if (scale !== null) plan.findings.push({ level: "block", code: "SCALE", message: `size is implausibly large for ${found.sym} (${p.baseDecimals} base decimals)${scale > 0 ? `; it looks written with ${scale} decimals` : ""}` });

  console.log(`\n${found.sym}-PERP ${side.toUpperCase()}  (pool ${p.poolAddress}, base decimals ${p.baseDecimals})`);
  console.log(`price    : ${toHuman(plan.price, p.quoteDecimals)} USDso   raw ${plan.price}`);
  console.log(`size     : ${toHuman(plan.quantity, p.baseDecimals)} ${found.sym}   raw ${plan.quantity}`);
  console.log(`notional : ${toHuman(plan.notional, p.quoteDecimals)} USDso`);
  console.log(`init mgn : ${toHuman(plan.initialMargin, p.quoteDecimals)} USDso at ${p.initialMarginBps / 100}% (max ${Math.round(10_000 / p.initialMarginBps)}x)`);
  console.log(`mark     : ${s.markPriceOk ? toHuman(s.markPrice, p.quoteDecimals) : "stale"}`);

  if (account) {
    if (!isAddress(account)) throw new Error(`not an address: ${account}`);
    const acct = account as `0x${string}`;
    const max: any = await m.client.getMaxPerpOrderSize({ pool: p.poolAddress, marginBank: p.marginBank, account: acct, isBid: side === "long", price: plan.price });
    if (!max.priceable) {
      plan.findings.push({ level: "block", code: "NOT_PRICEABLE", message: "getMaxPerpOrderSize: mark not priceable at this block" });
    } else {
      const fits = max.placeable && plan.quantity <= max.maxQuantity;
      plan.findings.push({
        level: fits ? "ok" : "block",
        code: fits ? "FITS_ACCOUNT" : "ACCOUNT_LIMIT",
        message: `account max at this price is ${toHuman(max.maxQuantity, p.baseDecimals)} ${found.sym}${max.limitedBy ? `, limited by ${max.limitedBy}` : ""} (block ${max.asOfBlock})`,
      });
      if (max.limitedBy === "voucherBlocked") plan.findings.push({ level: "block", code: "VOUCHER", message: "paper-USDso credit is not allowed on this market; pick one on the allowlist" });
    }
    const v: any = await m.client.getPerpVoucherEligibility(p.marginBank, acct);
    plan.findings.push(v.eligible
      ? { level: "ok", code: "VOUCHER_CLAIMABLE", message: `this account can still claim ${toHuman(v.grantAmount, p.quoteDecimals)} paper USDso (trader.claimPerpVoucher); check the market is on the credit's allowlist first` }
      : { level: "ok", code: "VOUCHER_STATE", message: `paper USDso claim: ${v.reason}` });
  }

  console.log("\nchecks");
  for (const f of plan.findings) console.log(`  ${f.level === "block" ? "✗" : f.level === "warn" ? "!" : "✓"} ${f.code.padEnd(17)} ${f.message}`);
  const blocked = plan.findings.some((f) => f.level === "block");
  console.log(`\n${blocked ? "DO NOT SEND: fix the ✗ items first." : "Ready: this order passes every read-only check."}`);
  return blocked ? 1 : 0;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const m = connect();
  let code = 0;
  try {
    if (cmd === "scan") await scan(m);
    else if (cmd === "caps") await caps(m);
    else if (cmd === "check") {
      const ai = rest.indexOf("--account");
      const account = ai >= 0 ? rest[ai + 1] : undefined;
      const [sym, side, price, size] = rest.filter((_, i) => ai < 0 || (i !== ai && i !== ai + 1));
      if (!sym || (side !== "long" && side !== "short") || !price || !size) throw new Error("usage: check <SYMBOL> <long|short> <price> <size> [--account 0x...]");
      code = await check(m, sym, side, price, size, account);
    } else {
      console.log("usage:\n  perp-preflight scan\n  perp-preflight caps\n  perp-preflight check <SYMBOL> <long|short> <price> <size> [--account 0x...]");
    }
  } finally {
    await (m as any).close?.();
  }
  process.exit(code);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(2); });
