import cors from "cors";
import express, { type Express } from "express";
import {
  PAYGATE_TOOLS,
  createDemoReceipt,
  getTool,
  runPayGateTool,
  TESTNET_USDC,
  type ToolRunInput
} from "@stellar-paygate/shared";
import type { ApiConfig } from "./config.js";
import { loadConfig } from "./config.js";
import { enforcePayment } from "./paymentGate.js";
import { recordReceiptOnChain } from "./registry.js";
import { addDispute, addReceipt, listDisputes, listReceipts } from "./store.js";

export function createServer(config: ApiConfig = loadConfig()): Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "256kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      project: "Stellar PayGate MCP",
      network: config.network,
      demoMode: config.demoMode,
      asset: TESTNET_USDC
    });
  });

  app.get("/api/tools", (_req, res) => {
    res.json({ tools: PAYGATE_TOOLS, asset: TESTNET_USDC });
  });

  app.get("/api/receipts", (_req, res) => {
    res.json({ receipts: listReceipts() });
  });

  app.get("/api/disputes", (_req, res) => {
    res.json({ disputes: listDisputes() });
  });

  app.post("/api/disputes", (req, res) => {
    const receiptId = String(req.body?.receiptId ?? "");
    const reason = String(req.body?.reason ?? "Service output challenged");
    if (!receiptId) {
      return res.status(400).json({ error: "receiptId is required" });
    }
    return res.status(201).json({ dispute: addDispute(receiptId, reason) });
  });

  app.post("/api/tools/:id/run", async (req, res, next) => {
    try {
      const tool = getTool(req.params.id);
      if (!tool) {
        return res.status(404).json({ error: "unknown_tool" });
      }

      const payment = await enforcePayment(req, res, config, tool);
      if (!payment) return undefined;

      const input = normalizeToolInput(req.body);
      const result = runPayGateTool(tool.id, input);
      const receipt = createDemoReceipt({
        toolId: tool.id,
        payer: payment.payer,
        amountStroops: tool.priceStroops,
        result,
        paymentTxHash: payment.paymentTxHash,
        status: payment.mode === "demo" ? "demo" : "pending_onchain"
      });

      try {
        const onChain = await recordReceiptOnChain(config, tool, receipt);
        if (onChain.status === "submitted") {
          receipt.status = "recorded_onchain";
          receipt.contractCallId = onChain.callId;
          if (onChain.txHash) receipt.paymentTxHash = onChain.txHash;
        }
      } catch (error) {
        receipt.status = payment.mode === "demo" ? "demo" : "pending_onchain";
      }

      addReceipt(receipt);
      const payload = { tool, result, receipt };
      if (payment.wrapResponse) {
        const wrapped = await payment.wrapResponse(payload);
        wrapped.headers.forEach((value, key) => res.setHeader(key, value));
        return res.status(wrapped.status).send(wrapped.body);
      }
      return res.json(payload);
    } catch (error) {
      return next(error);
    }
  });

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: "internal_error", message });
  });

  return app;
}

function normalizeToolInput(body: unknown): ToolRunInput {
  if (!body || typeof body !== "object") {
    return { prompt: "" };
  }
  const record = body as Record<string, unknown>;
  return {
    prompt: String(record.prompt ?? ""),
    amount: typeof record.amount === "number" ? record.amount : undefined,
    region: typeof record.region === "string" ? record.region : undefined,
    asset: typeof record.asset === "string" ? record.asset : undefined
  };
}
