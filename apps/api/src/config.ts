import "dotenv/config";

export interface ApiConfig {
  port: number;
  network: "stellar:testnet" | "stellar:pubnet";
  rpcUrl: string;
  recipient?: string;
  mppSecretKey?: string;
  demoMode: boolean;
  contractId?: string;
  gatewayKeyName?: string;
  gatewayAddress?: string;
}

export function loadConfig(env = process.env): ApiConfig {
  return {
    port: Number(env.PORT ?? 8787),
    network: env.STELLAR_NETWORK === "stellar:pubnet" ? "stellar:pubnet" : "stellar:testnet",
    rpcUrl: env.STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org",
    recipient: env.STELLAR_RECIPIENT,
    mppSecretKey: env.MPP_SECRET_KEY,
    demoMode: env.PAYGATE_DEMO_MODE !== "false",
    contractId: env.PAYGATE_CONTRACT_ID,
    gatewayKeyName: env.PAYGATE_GATEWAY_KEY_NAME ?? "alice",
    gatewayAddress: env.PAYGATE_GATEWAY_ADDRESS
  };
}
