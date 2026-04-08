import { useState } from "react";
import { useSelector } from "react-redux";
import { Copy, Check, Key, ExternalLink, Settings } from "lucide-react";
import { useParams } from "react-router-dom";
import { cn } from "@/lib/utils";

/**
 * Integration page - SDK quick-start guide, and payload reference.
 */
export default function Integration() {
  const [copied, setCopied] = useState(null);
  const { projects, activeProjectId } = useSelector((state) => state.auth);
  const { projectName: projectSlug } = useParams();

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const apiKey = activeProject?.api_key || "YOUR_API_KEY";
  const apiSecret = activeProject?.api_secret || "YOUR_API_SECRET";

  const handleCopy = (key, text) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const sdkExample = `import { MonitoAPI } from "monito-api";

const monito = new MonitoAPI({
  apiKey: "${apiKey}",
  apiSecret: "${apiSecret}",
  environment: "production",
});

// 1. Initialize globally
app.use(monito.init());

// 2. Tag your routers
app.use("/api/users", monito.service("user-service"), usersRouter);`;

  const cardCls =
    "relative rounded-2xl bg-[#111118] border border-white/5 overflow-hidden";

  const CodeBlock = ({ code, copyKey }) => (
    <div className="relative group">
      <pre className="bg-[#0a0a10] border border-white/5 rounded-xl p-4 text-xs mono text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
        <code>{code}</code>
      </pre>
      <button
        onClick={() => handleCopy(copyKey, code)}
        className="absolute top-3 right-3 size-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-500 hover:text-slate-200 transition-all opacity-0 group-hover:opacity-100"
      >
        {copied === copyKey ? (
          <Check className="size-3.5 text-emerald-400" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Integration
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Integrate the monitoring SDK or send events via HTTP.
          </p>
        </div>
        <a
          href={`/${projectSlug}/settings`}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors border border-white/10 rounded-xl px-3 py-2 hover:border-cyan-400/20"
        >
          <Settings className="size-3.5" />
          Manage Projects &amp; API Keys
          <ExternalLink className="size-3" />
        </a>
      </div>

      {/* API Key and Secret panel */}
      {activeProject && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={cardCls}>
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-cyan-400/40 to-transparent" />
            <div className="p-4 flex items-center gap-3">
              <div className="size-9 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center shrink-0">
                <Key className="size-4 text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500 mb-1">
                  API Key for{" "}
                  <span className="text-slate-300 font-medium">
                    {activeProject.name}
                  </span>
                </p>
                <code className="text-xs mono text-cyan-300 break-all select-all">
                  {apiKey}
                </code>
              </div>
              <button
                onClick={() => handleCopy("apikey", apiKey)}
                title="Copy API key"
                className="size-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-slate-500 hover:text-cyan-400 transition-all shrink-0"
              >
                {copied === "apikey" ? (
                  <Check className="size-3.5 text-emerald-400" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </button>
            </div>
          </div>
          <div className={cardCls}>
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-rose-400/40 to-transparent" />
            <div className="p-4 flex items-center gap-3">
              <div className="size-9 rounded-xl bg-rose-400/10 border border-rose-400/20 flex items-center justify-center shrink-0">
                <Key className="size-4 text-rose-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500 mb-1">
                  API Secret (Keep hidden!)
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-xs mono text-rose-300 truncate max-w-[120px] select-all relative group">
                    <span className="blur-sm group-hover:blur-none transition-all">
                      {apiSecret}
                    </span>
                  </code>
                </div>
              </div>
              <button
                onClick={() => handleCopy("apisecret", apiSecret)}
                title="Copy API secret"
                className="size-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-slate-500 hover:text-rose-400 transition-all shrink-0"
              >
                {copied === "apisecret" ? (
                  <Check className="size-3.5 text-emerald-400" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Start */}
      <div className={cardCls}>
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-violet-400/30 to-transparent" />
        <div className="p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Quick Start</h2>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">
                1. Install the package
              </p>
              <CodeBlock code="npm install monito-api" copyKey="install" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 mb-2">
                2. Initialize &amp; attach middleware
              </p>
              <CodeBlock code={sdkExample} copyKey="sdk" />
            </div>
          </div>
        </div>
      </div>

      {/* Payload Reference */}
      <div className={cardCls}>
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />
        <div className="p-5">
          <h2 className="text-sm font-semibold text-white mb-4">
            Payload Reference
          </h2>
          <div className="rounded-xl border border-white/5 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-white/3 border-b border-white/5">
                  <th className="text-left p-3 font-medium text-slate-500 uppercase tracking-wider">
                    Field
                  </th>
                  <th className="text-left p-3 font-medium text-slate-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="text-left p-3 font-medium text-slate-500 uppercase tracking-wider">
                    Required
                  </th>
                  <th className="text-left p-3 font-medium text-slate-500 uppercase tracking-wider hidden md:table-cell">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    "event_id",
                    "UUID v4",
                    "Auto",
                    "Unique identifier (auto-set by SDK)",
                  ],
                  [
                    "tenant_id",
                    "UUID v4",
                    "Auto",
                    "Your tenant ID (auto-set by server)",
                  ],
                  [
                    "project_id",
                    "UUID v4",
                    "Auto",
                    "Project ID (auto-set by server)",
                  ],
                  [
                    "endpoint",
                    "string",
                    "Yes",
                    "API endpoint path (e.g. /api/users)",
                  ],
                  ["method", "string", "Yes", "HTTP method (GET, POST, etc.)"],
                  ["status", "number", "Yes", "HTTP status code (100-500)"],
                  ["latency", "number", "Yes", "Response time in milliseconds"],
                  ["timestamp", "ISO 8601", "Yes", "When the request occurred"],
                  [
                    "environment",
                    "string",
                    "Yes",
                    "Environment name (production, staging, dev)",
                  ],
                  ["service", "string", "Yes", "Service/app name"],
                  [
                    "error",
                    "string | null",
                    "No",
                    "Error message if status ≥ 400",
                  ],
                ].map(([field, type, required, desc]) => (
                  <tr
                    key={field}
                    className="border-b border-white/5 hover:bg-white/3 transition-colors"
                  >
                    <td className="p-3">
                      <code className="mono bg-white/5 px-1.5 py-0.5 rounded text-slate-300">
                        {field}
                      </code>
                    </td>
                    <td className="p-3 text-slate-500">{type}</td>
                    <td className="p-3">
                      <span
                        className={cn(
                          "badge",
                          required === "Yes"
                            ? "badge-cyan"
                            : required === "Auto"
                              ? "badge-green"
                              : "badge-muted",
                        )}
                      >
                        {required}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500 hidden md:table-cell">
                      {desc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
