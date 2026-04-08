import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import {
  Zap,
  ShieldCheck,
  Server,
  Activity,
  Trash2,
  ArrowRight,
  Loader2,
  Clock,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

const API_BASE = import.meta.env.VITE_APP_SERVER_URI;

//  Helpers

const cx = (...args) => args.filter(Boolean).join(" ");

const statusColor = (code) => {
  if (code === 0) return { bg: "bg-slate-500/15", text: "text-slate-400" };
  if (code < 300) return { bg: "bg-green-500/15", text: "text-green-400" };
  if (code < 400) return { bg: "bg-blue-500/15", text: "text-blue-400" };
  if (code < 500) return { bg: "bg-amber-500/15", text: "text-amber-400" };
  return { bg: "bg-rose-500/15", text: "text-rose-400" };
};

const methodColor = {
  GET: "text-sky-400",
  POST: "text-violet-400",
  PUT: "text-amber-400",
  PATCH: "text-orange-400",
  DELETE: "text-rose-400",
};

//  Root

export default function App() {
  const [phase, setPhase] = useState("loading"); // loading | setup | ready
  const [logs, setLogs] = useState([]);
  const [bursting, setBursting] = useState(null); // null | service-name | "all"
  const [setup, setSetup] = useState({
    apiKey: "",
    apiSecret: "",
    monitorUrl: import.meta.env.VITE_APP_BASE_URI,
  });
  const [setupErr, setSetupErr] = useState("");
  const [setupBusy, setSetupBusy] = useState(false);
  const logsEndRef = useRef(null);

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    try {
      const { data } = await axios.get(`${API_BASE}/health`, {
        withCredentials: true,
      });
      setPhase(data.configured ? "ready" : "setup");
    } catch {
      setPhase("setup");
    }
  };

  const addLog = useCallback((entry) => {
    setLogs((prev) =>
      [
        {
          ...entry,
          id: Math.random().toString(36).substr(2, 9),
          ts: new Date().toLocaleTimeString(),
        },
        ...prev,
      ].slice(0, 100),
    );
  }, []);

  const fireRequest = useCallback(
    async (service, method, path, body = null) => {
      const start = Date.now();
      try {
        const res = await axios({
          method,
          url: `${API_BASE}${path}`,
          data: body,
          withCredentials: true,
          validateStatus: () => true,
        });
        addLog({
          service,
          method,
          path,
          status: res.status,
          latency: Date.now() - start,
        });
      } catch (err) {
        addLog({
          service,
          method,
          path,
          status: 0,
          latency: Date.now() - start,
        });
      }
    },
    [addLog],
  );

  const runBurst = useCallback(
    async (service, count = 20) => {
      const endpointsByService = {
        "auth-service": [
          { m: "GET", p: "/api/auth/profile" },
          { m: "POST", p: "/api/auth/login", b: { email: "user@demo.com" } },
          { m: "POST", p: "/api/auth/login", b: { email: "error@demo.com" } },
          { m: "POST", p: "/api/auth/logout" },
        ],
        "billing-api": [
          { m: "GET", p: "/api/billing/invoices" },
          { m: "GET", p: "/api/billing/plan" },
          { m: "POST", p: "/api/billing/charge" },
          { m: "GET", p: "/api/data/slow-query" },
        ],
        "inventory-db": [
          { m: "GET", p: "/api/data/stats" },
          { m: "GET", p: "/api/echo" },
          { m: "GET", p: "/api/data/crash" },
          { m: "GET", p: "/api/data/not-found" },
        ],
      };
      const pool =
        endpointsByService[service] || endpointsByService["auth-service"];
      for (let i = 0; i < count; i++) {
        const ep = pool[Math.floor(Math.random() * pool.length)];
        fireRequest(service, ep.m, ep.p, ep.b ?? null);
        await new Promise((r) => setTimeout(r, 80));
      }
    },
    [fireRequest],
  );

  const handleBurst = useCallback(
    async (service) => {
      if (bursting) return;
      setBursting(service);
      await runBurst(service, 15);
      setBursting(null);
    },
    [bursting, runBurst],
  );

  const handleAllBurst = useCallback(async () => {
    if (bursting) return;
    setBursting("all");
    await Promise.all([
      runBurst("auth-service", 10),
      runBurst("billing-api", 10),
      runBurst("inventory-db", 10),
    ]);
    setBursting(null);
  }, [bursting, runBurst]);

  const handleSaveConfig = async () => {
    setSetupErr("");
    if (!setup.apiKey.trim() || !setup.apiSecret.trim()) {
      return setSetupErr("API Key and Secret are required.");
    }
    if (!setup.monitorUrl.trim().startsWith("http")) {
      return setSetupErr("Monitor URL must start with http:// or https://");
    }
    setSetupBusy(true);
    try {
      await axios.post(`${API_BASE}/config`, setup, { withCredentials: true });
      setPhase("ready");
    } catch {
      setSetupErr(
        "Could not reach the demo server. Make sure it's running on port 4000.",
      );
    } finally {
      setSetupBusy(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Clear all credentials and reset the session?")) return;
    await axios.post(`${API_BASE}/config/reset`, {}, { withCredentials: true });
    setLogs([]);
    setPhase("setup");
  };

  //  Screens

  if (phase === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
        <Loader2 className="size-7 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (phase === "setup") {
    return (
      <SetupScreen
        setup={setup}
        setSetup={setSetup}
        onSave={handleSaveConfig}
        err={setupErr}
        busy={setupBusy}
      />
    );
  }

  return (
    <MainScreen
      logs={logs}
      setLogs={setLogs}
      setup={setup}
      bursting={bursting}
      logsEndRef={logsEndRef}
      onReset={handleReset}
      onFire={fireRequest}
      onBurst={handleBurst}
      onAllBurst={handleAllBurst}
    />
  );
}

//  Setup Screen

function SetupScreen({ setup, setSetup, onSave, err, busy }) {
  const field = (label, key, type = "text", placeholder = "") => (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-0.5">
        {label}
      </label>
      <input
        type={type}
        className="w-full bg-black/40 border border-white/8 focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/15 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition-all"
        placeholder={placeholder}
        value={setup[key]}
        onChange={(e) => setSetup((s) => ({ ...s, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#09090b] relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/8 blur-[120px] -mr-48 -mt-48 rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-cyan-600/8 blur-[120px] -ml-48 -mb-48 rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex p-2 rounded-2xl bg-indigo-500/10 text-indigo-400 mb-4">
            <img src="./logo.svg" className="size-12" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Monito Demo
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Connect your monitoring dashboard to simulate live API traffic.
          </p>
        </div>

        <div className="bg-[#111118]/80 backdrop-blur-xl border border-white/6 rounded-2xl p-7 shadow-2xl space-y-4">
          {field("API Key", "apiKey", "text", "24bbf1de-...")}
          {field("API Secret", "apiSecret", "password", "••••••••••••")}
          {field("Monitor URL", "monitorUrl", "text", "http://localhost:3000")}

          {err && (
            <div className="flex items-start gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2.5">
              <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
              {err}
            </div>
          )}

          <button
            onClick={onSave}
            disabled={busy}
            className="w-full bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-4 py-3 text-sm transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.98] flex items-center justify-center gap-2 mt-1"
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Connecting…
              </>
            ) : (
              <>
                <span>Initialize Monitor</span>
                <ArrowRight className="size-4" />
              </>
            )}
          </button>

          <p className="text-[11px] text-slate-600 text-center pt-2 border-t border-white/5">
            Find your keys in the{" "}
            <strong className="text-slate-500">Monito Dashboard</strong> →
            Integrations.
          </p>
        </div>
      </div>
    </div>
  );
}

//  Main Screen

function MainScreen({
  logs,
  setLogs,
  setup,
  bursting,
  logsEndRef,
  onReset,
  onFire,
  onBurst,
  onAllBurst,
}) {
  return (
    <div className="min-h-screen bg-[#09090b] text-slate-400 flex flex-col">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Activity className="size-4" />
            </div>
            <span className="text-sm font-bold text-white tracking-tight">
              MONITO <span className="text-indigo-400">DEMO</span>
            </span>
            <div className="flex items-center gap-1.5 text-[10px] ml-1">
              <div className="size-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-slate-500">
                {setup.apiKey
                  ? setup.apiKey.substring(0, 10) + "…"
                  : "connected"}
              </span>
            </div>
          </div>
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-medium transition-all text-slate-400 hover:text-white"
          >
            <RefreshCw className="size-3" /> Reset Session
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        {/* Left panel */}
        <div className="lg:col-span-8 space-y-6 overflow-y-auto">
          <div>
            <SectionLabel>Mock Services</SectionLabel>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
              <ServiceCard
                title="Auth Service"
                icon={<ShieldCheck className="size-4" />}
                color="indigo"
                onBurst={() => onBurst("auth-service")}
                bursting={bursting === "auth-service" || bursting === "all"}
              >
                <Btn
                  label="GET  /auth/profile"
                  onClick={() =>
                    onFire("auth-service", "GET", "/api/auth/profile")
                  }
                />
                <Btn
                  label="POST /auth/login"
                  onClick={() =>
                    onFire("auth-service", "POST", "/api/auth/login", {
                      email: "user@demo.com",
                    })
                  }
                />
                <Btn
                  label="POST /auth/login → 401"
                  onClick={() =>
                    onFire("auth-service", "POST", "/api/auth/login", {
                      email: "error@demo.com",
                    })
                  }
                  variant="err"
                />
                <Btn
                  label="POST /auth/logout"
                  onClick={() =>
                    onFire("auth-service", "POST", "/api/auth/logout")
                  }
                />
              </ServiceCard>

              <ServiceCard
                title="Billing API"
                icon={<Zap className="size-4" />}
                color="cyan"
                onBurst={() => onBurst("billing-api")}
                bursting={bursting === "billing-api" || bursting === "all"}
              >
                <Btn
                  label="GET  /billing/invoices"
                  onClick={() =>
                    onFire("billing-api", "GET", "/api/billing/invoices")
                  }
                />
                <Btn
                  label="GET  /billing/plan"
                  onClick={() =>
                    onFire("billing-api", "GET", "/api/billing/plan")
                  }
                />
                <Btn
                  label="POST /billing/charge"
                  onClick={() =>
                    onFire("billing-api", "POST", "/api/billing/charge")
                  }
                />
                <Btn
                  label="GET  /data/slow-query"
                  onClick={() =>
                    onFire("billing-api", "GET", "/api/data/slow-query")
                  }
                  variant="warning"
                />
              </ServiceCard>

              <ServiceCard
                title="Inventory DB"
                icon={<Server className="size-4" />}
                color="amber"
                onBurst={() => onBurst("inventory-db")}
                bursting={bursting === "inventory-db" || bursting === "all"}
              >
                <Btn
                  label="GET  /data/stats"
                  onClick={() =>
                    onFire("inventory-db", "GET", "/api/data/stats")
                  }
                />
                <Btn
                  label="ALL  /api/echo"
                  onClick={() => onFire("inventory-db", "GET", "/api/echo")}
                />
                <Btn
                  label="GET  /data/not-found"
                  onClick={() =>
                    onFire("inventory-db", "GET", "/api/data/not-found")
                  }
                  variant="warning"
                />
                <Btn
                  label="GET  /data/crash → 500"
                  onClick={() =>
                    onFire("inventory-db", "GET", "/api/data/crash")
                  }
                  variant="err"
                />
              </ServiceCard>
            </div>
          </div>

          {/* Chaos panel */}
          <div className="bg-white/2 border border-white/6 rounded-2xl p-5">
            <h4 className="text-xs font-bold text-white mb-0.5">
              Global Chaos Burst
            </h4>
            <p className="text-[11px] text-slate-600 mb-4">
              Fire 30 mixed requests across all services simultaneously - ideal
              for stress-testing dashboard ingestion.
            </p>
            <button
              onClick={onAllBurst}
              disabled={!!bursting}
              className={cx(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95",
                bursting
                  ? "bg-white/5 text-slate-500 cursor-not-allowed"
                  : "bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/20",
              )}
            >
              {bursting === "all" ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Bursting all
                  services…
                </>
              ) : (
                "Fire 30 Multi-Service Requests"
              )}
            </button>
          </div>
        </div>

        {/* Right panel: log feed */}
        <div className="lg:col-span-4 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>Live Event Log</SectionLabel>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-600">
                {logs.length} events
              </span>
              <button
                onClick={() => setLogs([])}
                className="p-1 hover:text-rose-400 transition-colors"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 bg-[#111118] border border-white/5 rounded-2xl overflow-y-auto min-h-[400px] max-h-[calc(100vh-200px)]">
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center opacity-25 select-none">
                <Clock className="size-7 mb-2" />
                <p className="text-xs leading-relaxed">
                  No events captured yet.
                  <br />
                  Click any button to start.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/4">
                {logs.map((log) => (
                  <LogEntry key={log.id} log={log} />
                ))}
              </div>
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </main>
    </div>
  );
}

//  Sub-components

function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">
      {children}
    </p>
  );
}

function ServiceCard({ title, icon, children, color, onBurst, bursting }) {
  const accent = {
    indigo: "text-indigo-400 bg-indigo-500/10",
    cyan: "text-cyan-400 bg-cyan-500/10",
    amber: "text-amber-400 bg-amber-500/10",
  };
  return (
    <div className="bg-[#111118]/60 border border-white/8 rounded-2xl p-4 flex flex-col hover:border-white/14 transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className={cx("p-2 rounded-xl", accent[color])}>{icon}</div>
        <button
          onClick={onBurst}
          disabled={bursting}
          className="text-[9px] font-bold uppercase tracking-widest text-slate-600 hover:text-indigo-400 disabled:text-slate-700 transition-colors flex items-center gap-1"
        >
          {bursting ? (
            <>
              <Loader2 className="size-2.5 animate-spin" />
              Bursting
            </>
          ) : (
            "Simulate Load"
          )}
        </button>
      </div>
      <h4 className="text-xs font-bold text-white mb-3">{title}</h4>
      <div className="space-y-1.5 grow">{children}</div>
    </div>
  );
}

function Btn({ label, onClick, variant = "default" }) {
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    if (busy) return;
    setBusy(true);
    await onClick();
    setBusy(false);
  };

  const base =
    "w-full text-left px-2.5 py-1.5 rounded-lg border text-[10px] font-mono font-medium transition-all flex items-center justify-between gap-2 group/btn";
  const styles = {
    default:
      "border-white/5 hover:bg-white/5 hover:text-white hover:border-white/10",
    err: "border-rose-500/10 hover:bg-rose-500/8 hover:text-rose-400",
    warning: "border-amber-500/10 hover:bg-amber-500/8 hover:text-amber-400",
  };

  return (
    <button onClick={handle} className={cx(base, styles[variant])}>
      <span className="truncate">{label}</span>
      {busy ? (
        <Loader2 className="size-2.5 animate-spin shrink-0 opacity-50" />
      ) : (
        <ChevronRight className="size-2.5 shrink-0 opacity-0 group-hover/btn:opacity-60 transition-opacity" />
      )}
    </button>
  );
}

function LogEntry({ log }) {
  const sc = statusColor(log.status);
  const mc = methodColor[log.method] || "text-slate-400";

  return (
    <div className="px-4 py-3 hover:bg-white/1.5 transition-colors">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span
            className={cx(
              "text-[9px] px-1.5 py-0.5 rounded font-bold font-mono",
              sc.bg,
              sc.text,
            )}
          >
            {log.status === 0 ? "ERR" : log.status}
          </span>
          <span className={cx("text-[9px] font-bold font-mono uppercase", mc)}>
            {log.method}
          </span>
        </div>
        <span className="text-[9px] text-slate-700 font-mono">{log.ts}</span>
      </div>
      <p
        className="text-[10px] font-mono text-slate-300 truncate mb-1"
        title={log.path}
      >
        {log.path}
      </p>
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-indigo-400 font-semibold">
          {log.service}
        </span>
        <span
          className={cx(
            "text-[9px] font-mono",
            log.latency > 1000 ? "text-amber-500" : "text-slate-600",
          )}
        >
          {log.latency}ms
        </span>
      </div>
    </div>
  );
}
