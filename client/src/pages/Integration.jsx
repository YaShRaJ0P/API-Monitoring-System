import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  Copy,
  Check,
  RefreshCw,
  Key,
  Terminal,
  Package,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { generateApiKey } from "@/api/tenant.api";
import { setEnvId } from "@/store/slices/authSlice";

/**
 * Integration page — API key management + SDK/cURL docs.
 */
export default function Integration() {
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const envId = user?.env_id || "No API key generated";
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1";

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const newKey = await generateApiKey();
      dispatch(setEnvId(newKey));
    } finally {
      setRegenerating(false);
    }
  };

  const curlExample = `curl -X POST ${apiUrl}/ingest \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${envId}" \\
  -d '{
    "event_id": "550e8400-e29b-41d4-a716-446655440000",
    "tenant_id": "${user?.id || "YOUR_TENANT_ID"}",
    "endpoint": "/api/users",
    "method": "GET",
    "status": 200,
    "latency": 45.2,
    "timestamp": "${new Date().toISOString()}",
    "environment": "production",
    "service": "user-service",
    "error": null
  }'`;

  const sdkExample = `import { AntigravityMonitor } from "@antigravity/monitor";

const monitor = new AntigravityMonitor({
  apiKey: "${envId}",
  service: "my-api",
  environment: "production",
});

// Express middleware — auto-captures every request
app.use(monitor.middleware());`;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integration</h1>
        <p className="text-muted-foreground mt-1">
          Manage your API key and integrate monitoring into your services.
        </p>
      </div>

      {/* API Key Card */}
      <Card className="border-none shadow-lg bg-card/80 backdrop-blur-xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="size-5 text-primary" />
            API Key
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <code className="flex-1 bg-muted px-4 py-3 rounded-lg text-sm font-mono break-all select-all">
              {envId}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleCopy(envId)}
              className="shrink-0"
            >
              {copied ? (
                <Check className="size-4 text-emerald-500" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0">
                  <RefreshCw
                    className={`size-4 ${regenerating ? "animate-spin" : ""}`}
                  />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Regenerate API Key?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will invalidate your current key. All services using
                    the old key will stop sending data until updated.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRegenerate}>
                    Regenerate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Include this key as the{" "}
            <code className="bg-muted px-1 rounded">x-api-key</code> header in
            all requests to the ingestion endpoint.
          </p>
        </CardContent>
      </Card>

      {/* Quick Start */}
      <Card className="border-none shadow-lg bg-card/80 backdrop-blur-xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Quick Start</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="sdk" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="sdk" className="gap-2">
                <Package className="size-3.5" /> NPM SDK
              </TabsTrigger>
              <TabsTrigger value="curl" className="gap-2">
                <Terminal className="size-3.5" /> cURL
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sdk">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">
                    1. Install the package
                  </p>
                  <pre className="bg-muted rounded-lg p-4 text-sm font-mono overflow-x-auto">
                    <code>npm install @antigravity/monitor</code>
                  </pre>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">
                    2. Initialize & attach middleware
                  </p>
                  <pre className="bg-muted rounded-lg p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                    <code>{sdkExample}</code>
                  </pre>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="curl">
              <div>
                <p className="text-sm font-medium mb-2">Send a test event</p>
                <pre className="bg-muted rounded-lg p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                  <code>{curlExample}</code>
                </pre>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Payload Reference */}
      <Card className="border-none shadow-lg bg-card/80 backdrop-blur-xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Payload Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left p-3 font-medium">Field</th>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-left p-3 font-medium">Required</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  [
                    "event_id",
                    "UUID v4",
                    "Yes",
                    "Unique identifier for this event",
                  ],
                  [
                    "tenant_id",
                    "UUID v4",
                    "Yes",
                    "Your tenant ID (auto-set by SDK)",
                  ],
                  [
                    "endpoint",
                    "string",
                    "Yes",
                    "API endpoint path (e.g. /api/users)",
                  ],
                  ["method", "string", "Yes", "HTTP method (GET, POST, etc.)"],
                  ["status", "number", "Yes", "HTTP status code (100–599)"],
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
                    "Error message if status >= 400",
                  ],
                ].map(([field, type, required, desc]) => (
                  <tr
                    key={field}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="p-3">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {field}
                      </code>
                    </td>
                    <td className="p-3 text-muted-foreground">{type}</td>
                    <td className="p-3">
                      <span
                        className={`text-xs font-medium ${required === "Yes" ? "text-primary" : "text-muted-foreground"}`}
                      >
                        {required}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell">
                      {desc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
