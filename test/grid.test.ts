import { describe, expect, it } from "vitest";
import { fundingViews, planOrder, snapPrice, snapQuantity, suspectScale, toHuman, toRaw } from "../src/grid";

const SOL = { tickSize: 10n ** 16n, lotSize: 10n ** 7n, minQuantity: 10n ** 8n, baseDecimals: 9, quoteDecimals: 18 };

describe("units", () => {
  it("round-trips human and raw", () => {
    expect(toRaw("0.1", 9)).toBe(100_000_000n);
    expect(toHuman(100_000_000n, 9)).toBe("0.1");
    expect(toHuman(toRaw("100.57", 18), 18)).toBe("100.57");
  });
  it("rejects more decimals than the token has", () => {
    expect(() => toRaw("0.0000000001", 9)).toThrow(/10 decimals/);
  });
});

describe("snapping", () => {
  it("never makes an order more aggressive", () => {
    expect(snapPrice(105n, 10n, "long")).toBe(100n);
    expect(snapPrice(105n, 10n, "short")).toBe(110n);
    expect(snapPrice(100n, 10n, "long")).toBe(100n);
  });
  it("rounds size down to the lot", () => {
    expect(snapQuantity(19n, 10n)).toBe(10n);
  });
});

describe("planOrder", () => {
  it("blocks a size below the minimum", () => {
    const p = planOrder(SOL, "long", "100.5", "0.05", { initialMarginBps: 500 });
    expect(p.findings.map((f) => f.code)).toContain("BELOW_MIN");
  });
  it("computes notional and initial margin", () => {
    const p = planOrder(SOL, "long", "100", "1", { initialMarginBps: 500 });
    expect(toHuman(p.notional, 18)).toBe("100");
    expect(toHuman(p.initialMargin, 18)).toBe("5");
    expect(p.findings.at(-1)?.code).toBe("GRID_OK");
  });
  it("flags a crossing price far from mark", () => {
    const p = planOrder(SOL, "long", "120", "1", { initialMarginBps: 500, mark: toRaw("100", 18) });
    expect(p.findings.find((f) => f.code === "FAR_FROM_MARK")?.message).toMatch(/taker/);
  });
});

describe("suspectScale", () => {
  it("catches 0.1 SOL written with 18 decimals", () => {
    const wrong = toRaw("0.1", 18); // what the docs warn about
    expect(suspectScale(wrong, 9, toRaw("100", 18), 18)).toBe(18);
    expect(suspectScale(toRaw("0.1", 9), 9, toRaw("100", 18), 18)).toBeNull();
  });
});

describe("funding", () => {
  it("normalises by the pool window, not a constant", () => {
    const rate = 10n ** 14n; // 0.01% per 8h window
    const v = fundingViews(rate, 28_800);
    expect(v.apr).toBeCloseTo(0.1095, 4);
  });
});
