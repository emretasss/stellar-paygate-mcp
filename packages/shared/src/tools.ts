import { sha256 } from "@noble/hashes/sha2";
import { bytesToHex } from "@noble/hashes/utils";

export type PayGateToolId =
  | "invoice_risk_score"
  | "rwa_yield_brief"
  | "stellar_grant_fit_check";

export type ToolCategory = "risk" | "rwa" | "grant";

export interface PayGateTool {
  id: PayGateToolId;
  name: string;
  category: ToolCategory;
  priceUsdc: string;
  priceStroops: string;
  description: string;
  provider: string;
  metadataHash: string;
}

export interface ToolRunInput {
  prompt: string;
  amount?: number;
  region?: string;
  asset?: string;
}

export interface ToolRunResult {
  toolId: PayGateToolId;
  summary: string;
  score: number;
  signals: string[];
  nextActions: string[];
  requestHash: string;
  responseHash: string;
}

export const TESTNET_USDC = {
  code: "USDC",
  issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  sac: "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA",
  decimals: 7
} as const;

export const PAYGATE_TOOLS: PayGateTool[] = [
  {
    id: "invoice_risk_score",
    name: "Invoice Risk Score",
    category: "risk",
    priceUsdc: "0.01",
    priceStroops: "100000",
    description: "Scores an invoice-like cash-flow request for PayFi underwriting.",
    provider: "PayGate Labs",
    metadataHash: "sha256:7d10d7f9f17e-invoice-risk"
  },
  {
    id: "rwa_yield_brief",
    name: "RWA Yield Brief",
    category: "rwa",
    priceUsdc: "0.015",
    priceStroops: "150000",
    description: "Summarizes tokenized treasury and private-credit suitability.",
    provider: "PayGate Labs",
    metadataHash: "sha256:9a53f01d2f4c-rwa-brief"
  },
  {
    id: "stellar_grant_fit_check",
    name: "Stellar Grant Fit Check",
    category: "grant",
    priceUsdc: "0.02",
    priceStroops: "200000",
    description: "Checks whether a Stellar project is aligned with funding criteria.",
    provider: "PayGate Labs",
    metadataHash: "sha256:36e7f8aa9154-grant-fit"
  }
];

export function getTool(id: string): PayGateTool | undefined {
  return PAYGATE_TOOLS.find((tool) => tool.id === id);
}

export function hashJson(value: unknown): string {
  const stable = JSON.stringify(sortObject(value));
  return `sha256:${bytesToHex(sha256(new TextEncoder().encode(stable)))}`;
}

export function runPayGateTool(toolId: PayGateToolId, input: ToolRunInput): ToolRunResult {
  const normalizedPrompt = input.prompt.trim() || "Untitled request";
  const requestHash = hashJson({ toolId, input });

  const result = buildToolResult(toolId, normalizedPrompt, input, requestHash);
  return {
    ...result,
    responseHash: hashJson({
      toolId,
      summary: result.summary,
      score: result.score,
      signals: result.signals,
      nextActions: result.nextActions
    })
  };
}

function buildToolResult(
  toolId: PayGateToolId,
  prompt: string,
  input: ToolRunInput,
  requestHash: string
): Omit<ToolRunResult, "responseHash"> {
  const entropy = numericHash(`${toolId}:${prompt}:${input.amount ?? 0}:${input.region ?? ""}`);

  if (toolId === "invoice_risk_score") {
    const amount = input.amount ?? 4_200;
    const score = clamp(92 - Math.round(amount / 850) - (entropy % 17), 34, 94);
    return {
      toolId,
      summary: `Invoice request scored ${score}/100 with ${score > 70 ? "low" : "moderate"} repayment risk.`,
      score,
      signals: [
        "Payment terms are short enough for PayFi settlement.",
        "Counterparty concentration is the main watch item.",
        "Stellar USDC settlement can reduce reconciliation delay."
      ],
      nextActions: [
        "Request buyer confirmation before financing.",
        "Set a maximum advance ratio based on invoice age.",
        "Record the decision hash with the PayGate receipt."
      ],
      requestHash
    };
  }

  if (toolId === "rwa_yield_brief") {
    const score = clamp(68 + (entropy % 23), 55, 96);
    const asset = input.asset ?? "tokenized treasury exposure";
    return {
      toolId,
      summary: `${asset} is suitable for conservative treasury routing with a ${score}/100 composability score.`,
      score,
      signals: [
        "Liquidity quality matters more than headline yield.",
        "SAC-compatible assets are easier to compose with Soroban flows.",
        "Disclosure, issuer controls, and redemption path should be visible in the UI."
      ],
      nextActions: [
        "Show issuer, redemption, and risk metadata beside yield.",
        "Route production quotes through a verified oracle/provider.",
        "Keep the registry receipt separate from investment advice."
      ],
      requestHash
    };
  }

  const score = clamp(72 + (entropy % 21), 60, 97);
  return {
    toolId,
    summary: `Project has a ${score}/100 Stellar grant fit because it combines payments, Soroban receipts, and agent tooling.`,
    score,
    signals: [
      "Clear Stellar-specific payment primitive: MPP over Testnet USDC.",
      "Soroban adds auditable usage receipts instead of generic off-chain billing.",
      "MCP distribution gives the project an AI-native adoption channel."
    ],
    nextActions: [
      "Publish testnet transaction hashes in the README.",
      "Add screenshots that prove wallet, payment, and receipt flows.",
      "Document the path from demo mode to real MPP credentials."
    ],
    requestHash
  };
}

function numericHash(value: string): number {
  const digest = sha256(new TextEncoder().encode(value));
  return digest.slice(0, 4).reduce((acc, byte) => (acc << 8) + byte, 0);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, sortObject(nested)])
    );
  }
  return value;
}
