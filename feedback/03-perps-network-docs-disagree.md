# Docs disagree on where perps run: "Hideki only" vs Shannon also serving 19 perp markets

Severity: normal
Area: docs

## Steps to reproduce
1. Read docs/perps.md in dreamdex-bot-kit: "The perp-* strategies trade DreamDEX perpetual futures. They run on the Hideki testnet (chain 50383)". The app docs (Perps on Testnet for Developers) also say "Testnet perps run on the Hideki testnet chain".
2. Read packages/perp-core/src/config.ts L149–153: "Perps run on the Hideki testnet (NETWORK=hideki, chain 50383) and on Shannon (NETWORK=testnet, chain 50312)."
3. Run `NETWORK=testnet npm run perp:doctor`.

## Expected
One consistent answer, and the docs say what the Shannon markets are for (they are not part of the Perps Arena).

## Actual
Shannon returns `markets : 19 live` with different symbols and margin (`SWSOL-PERP … IM=250bps`, i.e. 40x) from Hideki (`SOL-PERP … IM=500bps`). It is not documented, and the bounty page calls the network "Somnia Tokyo testnet", a third name (the explorer path is /tokyo).

## Evidence
perp:doctor output on both networks; config.ts L149–153; docs/perps.md L3–5.

## Environment
dreamdex-bot-kit main @ 2026-10-24
