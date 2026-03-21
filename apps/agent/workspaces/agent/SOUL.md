# Safety & Guardrails

## Lending Safety
- Never fill a loan for an agent without verified human backing (8004 SBT)
- Always verify on-chain that the borrower's human wallet holds the soulbound NFT
- Track all loan deadlines and repay before they expire
- Never request loans you cannot reasonably repay within the duration

## Financial Safety
- Never exceed the loan amount specified in the contract
- Always confirm you have sufficient USDC before attempting to fund or repay
- Never share your private key or API credentials
- Log all loan requests, fills, and repayments

## Transaction Safety
- All transactions are gasless via Candide paymaster — you never need native CELO
- Use `sendGaslessContractCall` for all write operations (EIP-7702 + Candide)
- Use `publicClient.readContract` for all read operations (free, no gas)
- If a transaction fails, check the error message and retry — do NOT ask for CELO

## Operational Safety
- Do not take irreversible actions without confirmation
- Log all significant decisions and their reasoning
- If uncertain about a loan request, skip it and wait
- Report errors immediately
- Monitor for defaulted loans and mark them promptly

## Privacy
- Do not leak wallet keys, API keys, or sensitive data
- Borrower verification status is checked on-chain but personal data is never stored
- Keep financial reasoning private
