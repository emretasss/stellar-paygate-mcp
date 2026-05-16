import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeDollarSign,
  Bot,
  Check,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  ExternalLink,
  Gauge,
  KeyRound,
  PlugZap,
  ReceiptText,
  ShieldCheck,
  Wallet
} from "lucide-react";
import { PAYGATE_TOOLS, TESTNET_USDC, type PayGateReceipt, type PayGateTool } from "@stellar-paygate/shared";
import { getAddress, getNetwork, isConnected, setAllowed } from "@stellar/freighter-api";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8787";
const DEFAULT_TOOL = PAYGATE_TOOLS[0]!;

type WalletState = {
  address: string | null;
  network: string | null;
  status: "idle" | "connected" | "missing" | "error";
};

type RunState = {
  loading: boolean;
  selectedTool: PayGateTool;
  prompt: string;
  result?: {
    summary: string;
    score: number;
    signals: string[];
    nextActions: string[];
    requestHash: string;
    responseHash: string;
  };
  receipt?: PayGateReceipt;
  paymentRequired: boolean;
  error?: string;
};

export function App() {
  const [wallet, setWallet] = useState<WalletState>({ address: null, network: null, status: "idle" });
  const [receipts, setReceipts] = useState<PayGateReceipt[]>([]);
  const [disputeReason, setDisputeReason] = useState("Output mismatch");
  const [runState, setRunState] = useState<RunState>({
    loading: false,
    selectedTool: DEFAULT_TOOL,
    prompt: "Score a 30 day supplier invoice for a small exporter using Stellar USDC settlement.",
    paymentRequired: false
  });

  const totalVolume = useMemo(
    () => receipts.reduce((sum, receipt) => sum + Number(receipt.amountStroops), 0) / 10_000_000,
    [receipts]
  );

  useEffect(() => {
    void refreshReceipts();
    void detectWallet();
  }, []);

  async function detectWallet() {
    try {
      const connected = await isConnected();
      const isFreighterConnected = typeof connected === "object" ? connected.isConnected : connected;
      if (!isFreighterConnected) return;
      const addressResult = await getAddress();
      const networkResult = await getNetwork();
      setWallet({
        address: typeof addressResult === "object" ? addressResult.address : addressResult,
        network: typeof networkResult === "object" ? networkResult.network : networkResult,
        status: "connected"
      });
    } catch {
      setWallet((current) => ({ ...current, status: "idle" }));
    }
  }

  async function connectWallet() {
    try {
      await setAllowed();
      await detectWallet();
    } catch {
      setWallet({ address: null, network: null, status: "missing" });
    }
  }

  async function refreshReceipts() {
    const response = await fetch(`${API_URL}/api/receipts`);
    const payload = (await response.json()) as { receipts: PayGateReceipt[] };
    setReceipts(payload.receipts);
  }

  async function runTool() {
    setRunState((current) => ({ ...current, loading: true, error: undefined, paymentRequired: false }));
    const body = { prompt: runState.prompt, amount: 5000, region: "EMEA", asset: "tokenized treasury" };

    const first = await fetch(`${API_URL}/api/tools/${runState.selectedTool.id}/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });

    if (first.status === 402) {
      setRunState((current) => ({ ...current, paymentRequired: true }));
    }

    const paid = await fetch(`${API_URL}/api/tools/${runState.selectedTool.id}/run`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-paygate-demo-paid": "true",
        "x-paygate-payer": wallet.address ?? "GDEMOAGENTPAYMENTACCOUNT000000000000000000000000000000000"
      },
      body: JSON.stringify(body)
    });

    if (!paid.ok) {
      setRunState((current) => ({ ...current, loading: false, error: "Tool call failed" }));
      return;
    }

    const payload = await paid.json();
    setRunState((current) => ({
      ...current,
      loading: false,
      result: payload.result,
      receipt: payload.receipt
    }));
    await refreshReceipts();
  }

  async function openDispute() {
    if (!runState.receipt) return;
    await fetch(`${API_URL}/api/disputes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ receiptId: runState.receipt.id, reason: disputeReason })
    });
  }

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <img src="/paygate-emblem.svg" alt="" />
          <div>
            <strong>Stellar PayGate MCP</strong>
            <span>Agentic payments marketplace</span>
          </div>
        </div>
        <button className="walletButton" onClick={connectWallet}>
          <Wallet size={18} />
          {wallet.address ? shortKey(wallet.address) : "Connect"}
        </button>
      </header>

      <section className="overviewBand">
        <div className="overviewCopy">
          <div className="eyebrow">
            <CircleDot size={16} />
            Stellar Testnet · MPP · Soroban receipts
          </div>
          <h1>PayGate Operations</h1>
          <p>
            Testnet USDC settlement, MPP payment challenges, MCP tool access, and Soroban usage receipts.
          </p>
          <div className="statusRow">
            <StatusPill icon={<BadgeDollarSign size={16} />} label={`${TESTNET_USDC.code} SAC`} value={shortKey(TESTNET_USDC.sac)} />
            <StatusPill icon={<ShieldCheck size={16} />} label="Network" value={wallet.network ?? "TESTNET"} />
            <StatusPill icon={<ReceiptText size={16} />} label="Receipts" value={String(receipts.length)} />
          </div>
        </div>
        <div className="mascotPanel">
          <img src="/agent-mascot.svg" alt="" />
        </div>
      </section>

      <section className="metricsBand">
        <Metric icon={<PlugZap />} label="Tools" value={String(PAYGATE_TOOLS.length)} />
        <Metric icon={<ReceiptText />} label="Volume" value={`${totalVolume.toFixed(3)} USDC`} />
        <Metric icon={<Gauge />} label="Latest Score" value={runState.result ? `${runState.result.score}/100` : "Ready"} />
        <Metric icon={<KeyRound />} label="Wallet" value={wallet.address ? "Linked" : "Demo"} />
      </section>

      <section className="workspace">
        <div className="toolList">
          <div className="sectionHeader">
            <Bot size={20} />
            <h2>Marketplace</h2>
          </div>
          {PAYGATE_TOOLS.map((tool) => (
            <button
              key={tool.id}
              className={tool.id === runState.selectedTool.id ? "toolCard active" : "toolCard"}
              onClick={() => setRunState((current) => ({ ...current, selectedTool: tool }))}
            >
              <span>
                <strong>{tool.name}</strong>
                <small>{tool.description}</small>
              </span>
              <b>{tool.priceUsdc} USDC</b>
            </button>
          ))}
        </div>

        <div className="consolePanel">
          <div className="sectionHeader">
            <PlugZap size={20} />
            <h2>Paid Call Console</h2>
          </div>
          <label>
            <span>Selected tool</span>
            <select
              value={runState.selectedTool.id}
              onChange={(event) => {
                const tool = PAYGATE_TOOLS.find((item) => item.id === event.target.value) ?? DEFAULT_TOOL;
                setRunState((current) => ({ ...current, selectedTool: tool }));
              }}
            >
              {PAYGATE_TOOLS.map((tool) => (
                <option key={tool.id} value={tool.id}>
                  {tool.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Prompt</span>
            <textarea
              value={runState.prompt}
              onChange={(event) => setRunState((current) => ({ ...current, prompt: event.target.value }))}
            />
          </label>
          <button className="primaryAction" onClick={runTool} disabled={runState.loading}>
            {runState.loading ? "Running" : "Run paid call"}
            <ChevronRight size={18} />
          </button>
          {runState.paymentRequired && (
            <div className="notice">
              <AlertTriangle size={18} />
              <span>402 returned, payment credential attached, call retried.</span>
            </div>
          )}
        </div>

        <div className="resultPanel">
          <div className="sectionHeader">
            <ClipboardCheck size={20} />
            <h2>Receipt</h2>
          </div>
          {runState.result ? (
            <>
              <div className="scoreDial">
                <span>{runState.result.score}</span>
                <small>score</small>
              </div>
              <p className="summary">{runState.result.summary}</p>
              <div className="hashGrid">
                <HashLine label="Request" value={runState.result.requestHash} />
                <HashLine label="Response" value={runState.result.responseHash} />
                <HashLine label="Tx" value={runState.receipt?.paymentTxHash ?? "pending"} />
              </div>
            </>
          ) : (
            <div className="emptyState">No receipt selected</div>
          )}
        </div>
      </section>

      <section className="detailsBand">
        <div>
          <div className="sectionHeader">
            <Check size={20} />
            <h2>Signals</h2>
          </div>
          <ul className="signalList">
            {(runState.result?.signals ?? ["MPP payment challenge", "Soroban registry ready", "MCP tools exposed"]).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="sectionHeader">
            <ReceiptText size={20} />
            <h2>Recent Receipts</h2>
          </div>
          <div className="receiptList">
            {receipts.length === 0 ? (
              <span className="emptyState">No receipts yet</span>
            ) : (
              receipts.map((receipt) => (
                <div className="receiptRow" key={receipt.id}>
                  <span>{receipt.toolId}</span>
                  <b>{Number(receipt.amountStroops) / 10_000_000} USDC</b>
                  <small>{shortKey(receipt.paymentTxHash)}</small>
                </div>
              ))
            )}
          </div>
        </div>
        <div>
          <div className="sectionHeader">
            <ShieldCheck size={20} />
            <h2>Dispute</h2>
          </div>
          <label>
            <span>Reason</span>
            <input value={disputeReason} onChange={(event) => setDisputeReason(event.target.value)} />
          </label>
          <button className="secondaryAction" onClick={openDispute} disabled={!runState.receipt}>
            Open dispute
            <ExternalLink size={16} />
          </button>
        </div>
      </section>
    </main>
  );
}

function StatusPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="statusPill">
      {icon}
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function HashLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <code>{shortKey(value)}</code>
    </div>
  );
}

function shortKey(value: string): string {
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}
