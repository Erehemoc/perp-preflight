# `PerpMarket.baseSymbol` is documented as the wrapper symbol ("WBTC") but returns the plain symbol ("BTC")

Severity: normal
Area: SDK

## Steps to reproduce
1. `npm i @somnia-chain/markets-sdk@0.32.1`
2. Read the type comment in `dist/markets.d.ts` on `PerpMarket.baseSymbol`: "Synthetic-base symbol (e.g. "WBTC"); null when the wrapper exposes none."
3. Call `client.listPerpMarkets()` on Hideki testnet and print `baseSymbol` for each row.

## Expected
`WBTC`, `WETH`, … as documented, or a comment that matches what is returned.

## Actual
`BTC, ETH, SOL, WLD, …`. Code that follows the comment and strips a leading `W` turns `WLD` into `LD` (it happened in our tool before we checked).

## Evidence
`listPerpMarkets()` output on 2026-10-24: `ZRO, LIT, VVV, 1000PEPE, PUMP, ZEC, TAO, WLD, NEAR, XLM, AVAX, LINK, SUI, ADA, BNB, DOGE, XRP, HYPE, SOL, ETH, BTC`.

## Environment
@somnia-chain/markets-sdk 0.32.1, Hideki testnet (chain 50383), read-only client
