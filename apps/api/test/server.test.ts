import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createServer } from "../src/server.js";
import { clearStoreForTests } from "../src/store.js";

const app = createServer({
  port: 0,
  network: "stellar:testnet",
  rpcUrl: "https://soroban-testnet.stellar.org",
  demoMode: true
});

describe("PayGate API", () => {
  beforeEach(() => clearStoreForTests());

  it("returns 402 before payment", async () => {
    const res = await request(app)
      .post("/api/tools/invoice_risk_score/run")
      .send({ prompt: "Finance a 30 day invoice", amount: 5000 });

    expect(res.status).toBe(402);
    expect(res.body.error).toBe("payment_required");
    expect(res.headers["x-paygate-network"]).toBe("stellar:testnet");
  });

  it("runs a paid tool and stores a receipt", async () => {
    const paid = await request(app)
      .post("/api/tools/stellar_grant_fit_check/run")
      .set("x-paygate-demo-paid", "true")
      .set("x-payment-tx-hash", "demo-testnet-transaction-hash")
      .send({ prompt: "MCP paid API on Stellar" });

    expect(paid.status).toBe(200);
    expect(paid.body.result.score).toBeGreaterThan(0);
    expect(paid.body.receipt.paymentTxHash).toBe("demo-testnet-transaction-hash");

    const receipts = await request(app).get("/api/receipts");
    expect(receipts.body.receipts).toHaveLength(1);
  });
});
