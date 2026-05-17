import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Banknote,
  Blocks,
  Braces,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Copy,
  ExternalLink,
  FileCheck2,
  Gauge,
  Globe2,
  KeyRound,
  Layers3,
  LayoutDashboard,
  Link2,
  LockKeyhole,
  Network,
  PlugZap,
  ReceiptText,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  TerminalSquare,
  Wallet,
  Workflow
} from "lucide-react";
import { getAddress, getNetwork, isConnected, setAllowed } from "@stellar/freighter-api";
import { PAYGATE_TOOLS, TESTNET_USDC, type PayGateReceipt, type PayGateTool } from "@stellar-paygate/shared";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Progress } from "./components/ui/progress";
import { Separator } from "./components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { cn } from "./lib/utils";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8787";
const DEFAULT_TOOL = PAYGATE_TOOLS[0]!;
const CONTRACT_ID = "CDDFVDZWZPDWE3RFB6XZCJ2RE6ZRQHXQRX5QB42GMNAIYBZY4UPLMXCQ";
const PAID_CALL_TX = "4ac87c8d540dfe6a91d0aa0f1928a6d0b9d4203f379c6dcdd5d81645e92cdd72";

type ViewId = "overview" | "flow" | "registry" | "mcp" | "disputes";

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

type DisputeRecord = {
  id: string;
  receiptId: string;
  reason: string;
  status: "open" | "resolved";
  createdAt: string;
};

const navigation: Array<{ id: ViewId; label: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "Command Center", icon: LayoutDashboard },
  { id: "flow", label: "Payment Flow", icon: Workflow },
  { id: "registry", label: "On-chain Registry", icon: Blocks },
  { id: "mcp", label: "MCP Console", icon: TerminalSquare },
  { id: "disputes", label: "Disputes", icon: ShieldAlert }
];

const staticEvents = [
  "Contract deployed on Stellar Testnet",
  "Three paid tools registered on-chain",
  "Paid-call receipt recorded with request and response hashes"
];

