import type { Request, Response } from "express";
import { TESTNET_USDC, type PayGateTool } from "@stellar-paygate/shared";
import type { ApiConfig } from "./config.js";

export interface PaymentProof {
  mode: "demo" | "mpp";
  payer: string;
  paymentTxHash?: string;
  wrapResponse?: (payload: unknown) => Promise<{
    status: number;
    headers: Headers;
    body: string;
  }>;
}

interface MppGate {
  charge: (args: { amount: string; description: string }) => (request: Request) => Promise<any>;
}

let cachedMppGate: MppGate | null = null;

export async function enforcePayment(
  req: Request,
  res: Response,
  config: ApiConfig,
  tool: PayGateTool
): Promise<PaymentProof | null> {
  if (config.demoMode || !config.recipient || !config.mppSecretKey) {
    return enforceDemoPayment(req, res, tool);
  }

  const gate = await getMppGate(config);
  const result = await gate.charge({
    amount: tool.priceUsdc,
    description: `${tool.name} access`
  })(req);

  if (result.status === 402) {
    const challenge = result.challenge;
    challenge.headers.forEach((value: string, key: string) => res.setHeader(key, value));
    res.status(402).send(await challenge.text());
    return null;
  }

  return typeof result.toPaymentProof === "function"
    ? result.toPaymentProof()
    : {
        mode: "mpp",
        payer: String(req.header("x-paygate-payer") ?? "stellar-mpp-client"),
        paymentTxHash: req.header("x-payment-tx-hash") ?? undefined
      };
}

function enforceDemoPayment(req: Request, res: Response, tool: PayGateTool): PaymentProof | null {
  const paid = req.header("x-paygate-demo-paid") === "true";
  if (!paid) {
    res
      .status(402)
      .setHeader("x-paygate-network", "stellar:testnet")
      .setHeader("x-paygate-asset", TESTNET_USDC.sac)
      .setHeader("x-paygate-price-stroops", tool.priceStroops)
      .json({
        error: "payment_required",
        network: "stellar:testnet",
        asset: TESTNET_USDC,
        amountStroops: tool.priceStroops,
        demoRetryHeader: "x-paygate-demo-paid: true"
      });
    return null;
  }

  return {
    mode: "demo",
    payer: req.header("x-paygate-payer") ?? "GDEMOAGENTPAYMENTACCOUNT000000000000000000000000000000000",
    paymentTxHash: req.header("x-payment-tx-hash") ?? undefined
  };
}

async function getMppGate(config: ApiConfig): Promise<MppGate> {
  if (cachedMppGate) return cachedMppGate;
  if (!config.recipient || !config.mppSecretKey) {
    throw new Error("Real MPP mode requires STELLAR_RECIPIENT and MPP_SECRET_KEY");
  }

  const [chargeServer, mpp] = await Promise.all([
    import("@stellar/mpp/charge/server"),
    import("@stellar/mpp")
  ]);
  const { Mppx, Store, stellar } = chargeServer;

  const mppx = Mppx.create({
    secretKey: config.mppSecretKey,
    methods: [
      (stellar as any).charge({
        recipient: config.recipient,
        currency: mpp.USDC_SAC_TESTNET,
        network: config.network,
        rpcUrl: config.rpcUrl,
        store: (Store as any).memory()
      })
    ]
  });

  cachedMppGate = {
    charge:
      (args: { amount: string; description: string }) =>
      async (request: Request): Promise<any> => {
        const headers = new Headers();
        for (const [key, value] of Object.entries(request.headers)) {
          if (value == null) continue;
          if (Array.isArray(value)) {
            for (const entry of value) headers.append(key, entry);
          } else {
            headers.set(key, value);
          }
        }

        const webRequest = new Request(`${request.protocol}://${request.get("host")}${request.originalUrl}`, {
          method: request.method,
          headers
        });

        const result = await (mppx as any).charge(args)(webRequest);
        if (result.status !== 402) {
          result.toPaymentProof = () => ({
            mode: "mpp",
            payer: request.header("x-paygate-payer") ?? "stellar-mpp-client",
            paymentTxHash: request.header("x-payment-tx-hash") ?? undefined,
            wrapResponse: async (payload: unknown) => {
              const wrapped = result.withReceipt(Response.json(payload));
              return {
                status: wrapped.status,
                headers: wrapped.headers,
                body: await wrapped.text()
              };
            }
          });
        }
        return result;
      }
  };

  return cachedMppGate;
}
