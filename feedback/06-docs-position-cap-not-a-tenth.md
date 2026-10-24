# Docs say the per-account position cap is "a tenth of the market's open interest cap on most markets"; on chain it is a tenth on 1 of 21 markets

Severity: normal
Area: docs

## Steps to reproduce
1. Read app.testnet.dreamdex.io/docs/developers/perps-testnet → Common pitfalls: "Each account has a position cap per market, a tenth of the market's open interest cap on most markets."
2. For every Hideki perp market read `getPerpRiskParams(pool)` and compute `maxOpenInterest / maxPositionSize`.

## Expected
About 10 on most markets.

## Actual (2026-10-24)
- 1/40 on all 5x markets except TAO and ZEC (ZRO, LIT, VVV, 1000PEPE, PUMP, WLD)
- 1/20 on the 10x and 20x markets (NEAR, XLM, AVAX, LINK, SUI, ADA, BNB, DOGE, XRP, HYPE, SOL, ETH)
- 1/4 on ZEC-PERP, about 1/4.9 on BTC-PERP (maxPositionSize = 100 BTC)
- 1/10 only on TAO-PERP

A bot that sizes "max position = OI cap / 10" as the docs suggest overshoots the real cap by 2–4x on 18 markets and reverts `MaxPositionSizeExceeded()` (0x714b36d6). `getMaxPerpOrderSize().maxPositionSize` is the right source; the docs should say to read it and drop the "a tenth" rule.

## Evidence
`npm run preflight -- caps` in this repo (reads `getPerpRiskParams` per pool).

## Environment
@somnia-chain/markets-sdk 0.32.1, Hideki testnet (chain 50383), read-only
