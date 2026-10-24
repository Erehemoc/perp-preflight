# perp-preflight

A read-only checker for **dreamDEX perps on Somnia testnet (Hideki, chain 50383)**, built on [`@somnia-chain/markets-sdk`](https://www.npmjs.com/package/@somnia-chain/markets-sdk) 0.32.1.

A bad perp order usually fails on chain with an error that doesn't explain the mistake. Writing 0.1 SOL with 18 decimals asks for 100,000,000 SOL and reverts `InsufficientCollateral()`. A price off the tick or a size under `minQuantity` reverts too. `perp-preflight` catches these before you sign:

- **Grid.** Snaps the price to the market's `tickSize`, without ever making the order more aggressive (longs round down, shorts round up). Rounds the size down to `lotSize` and blocks anything below `minQuantity`.
- **Decimals.** Uses each market's own `baseDecimals` (6 to 24). It also flags a raw size that only makes sense at a different scale.
- **Mark.** Refuses to size against a stale mark feed. Warns when a limit price is far from the mark on the crossing side, since that order fills at once as a taker.
- **Account (optional `--account`).** Calls `getMaxPerpOrderSize` and reports which limit binds: collateral, initial margin, position cap, voucher block or wallet. It also calls `getPerpVoucherEligibility` to show whether the 1,000 paper USDso credit can still be claimed.
- **Funding scan.** Lists every market with its mark vs index gap, funding per hour **and** APR (normalised by each pool's `fundingWindowSec`, never a constant), which side pays, the oracle's age and max leverage.

It never reads a private key and never sends a transaction.

## Run

```bash
npm install
npm run preflight -- scan
npm run preflight -- caps     # open-interest and per-account position caps per market
npm run preflight -- check SOL long 100.555 0.255 --account 0xYourAddress
npm test   # pure grid / decimals / funding maths
```

The exit code is `0` when the order passes, `1` when any check blocks it and `2` on errors, so the tool can gate a bot's send step.

## Example (live testnet, 2026-10-24)

```
$ npm run preflight -- scan
market         mark          mark-index   funding/h    funding APR  pays    oracle age  max lev
BTC-PERP       80182.31         -0.045%     0.0135%      118.38%  shorts          1s  20x
SOL-PERP       100.58           -0.070%     0.0054%       47.45%  shorts          1s  20x
BNB-PERP       725.36           -0.020%     0.0029%       25.48%  shorts          1s  10x
ZRO-PERP       1.74              0.065%     0.0013%       10.95%  shorts          1s  5x
LIT-PERP       3.15             -0.110%     0.0013%       10.95%  shorts          2s  5x
VVV-PERP       23.90            -0.001%     0.0013%       10.95%  shorts          1s  5x
1000PEPE-PERP  0.004391         -0.080%     0.0013%       10.95%  shorts          2s  5x
...

$ npm run preflight -- check SOL long 100.555 0.255 --account 0x952b…Ce74

SOL-PERP LONG  (pool 0xb483ec1fb34996638677c20ab087b16f1896fa53, base decimals 9)
price    : 100.55 USDso   raw 100550000000000000000
size     : 0.25 SOL   raw 250000000
notional : 25.1375 USDso
init mgn : 1.256875 USDso at 5% (max 20x)
mark     : 100.5643007520145

checks
  ! PRICE_SNAPPED     price 100.555 is off the 0.01 tick; snapped to 100.55
  ! QTY_SNAPPED       size 0.255 is off the 0.01 lot; rounded down to 0.25
  ✓ GRID_OK           price and size sit on the market grid
  ✗ ACCOUNT_LIMIT     account max at this price is 0 SOL, limited by collateral (block 32140725)
  ✓ VOUCHER_CLAIMABLE this account can still claim 1000 paper USDso (trader.claimPerpVoucher); check the market is on the credit's allowlist first

DO NOT SEND: fix the ✗ items first.
```

The account in the example is a fresh, empty testnet key, so it can't place anything yet (`limited by collateral`). The tool also points it to the paper-USDso claim.

## SDK calls used

`listPerpMarkets`, `getPerpState` (mark, index, funding window), `getPerpRiskParams` (caps), `getMaxPerpOrderSize`, `getPerpVoucherEligibility`. The order maths in `src/grid.ts` is pure and unit-tested.

## Feedback

Issues found while building this are in [`feedback/`](feedback), one file per issue, in the bounty's format.

## Notes

- Testnet only. Paper USDso is not real money, and nothing here is trading advice.
- Built with AI assistance (Claude). MIT licensed.
