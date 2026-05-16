import { describe, expect, it } from "vitest";
import { PAYGATE_TOOLS, createDemoReceipt, getTool, runPayGateTool } from "../src/index.js";

describe("PayGate tools", () => {
  it("defines the three hackathon demo tools", () => {
    expect(PAYGATE_TOOLS.map((tool) => tool.id)).toEqual([
      "invoice_risk_score",
      "rwa_yield_brief",
      "stellar_grant_fit_check"
    ]);
  });

  it("runs deterministically for the same input", () => {
    const input = { prompt: "Finance a 30 day supplier invoice", amount: 5000 };
    const first = runPayGateTool("invoice_risk_score", input);
    const second = runPayGateTool("invoice_risk_score", input);

    expect(first).toEqual(second);
    expect(first.requestHash).toMatch(/^sha256:/);
    expect(first.responseHash).toMatch(/^sha256:/);
  });

  it("creates receipts that include request and response hashes", () => {
    const tool = getTool("stellar_grant_fit_check");
    const result = runPayGateTool("stellar_grant_fit_check", { prompt: "AI paid APIs on Stellar" });
    const receipt = createDemoReceipt({
      toolId: "stellar_grant_fit_check",
      amountStroops: tool?.priceStroops ?? "0",
      result
    });

    expect(receipt.paymentTxHash).toContain("demo-tx");
    expect(receipt.requestHash).toBe(result.requestHash);
    expect(receipt.responseHash).toBe(result.responseHash);
  });
});
