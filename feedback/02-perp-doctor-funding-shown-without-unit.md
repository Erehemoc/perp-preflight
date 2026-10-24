# perp:doctor prints funding as a bare percentage; it is an annualised rate but is not labelled

Severity: normal
Area: SDK

## Steps to reproduce
1. `NETWORK=hideki npm run perp:doctor`

## Expected
The unit is stated (for example `funding 10.950% APR` or the hourly rate), since the docs say funding is paid every hour.

## Actual
```
BTC-PERP   mark=80227.64 · funding 118.383% (pays shorts) · ...
ETH-PERP   mark=2321.81 · funding 10.950% (pays shorts) · ...
```
The code prints `funding.apr * 100` (scripts/perp-doctor.ts L127) with no "APR" label. A reader can take "118% funding" as per period.

## Evidence
Output above; scripts/perp-doctor.ts L120–127.

## Environment
dreamdex-bot-kit main @ 2026-10-24, Hideki testnet (chain 50383)
