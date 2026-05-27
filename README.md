# CommitmentVault

Verifiable commitment enforcement system. If you don't meet your weekly goals, USDC moves to a burn/donation wallet. If you do, funds lock as rewards. The backend is the oracle — the smart contract only receives instructions from it.

## Architecture

```
Discriminador ──(metrics)──▶ Commitment Engine (Node/Express)
                                    │
                         ┌──────────┴──────────┐
                         │                     │
                    PostgreSQL           CommitmentVault.sol
                    (DB / state)         (Base / USDC custody)
                         │
                    React Dashboard
                    (served as static files)
```

**Separation of concerns:**
- Discriminador is the only source of truth for metrics. It knows nothing about crypto.
- The smart contract knows nothing about study goals or evaluation logic — it only executes instructions from the owner (backend).
- The backend is the oracle: it reads metrics, evaluates rules, and calls the contract.

## Stages

| Stage | Status | Description |
|-------|--------|-------------|
| 1 | ✅ | Commitment Engine — DB, rule evaluator, cron, DRY_RUN mode |
| 2 | ✅ | CommitmentVault.sol + Wallet Executor (ethers.js v6) |
| 3 | ✅ | React dashboard, single-service Render deploy |

---

## Local development

### Prerequisites
- Node.js 18+
- PostgreSQL

### Setup

```bash
# 1. Clone and install
git clone <repo>
cd commitment-engine
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — at minimum set DATABASE_URL and DISCRIMINADOR_BASE_URL

# 3. Run DB migrations
npm run migrate

# 4. Start the backend (port 3001)
npm run dev

# 5. In a second terminal — start the dashboard dev server (port 5173)
cd dashboard
npm install
npm run dev
# Dashboard proxies /api to localhost:3001 automatically
```

### Build the dashboard locally

```bash
npm run build
# Outputs to dashboard-dist/
# Then npm start serves the dashboard from Express on port 3001
```

---

## Smart contract

```bash
cd contracts
npm install

# Run tests (local Hardhat network)
npm test

# Deploy to Base Sepolia
npm run deploy:sepolia
# → prints COMMITMENT_VAULT_ADDRESS — add to .env

# Verify on Basescan
npx hardhat verify --network baseSepolia <address> <usdc_address>

# Deploy to mainnet (only after 2 weeks of validated Sepolia operation)
npm run deploy:mainnet
```

---

## Deploy to Render

### Service type
**Web Service** — single instance, Node.js runtime.

### Settings

| Field | Value |
|-------|-------|
| Build command | `npm run build` |
| Start command | `npm start` |
| Node version | 18 |

The build command runs `cd dashboard && npm install && npm run build` which outputs to `dashboard-dist/`. The Express server serves it as static files.

### Required environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (Render Postgres or external) |
| `DISCRIMINADOR_BASE_URL` | Base URL of the Discriminador API |
| `DISCRIMINADOR_API_KEY` | API key for Discriminador (if required) |
| `DRY_RUN` | `true` to log actions without executing. **Keep `true` for first 2 weeks.** |
| `CRON_SCHEDULE` | node-cron expression, default `0 8 * * *` (every day 08:00) |
| `CRON_TIMEZONE` | IANA timezone for the cron, default `UTC` (e.g. `America/Sao_Paulo`, `Europe/Madrid`) |
| `NODE_ENV` | `production` |
| `PORT` | Set by Render automatically |

### Stage 2 additional vars (after contract deploy)

| Variable | Description |
|----------|-------------|
| `COMMITMENT_VAULT_ADDRESS` | Deployed contract address |
| `EXECUTOR_PRIVATE_KEY` | Owner wallet private key — **use Render secrets, never commit** |
| `BASE_RPC_URL` | `https://mainnet.base.org` or `https://sepolia.base.org` |
| `USDC_ADDRESS` | USDC token address on the target network |
| `CHAIN_NAME` | `base` or `baseSepolia` — controls Basescan links in dashboard |
| `BASESCAN_API_KEY` | For contract verification only |

---

## Safety invariants

1. **`DRY_RUN=true` for at least 2 weeks** before enabling live transactions.
2. `EXECUTOR_PRIVATE_KEY` is never in source code — always in environment secrets.
3. The contract address and ABI are never sent to the frontend — balances are fetched via the backend `/api/vault/balance` endpoint.
4. `metric_snapshots` and `evaluations` are append-only — retroactive edits to Discriminador don't rewrite past decisions.
5. The smart contract has no knowledge of rules, metrics, or evaluation periods.

## Going to mainnet checklist

- [ ] 2+ weeks on Base Sepolia with `DRY_RUN=false`
- [ ] Every evaluation generates exactly one `wallet_action`
- [ ] All `tx_hash` values are visible and confirmed on Sepolia Basescan
- [ ] Internal `amount_usdc` ledger matches on-chain `availableBalance()`
- [ ] `EXECUTOR_PRIVATE_KEY` is rotated and stored only in Render secrets
- [ ] `DRY_RUN` env var removed (not just set to `false`) from production config
