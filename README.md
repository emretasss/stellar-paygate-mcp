# Stellar PayGate MCP



Stellar PayGate MCP is a pay-per-use marketplace for AI agents and MCP tools on Stellar. APIs can return a payment challenge, accept a Stellar Testnet USDC payment credential, run the requested AI tool, and write a hashed usage receipt to a Soroban registry contract. The project combines MPP-style paid APIs, a local MCP server, a React operator UI, and an auditable on-chain registry for tool listings, paid calls, and disputes.

## Vision

AI agents need a simple way to buy small digital services without subscriptions, card forms, or platform lock-in. Stellar PayGate MCP turns each tool call into a transparent micro-transaction: the agent pays in USDC, the API delivers the result, and Soroban records the proof. This model can help developers monetize data, risk engines, RWA analytics, and automation tools globally while keeping receipts portable and verifiable.

## Live Testnet Artifacts

- Contract ID: `CDDFVDZWZPDWE3RFB6XZCJ2RE6ZRQHXQRX5QB42GMNAIYBZY4UPLMXCQ`
- Paid-call transaction hash: [`4ac87c8d540dfe6a91d0aa0f1928a6d0b9d4203f379c6dcdd5d81645e92cdd72`](https://stellar.expert/explorer/testnet/tx/4ac87c8d540dfe6a91d0aa0f1928a6d0b9d4203f379c6dcdd5d81645e92cdd72)
- Contract init transaction hash: [`b5e0fff0f252a7618dc8b6f1af876ff9ac6e4fefa72cf7b10c56e6a0a09783c2`](https://stellar.expert/explorer/testnet/tx/b5e0fff0f252a7618dc8b6f1af876ff9ac6e4fefa72cf7b10c56e6a0a09783c2)
- Full deployment log: [docs/testnet-deployment.md](docs/testnet-deployment.md)
- Network passphrase: `Test SDF Network ; September 2015`
- Testnet USDC SAC: `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`

## Screenshots





## Architecture

- `contracts/paygate-registry`: Soroban contract for admin config, tool registration, paid-call receipts, provider stats, disputes, and event logs.
- `packages/paygate-registry-client`: generated TypeScript bindings for the Soroban registry contract.
- `packages/shared`: shared tool catalog, deterministic demo AI outputs, hashing helpers, Testnet USDC constants, and receipt types.
- `apps/api`: Express API with a `402 Payment Required` flow, MPP-ready payment gate, local demo payment mode, receipt storage, and optional contract invocation.
- `apps/api/src/mcp-stdio.ts`: MCP stdio server exposing the same paid tools to agent clients.
- `apps/web`: React + Vite dashboard with Freighter connection, marketplace, paid-call console, receipt explorer, and dispute panel.

## Smart Contract Functions

- `init(admin, token, gateway, fee_bps)`: stores registry configuration.
- `register_tool(provider, name, category, price, metadata_hash, bond_amount)`: creates a paid tool listing and optionally locks provider bond tokens.
- `set_tool_active(provider, tool_id, active)`: lets providers enable or disable their listings.
- `record_call(gateway, tool_id, payer, amount, payment_tx_hash, request_hash, response_hash)`: stores a paid-call receipt.
- `open_dispute(payer, call_id, reason_hash)`: marks a paid call as disputed.
- `resolve_dispute(admin, call_id, refund_amount)`: resolves a dispute and can refund from locked funds.
- `get_config`, `get_tool`, `get_call`, `provider_stats`: read contract state.

## Installation

Requirements:

- Node.js 20+
- pnpm 10+
- Rust with `wasm32v1-none`
- Stellar CLI 26+
- Freighter browser wallet for wallet UI testing

```bash
pnpm install
rustup target add wasm32v1-none
```

Copy the example environment:

```bash
cp .env.example .env
```

Run tests:

```bash
pnpm test
```

Run the local app:

```bash
PAYGATE_DEMO_MODE=true PORT=8787 pnpm --filter @stellar-paygate/api dev
VITE_API_URL=http://localhost:8787 pnpm --filter @stellar-paygate/web dev
```

Open `http://localhost:5174`.

## API Demo Flow

Unpaid request:

```bash
curl -i -X POST http://localhost:8787/api/tools/invoice_risk_score/run \
  -H "content-type: application/json" \
  --data '{"prompt":"Finance a 30 day invoice"}'
```

Paid demo retry:

```bash
curl -s -X POST http://localhost:8787/api/tools/invoice_risk_score/run \
  -H "content-type: application/json" \
  -H "x-paygate-demo-paid: true" \
  --data '{"prompt":"Finance a 30 day invoice","amount":5000}'
```

The first call returns `402`. The paid retry returns the tool result and a receipt containing request and response hashes.

## MCP Usage

Run the local MCP server:

```bash
pnpm --filter @stellar-paygate/api mcp
```

Available MCP tools:

- `invoice_risk_score`
- `rwa_yield_brief`
- `stellar_grant_fit_check`

In demo mode, pass `demoPaid: true` or a `paymentTxHash` argument to execute the tool. Without payment proof, the MCP server returns a structured `payment_required` response.

## Testnet Deployment

Fund the configured Stellar CLI key:

```bash
STELLAR_SOURCE_KEY=alice ./scripts/fund-testnet.sh
```

Deploy and initialize:

```bash
STELLAR_SOURCE_KEY=alice ./scripts/deploy-contract.sh
```

Register demo tools:

```bash
PAYGATE_CONTRACT_ID=<CONTRACT_ID> ./scripts/register-demo-tools.sh
```

Record a demo paid-call receipt:

```bash
PAYGATE_CONTRACT_ID=<CONTRACT_ID> ./scripts/record-demo-call.sh
```

Capture README screenshots:

```bash
PAYGATE_WEB_URL=http://localhost:5174 pnpm screenshots
```

## Development Plan

1. Build the Soroban registry with tool listings, paid-call receipts, provider stats, and dispute states.
2. Add deterministic paid AI tools and shared hashing so receipts are reproducible.
3. Expose HTTP endpoints with MPP-ready payment enforcement and a demo `402` retry path.
4. Expose the same tools through MCP for agent clients.
5. Ship the React dashboard, deployment scripts, screenshots, and Testnet transaction proof.

## Future Grant Roadmap

- Replace demo payment headers with production MPP Charge credentials and settlement verification.
- Add Freighter-signed contract calls from the UI for provider registration and disputes.
- Add a provider payout ledger, protocol fees, and a searchable receipt indexer.
- Support x402 facilitator mode for zero-XLM clients.
- Add real data providers for RWA analytics, invoice underwriting, and compliance scoring.
