# Agent Instructions for Solana Concepts Sandbox

## Quick Commands

```bash
npm start              # Run server on localhost:3000 (requires funded payer wallet)
npm test               # Run all 708 tests (Jest, ~3 sec)
npm test:watch        # Watch mode for development
npm run db:fresh      # CAUTION - Reset DB: init + seed + migrate
npm run build         # Compile Tailwind CSS to assets/base.min.css
npm run docs:generate # Generate OpenAPI spec at docs/openapi.json
```

## Project Structure

**Single Node.js server** at `server.js` serving:
- Dashboard at `/`
- Concept UIs at `/<concept>.html` (e.g., `/pettracker`, `/carecircle`, `/healthcred`)
- REST API at `/api/v1/<concept>/...`
- Swagger UI at `/docs/v1`

**Database**:
- SQLite: `sandbox.db` (production) or `sandbox.test.db` (test mode auto-selected)
- Schema migrations tracked in `DBHEAD` file
- Initialize with: `npm run db:init && npm run db:seed && npm run db:migrate`

**Concepts** (each has separate HTML + API routes):
- **PetTracker**: Pet registry with SPL tokens
- **PetVax**: Vaccination proofs (vet attestations)
- **PetDiet**: Nutrition plans (vet attestations)
- **CareCircle**: Health credential sharing with authorized signers (SAS-based)
- **HealthCred**: Health credentials + badge minting
- **HCP Console**: Personal Health Agent creation with prompt attestation on Solana

## Test Mode Behavior

Tests run with `NODE_ENV=test` automatically via Jest config. Key differences:
- Uses `sandbox.test.db` instead of `sandbox.db`
- SAS operations skipped in test mode (no RPC calls)
- File uploads not persisted to disk
- `hasCredentialAccess()` returns true for all wallets

**708 tests expected to pass** (up from 700 after HCP Console implementation). 

## Solana & SAS Specifics

**Connection commitment level**: Must be `'confirmed'` not default `'finalized'`. Set in `healthcred.js:20` and required for HealthCred badge minting to avoid `TokenAccountNotFoundError`.

**BigInt serialization**: Logger handles BigInt values from Solana SDK. Custom JSON replacer in `api/logger.js:27-57` converts BigInt to strings (e.g., `"12345n"`).

**SAS credential derivation**: Uses payer as authority (backend controls). Derives unique account per credential using hash of credential ID. Without the credentialId param, all credentials collide to same account.

**Authorized signers storage**: Stored in `credential.data.authorizedSigners` array (base58 strings). Frontend displays these in UI after calling `/api/v1/carecircle/authorized-signers` endpoint.

## Configuration & Environment

**Required setup**:
1. Fund backend payer wallet (auto-generated at first `npm start`)
2. Copy address from logs
3. Fund on devnet: https://faucet.solana.com (need ~0.01 SOL minimum)

**.env example** (see `.env.example`):
```
SCS_BIND_HOST=localhost
SCS_BIND_PORT=3000
SCS_UPLOADS_PATH=uploads/
SCS_KEYPAIR_FILE=.payer-keypair.json
SCS_LOGS_FILE=sandbox.log
```

**Logging**: Uses Winston with size-based rotation. Active log is `sandbox.log`, archives rotate to `sandbox.log.YYYY-MM-DD` on size threshold. All API calls logged with context (wallet, credentialId, etc.).

## Common Pitfalls

1. **Forget credentialId param**: Results in shared SAS accounts → authorization always fails. Always pass third param to `ensureSasCredential()`.

2. **Wrong endpoint for credentials list**: Use `/authorized-credentials` (checks both owner + authorized signers), not `/credentials` (owner only).

3. **Authorization check failure**: Usually caused by pitfall #1 (querying wrong SAS account). Check logs for "Found X authorized signers" vs expected count.

4. **Payer wallet not funded**: RPC calls fail silently in test mode but fail loudly in production. Fund before testing.

5. **Missing credentialId in UI logic**: When displaying signers for authorized wallet, endpoint must pass correct credentialId to derive correct SAS account.

## Verification & Testing

**Before committing**:
```bash
npm test  # Must pass all 700 tests
```

**Common test patterns**:
- Mocks use `credential.authorizedSigners` (top-level)
- Real sas-lib returns `credential.data.authorizedSigners` (nested)
- Code handles both for backward compat

**Debugging**:
- Check `sandbox.log` for context about which wallet/credential/SAS account was queried
- Look for "Found N authorized signers" to verify correct SAS account was fetched
- Check "Wallet authorization check" log for failed auth attempts (shows what was compared)

## References

- `README.md` - Quick start and project overview
- `ARCHITECTURE.md` - Detailed concept definitions and API routes
- `TASKS.md` - Current session goals and progress
