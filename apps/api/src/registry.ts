import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { PayGateReceipt, PayGateTool } from "@stellar-paygate/shared";
import type { ApiConfig } from "./config.js";

const execFileAsync = promisify(execFile);
const CONTRACT_TOOL_IDS: Record<string, string> = {
  invoice_risk_score: "1",
  rwa_yield_brief: "2",
  stellar_grant_fit_check: "3"
};

export interface OnChainRecordResult {
  status: "skipped" | "submitted";
  txHash?: string;
  callId?: string;
  reason?: string;
}

export async function recordReceiptOnChain(
  config: ApiConfig,
  tool: PayGateTool,
  receipt: PayGateReceipt
): Promise<OnChainRecordResult> {
  if (!config.contractId || !config.gatewayAddress || !config.gatewayKeyName) {
    return {
      status: "skipped",
      reason: "PAYGATE_CONTRACT_ID, PAYGATE_GATEWAY_ADDRESS, or PAYGATE_GATEWAY_KEY_NAME is not configured"
    };
  }

  const args = [
    "contract",
    "invoke",
    "--id",
    config.contractId,
    "--source",
    config.gatewayKeyName,
    "--network",
    config.network === "stellar:pubnet" ? "mainnet" : "testnet",
    "--",
    "record_call",
    "--gateway",
    config.gatewayAddress,
    "--tool_id",
    CONTRACT_TOOL_IDS[tool.id] ?? "1",
    "--payer",
    receipt.payer,
    "--amount",
    receipt.amountStroops,
    "--payment_tx_hash",
    receipt.paymentTxHash,
    "--request_hash",
    receipt.requestHash,
    "--response_hash",
    receipt.responseHash
  ];

  const { stdout } = await execFileAsync("stellar", args, { timeout: 60_000 });
  const txHash = stdout.match(/[a-f0-9]{64}/i)?.[0];
  return {
    status: "submitted",
    txHash,
    callId: stdout.trim().split(/\s+/).at(-1)
  };
}
