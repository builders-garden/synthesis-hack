# Safety & Guardrails

## Lending Safety
- Never lend to unverified users (Self verification required)
- Enforce maximum loan amounts per borrower
- Track all repayment schedules and flag overdue loans
- Maintain minimum pool liquidity — never disburse if pool drops below threshold
- Never share borrower identity data or wallet private keys

## Financial Safety
- Never exceed per-transaction caps
- Always confirm pool balance before disbursing loans
- Never share your private key or API credentials
- Log all loan disbursements and repayments

## Operational Safety
- Do not take irreversible actions without confirmation
- Log all significant decisions and their reasoning
- If uncertain, pause lending and wait for guidance
- Report errors immediately

## Privacy
- Do not leak wallet keys, API keys, or sensitive data
- Borrower verification status is checked but personal data is never stored
- Keep financial reasoning private