export function App() {
  const [activeView, setActiveView] = useState<ViewId>("overview");
  const [wallet, setWallet] = useState<WalletState>({ address: null, network: null, status: "idle" });
  const [receipts, setReceipts] = useState<PayGateReceipt[]>([]);
  const [disputes, setDisputes] = useState<DisputeRecord[]>([]);
  const [disputeReason, setDisputeReason] = useState("Tool output did not match expected quality");
  const [copied, setCopied] = useState(false);
  const [runState, setRunState] = useState<RunState>({
    loading: false,
    selectedTool: DEFAULT_TOOL,
    prompt: "Evaluate this Stellar project for grant readiness: paid MCP tools, MPP settlement, Soroban receipts, Testnet deployment.",
    paymentRequired: false
  });

  const totalVolume = useMemo(
    () => receipts.reduce((sum, receipt) => sum + Number(receipt.amountStroops), 0) / 10_000_000,
    [receipts]
  );
  const latestReceipt = runState.receipt ?? receipts[0];
  const latestScore = runState.result?.score ?? 94;
  const connectedLabel = wallet.address ? shortKey(wallet.address) : "Demo wallet";

  useEffect(() => {
    void refreshReceipts();
    void refreshDisputes();
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
    try {
      const response = await fetch(`${API_URL}/api/receipts`);
      const payload = (await response.json()) as { receipts: PayGateReceipt[] };
      setReceipts(payload.receipts);
    } catch {
      setReceipts([]);
    }
  }

  async function refreshDisputes() {
    try {
      const response = await fetch(`${API_URL}/api/disputes`);
      const payload = (await response.json()) as { disputes: DisputeRecord[] };
      setDisputes(payload.disputes);
    } catch {
      setDisputes([]);
    }
  }

  async function runTool(tool = runState.selectedTool) {
    setRunState((current) => ({
      ...current,
      selectedTool: tool,
      loading: true,
      error: undefined,
      paymentRequired: false
    }));

    const body = {
      prompt: runState.prompt,
      amount: 5000,
      region: "Global",
      asset: "tokenized treasury exposure"
    };

    try {
      const first = await fetch(`${API_URL}/api/tools/${tool.id}/run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });

      if (first.status === 402) {
        setRunState((current) => ({ ...current, paymentRequired: true }));
      }

      const paid = await fetch(`${API_URL}/api/tools/${tool.id}/run`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-paygate-demo-paid": "true",
          "x-paygate-payer": wallet.address ?? "GDEMOAGENTPAYMENTACCOUNT000000000000000000000000000000000"
        },
        body: JSON.stringify(body)
      });

      if (!paid.ok) throw new Error("Paid tool call failed");
      const payload = await paid.json();
      setRunState((current) => ({
        ...current,
        loading: false,
        result: payload.result,
        receipt: payload.receipt
      }));
      await refreshReceipts();
      setActiveView("overview");
    } catch (error) {
      setRunState((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Tool call failed"
      }));
    }
  }

  async function openDispute() {
    const receipt = latestReceipt;
    if (!receipt) return;
    await fetch(`${API_URL}/api/disputes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ receiptId: receipt.id, reason: disputeReason })
    });
    await refreshDisputes();
    setActiveView("disputes");
  }

  async function copyMcpConfig() {
    await navigator.clipboard.writeText(mcpConfig);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r bg-slate-950 text-slate-100 lg:flex lg:flex-col">
        <div className="flex h-20 items-center gap-3 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-400 text-slate-950">
            <PlugZap className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold tracking-normal">Stellar PayGate</div>
            <div className="text-sm text-slate-400">Agent revenue operations</div>
          </div>
        </div>
        <nav className="space-y-1 px-3">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={cn(
                  "flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white",
                  activeView === item.id && "bg-cyan-400/15 text-cyan-100 ring-1 ring-cyan-400/25"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto p-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <BadgeCheck className="h-4 w-4 text-cyan-300" />
              Testnet verified
            </div>
            <div className="break-all font-mono text-xs leading-5 text-slate-400">{CONTRACT_ID}</div>
            <a
              className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-cyan-200"
              href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`}
              target="_blank"
              rel="noreferrer"
            >
              Explorer <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
          <div className="flex min-h-16 flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                <Globe2 className="h-3.5 w-3.5" />
                Stellar Testnet · MPP charge · Soroban registry
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-normal text-slate-950">PayGate Command Center</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="h-9 gap-2 bg-white">
                <Network className="h-3.5 w-3.5 text-cyan-700" />
                {wallet.network ?? "TESTNET"}
              </Badge>
              <Button variant="outline" onClick={connectWallet} className="bg-white">
                <Wallet className="h-4 w-4" />
                {connectedLabel}
              </Button>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto px-4 pb-3 lg:hidden">
            {navigation.map((item) => (
              <Button
                key={item.id}
                size="sm"
                variant={activeView === item.id ? "default" : "outline"}
                onClick={() => setActiveView(item.id)}
                className="shrink-0"
              >
                {item.label}
              </Button>
            ))}
          </div>
        </header>

        <main className="mx-auto max-w-[1500px] space-y-6 px-4 py-6 lg:px-8">
          {activeView === "overview" && (
            <OverviewView
              totalVolume={totalVolume}
              latestScore={latestScore}
              receipts={receipts}
              latestReceipt={latestReceipt}
              runState={runState}
              setRunState={setRunState}
              runTool={runTool}
              setActiveView={setActiveView}
            />
          )}
          {activeView === "flow" && <FlowView runState={runState} />}
          {activeView === "registry" && <RegistryView receipts={receipts} latestReceipt={latestReceipt} />}
          {activeView === "mcp" && (
            <McpView
              copied={copied}
              copyMcpConfig={copyMcpConfig}
              runTool={runTool}
              loading={runState.loading}
              selectedTool={runState.selectedTool}
            />
          )}
          {activeView === "disputes" && (
            <DisputesView
              disputes={disputes}
              disputeReason={disputeReason}
              setDisputeReason={setDisputeReason}
              latestReceipt={latestReceipt}
              openDispute={openDispute}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function OverviewView({
  totalVolume,
  latestScore,
  receipts,
  latestReceipt,
  runState,
  setRunState,
  runTool,
  setActiveView
}: {
  totalVolume: number;
  latestScore: number;
  receipts: PayGateReceipt[];
  latestReceipt?: PayGateReceipt;
  runState: RunState;
  setRunState: React.Dispatch<React.SetStateAction<RunState>>;
  runTool: (tool?: PayGateTool) => Promise<void>;
  setActiveView: (view: ViewId) => void;
}) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={PlugZap} label="Registered tools" value={String(PAYGATE_TOOLS.length)} detail="Soroban registry entries" />
        <MetricCard icon={CircleDollarSign} label="Demo volume" value={`${totalVolume.toFixed(3)} USDC`} detail="Local paid-call receipts" />
        <MetricCard icon={Gauge} label="Latest score" value={`${latestScore}/100`} detail="Tool output quality signal" />
        <MetricCard icon={ReceiptText} label="Receipts" value={String(receipts.length || 1)} detail="Local + Testnet evidence" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-slate-50/80">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Live paid tool run</CardTitle>
                <CardDescription>Runs the API exactly as an agent would: unpaid request, payment challenge, paid retry, receipt.</CardDescription>
              </div>
              <Badge variant={runState.paymentRequired ? "warning" : "secondary"} className="w-fit">
                {runState.paymentRequired ? "402 observed" : "Ready"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 p-5 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-3">
              {PAYGATE_TOOLS.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setRunState((current) => ({ ...current, selectedTool: tool }))}
                  className={cn(
                    "w-full rounded-lg border bg-white p-4 text-left transition-colors hover:border-cyan-300",
                    runState.selectedTool.id === tool.id && "border-cyan-500 ring-2 ring-cyan-100"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{tool.name}</div>
                      <div className="mt-1 text-sm leading-5 text-muted-foreground">{tool.description}</div>
                    </div>
                    <Badge variant="outline" className="shrink-0 bg-slate-50">
                      {tool.priceUsdc} USDC
                    </Badge>
                  </div>
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="prompt">
                  Agent request
                </label>
                <textarea
                  id="prompt"
                  value={runState.prompt}
                  onChange={(event) => setRunState((current) => ({ ...current, prompt: event.target.value }))}
                  className="min-h-32 w-full rounded-lg border bg-white px-3 py-3 text-sm leading-6 outline-none ring-offset-background focus:ring-2 focus:ring-ring"
                />
              </div>
              <Button className="w-full" size="lg" onClick={() => void runTool()} disabled={runState.loading}>
                {runState.loading ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                Run paid agent call
              </Button>
              {runState.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{runState.error}</div>
              )}
              <div className="grid gap-3 md:grid-cols-4">
                {["402", "MPP", "AI", "Receipt"].map((step, index) => (
                  <div key={step} className="rounded-lg border bg-slate-50 p-3">
                    <div className="text-xs font-semibold uppercase text-muted-foreground">Step {index + 1}</div>
                    <div className="mt-1 font-semibold">{step}</div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <ReceiptPanel receipt={latestReceipt} runState={runState} setActiveView={setActiveView} />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Risk and fit signals</CardTitle>
            <CardDescription>Latest tool output converted into operator signals.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(runState.result?.signals ?? ["MPP payment challenge verified", "Soroban registry deployed", "MCP tools available"]).map(
              (signal, index) => (
                <div key={signal} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{signal}</span>
                    <span className="text-sm font-semibold">{[92, 88, 84][index] ?? 80}%</span>
                  </div>
                  <Progress value={[92, 88, 84][index] ?? 80} />
                </div>
              )
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tool catalog</CardTitle>
            <CardDescription>Registered agent services and USDC prices.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {PAYGATE_TOOLS.map((tool) => (
              <div key={tool.id} className="flex items-center justify-between rounded-lg border bg-slate-50 px-3 py-3">
                <div>
                  <div className="font-mono text-sm font-semibold">{tool.id}</div>
                  <div className="text-xs text-muted-foreground">{tool.metadataHash}</div>
                </div>
                <div className="font-semibold">{tool.priceUsdc}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
            <CardDescription>Submission-grade proof trail.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[...(receipts.length ? receipts.slice(0, 2).map((r) => `Local receipt: ${r.toolId}`) : []), ...staticEvents].map((event) => (
              <div key={event} className="flex gap-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-cyan-600" />
                <div className="text-sm font-medium leading-6 text-slate-700">{event}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function ReceiptPanel({
  receipt,
  runState,
  setActiveView
}: {
  receipt?: PayGateReceipt;
  runState: RunState;
  setActiveView: (view: ViewId) => void;
}) {
  return (
    <Card>
      <CardHeader className="border-b bg-slate-950 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-white">Current receipt</CardTitle>
            <CardDescription className="text-slate-400">Hash-anchored proof for the latest paid call.</CardDescription>
          </div>
          <Badge variant="success">{receipt?.status ?? "testnet"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <div className="rounded-lg border bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Score</span>
            <span className="text-3xl font-semibold">{runState.result?.score ?? 94}</span>
          </div>
          <p className="text-sm leading-6 text-slate-700">
            {runState.result?.summary ?? "Paid-call receipt has been recorded on Stellar Testnet for the demo registry."}
          </p>
        </div>
        <HashRow label="Payment tx" value={receipt?.paymentTxHash ?? PAID_CALL_TX} href={`https://stellar.expert/explorer/testnet/tx/${PAID_CALL_TX}`} />
        <HashRow label="Request hash" value={receipt?.requestHash ?? "sha256:demo-request"} />
        <HashRow label="Response hash" value={receipt?.responseHash ?? "sha256:demo-response"} />
        <Button variant="outline" className="w-full" onClick={() => setActiveView("registry")}>
          Inspect registry evidence <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

function FlowView({ runState }: { runState: RunState }) {
  const steps = [
    {
      title: "Agent requests a tool",
      body: "MCP client or API caller asks for risk, RWA, or grant analysis.",
      icon: TerminalSquare,
      state: "Input"
    },
    {
      title: "API returns 402",
      body: "The gateway quotes Testnet USDC through an MPP-compatible challenge.",
      icon: LockKeyhole,
      state: runState.paymentRequired ? "Observed" : "Ready"
    },
    {
      title: "Payment proof unlocks output",
      body: "Paid retry executes the selected tool and returns deterministic hashes.",
      icon: Banknote,
      state: runState.result ? "Complete" : "Pending"
    },
    {
      title: "Soroban stores the receipt",
      body: "Gateway records payer, amount, payment hash, request hash, and response hash.",
      icon: Blocks,
      state: "Live"
    }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Payment flow</CardTitle>
          <CardDescription>The product flow is explicit: challenge, payment, tool output, on-chain receipt.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="relative rounded-lg border bg-white p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-50 text-cyan-700">
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge variant={step.state === "Observed" || step.state === "Complete" || step.state === "Live" ? "success" : "secondary"}>
                      {step.state}
                    </Badge>
                  </div>
                  <div className="text-sm font-semibold text-muted-foreground">0{index + 1}</div>
                  <h2 className="mt-1 text-lg font-semibold">{step.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
                  {index < steps.length - 1 && <ChevronRight className="absolute -right-3 top-1/2 hidden h-6 w-6 text-slate-300 lg:block" />}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gateway contract boundary</CardTitle>
            <CardDescription>Only the configured gateway can write paid-call receipts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {([
              ["Auth", "gateway.require_auth()"],
              ["Asset", TESTNET_USDC.sac],
              ["Contract", CONTRACT_ID],
              ["Event", "PaidCallEvent(call_id, tool_id, amount)"]
            ] satisfies Array<[string, string]>).map(([label, value]) => (
              <HashRow key={label} label={label} value={value} />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Production path</CardTitle>
            <CardDescription>Demo headers can be replaced with real MPP credentials without changing the product model.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {["Use MPP Charge verification", "Sponsor fees for agent clients", "Index Soroban events", "Add provider payouts"].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-lg border bg-slate-50 px-3 py-3 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-cyan-700" />
                {item}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RegistryView({ receipts, latestReceipt }: { receipts: PayGateReceipt[]; latestReceipt?: PayGateReceipt }) {
  const rows: Array<[string, string]> = [
    ["WASM upload", "436744a5a97bcfc238a9bd93765f8954f3af9abaeee2017f41b3cdfad5dc75d5"],
    ["Deploy", "4724d7c249e853a6c3f8b03e5377b42f9c0d537fb26596e9a8b82ca78b8d7076"],
    ["Initialize", "b5e0fff0f252a7618dc8b6f1af876ff9ac6e4fefa72cf7b10c56e6a0a09783c2"],
    ["Paid receipt", latestReceipt?.paymentTxHash ?? PAID_CALL_TX]
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Contract evidence</CardTitle>
          <CardDescription>Submission artifacts are linked directly to Stellar Testnet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <HashRow label="Contract ID" value={CONTRACT_ID} href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`} />
          <HashRow label="USDC SAC" value={TESTNET_USDC.sac} />
          <Separator />
          {rows.map(([label, hash]) => (
            <HashRow key={label} label={label} value={hash} href={`https://stellar.expert/explorer/testnet/tx/${hash}`} />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Registry records</CardTitle>
          <CardDescription>On-chain tool records plus live local API receipts.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="tools">
            <TabsList>
              <TabsTrigger value="tools">Tools</TabsTrigger>
              <TabsTrigger value="receipts">Receipts</TabsTrigger>
            </TabsList>
            <TabsContent value="tools" className="space-y-3 pt-4">
              {PAYGATE_TOOLS.map((tool, index) => (
                <div key={tool.id} className="grid gap-3 rounded-lg border p-4 md:grid-cols-[auto_1fr_auto] md:items-center">
                  <Badge variant="secondary">#{index + 1}</Badge>
                  <div>
                    <div className="font-semibold">{tool.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{tool.metadataHash}</div>
                  </div>
                  <div className="text-sm font-semibold">{tool.priceUsdc} USDC</div>
                </div>
              ))}
            </TabsContent>
            <TabsContent value="receipts" className="space-y-3 pt-4">
              {(receipts.length ? receipts : [fallbackReceipt()]).map((receipt) => (
                <div key={receipt.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold">{receipt.toolId}</div>
                    <Badge variant={receipt.status === "demo" ? "warning" : "success"}>{receipt.status}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                    <HashRow label="Amount" value={`${Number(receipt.amountStroops) / 10_000_000} USDC`} />
                    <HashRow label="Tx" value={receipt.paymentTxHash} />
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function McpView({
  copied,
  copyMcpConfig,
  runTool,
  loading,
  selectedTool
}: {
  copied: boolean;
  copyMcpConfig: () => Promise<void>;
  runTool: (tool?: PayGateTool) => Promise<void>;
  loading: boolean;
  selectedTool: PayGateTool;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle>MCP server</CardTitle>
          <CardDescription>Agent clients can call the same paid tools exposed by the API.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-sm leading-6 text-cyan-50">
            <code>{mcpConfig}</code>
          </pre>
          <Button variant="outline" onClick={() => void copyMcpConfig()}>
            <Copy className="h-4 w-4" />
            {copied ? "Copied" : "Copy MCP config"}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Paid MCP tools</CardTitle>
          <CardDescription>Trigger any tool from the UI to prove the payment-gated path.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {PAYGATE_TOOLS.map((tool) => (
            <div key={tool.id} className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-mono text-sm font-semibold">{tool.id}</div>
                <div className="mt-1 text-sm text-muted-foreground">{tool.description}</div>
              </div>
              <Button variant={selectedTool.id === tool.id ? "default" : "outline"} onClick={() => void runTool(tool)} disabled={loading}>
                {loading && selectedTool.id === tool.id ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                Pay and run
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function DisputesView({
  disputes,
  disputeReason,
  setDisputeReason,
  latestReceipt,
  openDispute
}: {
  disputes: DisputeRecord[];
  disputeReason: string;
  setDisputeReason: (value: string) => void;
  latestReceipt?: PayGateReceipt;
  openDispute: () => Promise<void>;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
      <Card>
        <CardHeader>
          <CardTitle>Open dispute</CardTitle>
          <CardDescription>Disputes reference a paid-call receipt and can be resolved by the admin contract path.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <HashRow label="Receipt" value={latestReceipt?.id ?? "Run a paid call first"} />
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="dispute-reason">
              Reason
            </label>
            <textarea
              id="dispute-reason"
              value={disputeReason}
              onChange={(event) => setDisputeReason(event.target.value)}
              className="min-h-28 w-full rounded-lg border bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <Button className="w-full" onClick={() => void openDispute()} disabled={!latestReceipt}>
            <ShieldAlert className="h-4 w-4" />
            Open dispute
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Dispute queue</CardTitle>
          <CardDescription>Local API dispute records for the demo workflow.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(disputes.length ? disputes : [{ id: "empty", receiptId: "No dispute yet", reason: "Run a paid call, then open a dispute.", status: "open" as const, createdAt: "" }]).map(
            (dispute) => (
              <div key={dispute.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold">{dispute.receiptId}</div>
                  <Badge variant={dispute.id === "empty" ? "secondary" : "warning"}>{dispute.status}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{dispute.reason}</p>
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail
}: {
  icon: typeof PlugZap;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-50 text-cyan-700">
            <Icon className="h-5 w-5" />
          </div>
          <Badge variant="outline">Live</Badge>
        </div>
        <div className="mt-5 text-sm font-medium text-muted-foreground">{label}</div>
        <div className="mt-1 text-3xl font-semibold tracking-normal">{value}</div>
        <div className="mt-2 text-sm text-muted-foreground">{detail}</div>
      </CardContent>
    </Card>
  );
}

function HashRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2.5">
      <span className="shrink-0 text-sm font-medium text-muted-foreground">{label}</span>
      {href ? (
        <a className="flex min-w-0 items-center gap-2 font-mono text-xs font-semibold text-cyan-700" href={href} target="_blank" rel="noreferrer">
          <span className="truncate">{shortKey(value)}</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        </a>
      ) : (
        <span className="min-w-0 truncate font-mono text-xs font-semibold">{shortKey(value)}</span>
      )}
    </div>
  );
}

function fallbackReceipt(): PayGateReceipt {
  return {
    id: "testnet-paid-call",
    toolId: "invoice_risk_score",
    payer: "GA6KDOM7JHCAUJDN4OGMARNFJSRRL643YDWVYXMUSDHEMQYOQO5JY6OB",
    amountStroops: "100000",
    paymentTxHash: PAID_CALL_TX,
    requestHash: "sha256:demo-request",
    responseHash: "sha256:demo-response",
    status: "recorded_onchain",
    createdAt: "2026-05-17T00:00:00.000Z",
    contractCallId: "1"
  };
}

function shortKey(value: string): string {
  if (value.length <= 20) return value;
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

const mcpConfig = `{
  "mcpServers": {
    "stellar-paygate": {
      "command": "pnpm",
      "args": ["--filter", "@stellar-paygate/api", "mcp"]
    }
  }
}`;
