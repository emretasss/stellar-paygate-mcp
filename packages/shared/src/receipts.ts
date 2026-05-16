import type { PayGateToolId, ToolRunResult } from "./tools.js";
import { hashJson } from "./tools.js";

export type ReceiptStatus = "demo" | "pending_onchain" | "recorded_onchain";

export interface PayGateReceipt {
  id: string;
  toolId: PayGateToolId;
  payer: string;
  amountStroops: string;
  paymentTxHash: string;
  requestHash: string;
  responseHash: string;
  status: ReceiptStatus;
  createdAt: string;
  contractCallId?: string;
}

export function createDemoReceipt(args: {
  toolId: PayGateToolId;
  payer?: string;
  amountStroops: string;
  result: ToolRunResult;
  paymentTxHash?: string;
  status?: ReceiptStatus;
}): PayGateReceipt {
  const paymentTxHash =
    args.paymentTxHash ??
    `demo-tx-${hashJson({
      toolId: args.toolId,
      requestHash: args.result.requestHash,
      responseHash: args.result.responseHash
    }).slice(7, 23)}`;

  return {
    id: hashJson({ paymentTxHash, toolId: args.toolId }).slice(7, 23),
    toolId: args.toolId,
    payer: args.payer ?? "GDEMOAGENTPAYMENTACCOUNT000000000000000000000000000000000",
    amountStroops: args.amountStroops,
    paymentTxHash,
    requestHash: args.result.requestHash,
    responseHash: args.result.responseHash,
    status: args.status ?? "demo",
    createdAt: new Date().toISOString()
  };
}
