import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Activity,
  Copy,
  Check,
  ArrowRight,
  Rocket,
  Terminal,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { generateApiKey } from "@/api/tenant.api";
import { setEnvId } from "@/store/slices/authSlice";

/**
 * Onboarding page for first-time users.
 * Guides through API key generation + integration quick start.
 */
export default function Onboarding() {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  const envId = user?.env_id;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const newEnvId = await generateApiKey();
      dispatch(setEnvId(newEnvId));
    } catch {
      setError("Failed to generate API key. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(envId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Decorative blurs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 size-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 size-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-2xl relative animate-in fade-in slide-in-from-bottom-6 duration-700">
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="size-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
            <Rocket className="size-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome to Antigravity
          </h1>
          <p className="text-muted-foreground mt-2 text-center max-w-md">
            Set up your API monitoring in under a minute. Generate an API key,
            install our SDK, and start tracking.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-6">
          {/* Step 1: Generate API Key */}
          <Card className="border-none shadow-xl bg-card/80 backdrop-blur-xl">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-primary font-bold text-sm">1</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">
                    Generate your API Key
                  </h3>
                  <p className="text-muted-foreground text-sm mt-1 mb-4">
                    This key identifies your account when sending telemetry
                    data.
                  </p>

                  {!envId ? (
                    <div className="space-y-2">
                      <Button
                        onClick={handleGenerate}
                        disabled={loading}
                        className="gap-2"
                      >
                        <Activity className="size-4" />
                        {loading ? "Generating..." : "Generate API Key"}
                      </Button>
                      {error && (
                        <p className="text-destructive text-sm">{error}</p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <code className="flex-1 bg-muted px-4 py-2.5 rounded-lg text-sm font-mono break-all">
                        {envId}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleCopy}
                        className="shrink-0"
                      >
                        {copied ? (
                          <Check className="size-4 text-emerald-500" />
                        ) : (
                          <Copy className="size-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 2: Install SDK */}
          <Card
            className={`border-none shadow-xl transition-opacity duration-300 ${envId ? "bg-card/80 backdrop-blur-xl" : "opacity-40 pointer-events-none bg-card/50"}`}
          >
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-primary font-bold text-sm">2</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Package className="size-4" /> Install the SDK
                  </h3>
                  <p className="text-muted-foreground text-sm mt-1 mb-4">
                    Add our lightweight monitoring package to your Node.js
                    project.
                  </p>
                  <pre className="bg-muted rounded-lg p-4 text-sm font-mono overflow-x-auto">
                    <code>npm install @antigravity/monitor</code>
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 3: Send First Event */}
          <Card
            className={`border-none shadow-xl transition-opacity duration-300 ${envId ? "bg-card/80 backdrop-blur-xl" : "opacity-40 pointer-events-none bg-card/50"}`}
          >
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-primary font-bold text-sm">3</span>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Terminal className="size-4" /> Send your first event
                  </h3>
                  <p className="text-muted-foreground text-sm mt-1 mb-4">
                    Initialize the monitor with your API key and start tracking.
                  </p>
                  <pre className="bg-muted rounded-lg p-4 text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                    <code>{`import { AntigravityMonitor } from "@antigravity/monitor";

const monitor = new AntigravityMonitor({
  apiKey: "${envId || "YOUR_API_KEY"}",
  service: "my-api",
  environment: "production",
});

// Automatically tracks Express/Fastify routes
app.use(monitor.middleware());`}</code>
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CTA */}
        {envId && (
          <div className="mt-8 flex justify-center animate-in fade-in slide-in-from-bottom-4">
            <Button
              size="lg"
              className="gap-2 px-8"
              onClick={() => navigate("/", { replace: true })}
            >
              Go to Dashboard
              <ArrowRight className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
