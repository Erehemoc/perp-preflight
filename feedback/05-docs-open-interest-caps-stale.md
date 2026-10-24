# Docs "Perps on Testnet" market table shows open-interest caps that no longer match the chain (1/4 of live on most markets)

Severity: normal
Area: docs

## Steps to reproduce
1. Open app.testnet.dreamdex.io/docs/trading/perps-testnet → Markets table, column "Open interest cap". The page says "These figures are read from the live markets".
2. On Hideki testnet, read `client.getPerpRiskParams(pool).maxOpenInterest` for every market from `client.listPerpMarkets()` (markets-sdk 0.32.1) and divide by `10^baseDecimals`.

## Expected
The table matches the live cap.

## Actual (2026-10-24)
| Market | Docs | Live | Live / docs |
|---|---|---|---|
| BTC-PERP | 246.81545 | 493.6309 | 2x |
| ETH-PERP | 3,995.6125 | 7,991.225 | 2x |
| SOL-PERP | 47,654.44 | 95,308.88 | 2x |
| HYPE-PERP | 23,812.72 | 47,625.44 | 2x |
| ZEC-PERP | 420 | 1,680 | 4x |
| XRP-PERP | 344,632 | 1,378,528 | 4x |
| (ADA, AVAX, BNB, DOGE, LINK, NEAR, SUI, XLM, 1000PEPE, LIT, PUMP, VVV, WLD, ZRO) | … | … | 4x |
| TAO-PERP | 2,185.491 | 2,185.491 | 1x |

19 of 21 rows understate the cap by 2x or 4x. Only TAO matches.

## Evidence
`npm run preflight -- caps` in this repo prints `maxOpenInterest` and `maxPositionSize` per pool from `getPerpRiskParams`.

## Environment
@somnia-chain/markets-sdk 0.32.1, Hideki testnet (chain 50383), read-only
