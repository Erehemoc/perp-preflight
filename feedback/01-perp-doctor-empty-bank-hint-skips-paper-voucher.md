# perp:doctor tells a new key to "approve the MarginBank and deposit collateral" but never mentions the free paper-USDso voucher

Severity: normal
Area: SDK

## Steps to reproduce
1. In dreamdex-bot-kit (main, Oct 24 2026), `npm install`.
2. Create a fresh EOA and run `NETWORK=hideki PRIVATE_KEY=<new key> npm run perp:doctor` (no OWNER_ADDRESS).

## Expected
A brand-new key holds no USDso, so the hint should point to the documented free path: `client.getPerpVoucherEligibility(marginBank, account)` → `trader.claimPerpVoucher({ marginBank })` (docs: Perps on Testnet for Developers → "Paper USDso"), or show whether the key is eligible.

## Actual
```
wallet USDso : 0.0000 (in-wallet, not margin)
margin   : unlocked 0.00 · locked 0.00 · equity 0.00 · withdrawable 0.00 · status Healthy · health ∞ (no position)
           ^ empty bank: approve the MarginBank and deposit collateral before trading.
```
The key has no USDso to approve or deposit, and the doctor does not check or mention voucher eligibility (scripts/perp-doctor.ts lines 102–103).

## Evidence
Output above; scripts/perp-doctor.ts L102–103.

## Environment
dreamdex-bot-kit main @ 2026-10-24, @somnia-chain/markets-sdk 0.31.0 (perp-core), Hideki testnet (chain 50383), wallet 0x952b1a6578d37f8Ea9b85666934892AfbE40Ce74
