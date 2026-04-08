import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  Inbox,
  Server,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  Wifi,
  Loader2,
  FlaskConical,
  RotateCcw,
  Database,
  Skull,
  CircleDot,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import * as adminApi from "@/api/admin.api";

// ----- Helpers ---------------------

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

// ----- Sub-components -----------

/** Badge reflecting RabbitMQ connection state */
function RmqStatusBadge({ status }) {
  if (!status) return <Skeleton className="h-5 w-20 inline-block" />;
  const map = {
    connected: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    connecting: "bg-amber-500/15  text-amber-400  border-amber-500/20",
    disconnected: "bg-red-500/15    text-red-400    border-red-500/20",
  };
  return (
    <Badge
      variant="outline"
      className={`text-[10px] uppercase h-5 font-medium tracking-wide ${map[status] ?? ""}`}
    >
      {status}
    </Badge>
  );
}

/** Badge reflecting opossum circuit state */
function CircuitStateBadge({ state }) {
  if (!state) return <Skeleton className="h-5 w-20 inline-block" />;
  const map = {
    closed: {
      cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
      label: "CLOSED ✓",
    },
    halfOpen: {
      cls: "bg-amber-500/15  text-amber-400  border-amber-500/20",
      label: "HALF-OPEN ⚡",
    },
    open: {
      cls: "bg-red-500/15    text-red-400    border-red-500/20",
      label: "OPEN ✗",
    },
    unknown: {
      cls: "bg-zinc-500/15   text-zinc-400   border-zinc-500/20",
      label: "UNKNOWN",
    },
  };
  const { cls, label } = map[state] ?? map.unknown;
  return (
    <Badge
      variant="outline"
      className={`text-[10px] uppercase h-5 font-medium tracking-wide ${cls}`}
    >
      {label}
    </Badge>
  );
}

/** One stat tile in the circuit dashboard */
function CircuitStat({ icon: Icon, label, value, color, loading }) {
  return (
    <div className="flex flex-col gap-1 p-3 rounded-xl bg-muted/30 border border-border/40">
      <div
        className={`flex items-center gap-1.5 text-xs text-muted-foreground`}
      >
        <Icon className={`size-3.5 ${color}`} />
        {label}
      </div>
      {loading ? (
        <Skeleton className="h-6 w-12" />
      ) : (
        <p className={`text-xl font-bold ${color}`}>{value ?? "-"}</p>
      )}
    </div>
  );
}

// ----- Main Component -----------

export default function OverviewTab() {
  const queryClient = useQueryClient();

  // -- Queries ----------------

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-system-stats"],
    queryFn: adminApi.getSystemStats,
    refetchInterval: 30_000,
  });

  const { data: circuitStats, isLoading: circuitLoading } = useQuery({
    queryKey: ["admin-circuit-stats"],
    queryFn: adminApi.getCircuitStats,
    // Poll aggressively when in simulation mode or circuit isn't closed
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) return 5_000;
      if (d.simulationMode || d.circuitState !== "closed") return 3_000;
      return 10_000;
    },
  });

  const isSimulating = circuitStats?.simulationMode ?? false;
  const circuitState = circuitStats?.circuitState ?? "unknown";
  const rabbitmqStatus = circuitStats?.rabbitmqStatus ?? "disconnected";
  const bufferCount = circuitStats?.bufferCount ?? 0;
  const deadBufferCount = circuitStats?.deadBufferCount ?? 0;

  // -- Mutations ---------------

  const downMutation = useMutation({
    mutationFn: adminApi.rabbitMqDown,
    onSuccess: () => {
      toast.warning(
        "RabbitMQ disconnected. Simulation mode ON - auto-reconnect suppressed.",
        {
          description:
            "Send API hits now. Watch the circuit open and buffer fill.",
          duration: 6000,
        },
      );
      queryClient.invalidateQueries({ queryKey: ["admin-circuit-stats"] });
    },
    onError: (e) =>
      toast.error(
        e?.response?.data?.message ??
          e?.message ??
          "Failed to simulate failure",
      ),
  });

  const upMutation = useMutation({
    mutationFn: adminApi.rabbitMqUp,
    onSuccess: () => {
      toast.success("RabbitMQ restored. Simulation mode OFF.", {
        description: "Rabbit MQ gets up.",
        duration: 8000,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-circuit-stats"] });
    },
    onError: (e) =>
      toast.error(
        e?.response?.data?.message ??
          e?.message ??
          "Failed to restore connection",
      ),
  });

  const isMutating = downMutation.isPending || upMutation.isPending;

  // -- Stat Cards --------------

  const statCards = [
    {
      label: "Total Users",
      value: stats?.total_users,
      icon: Users,
      color: "text-violet-400 bg-violet-400/10",
    },
    {
      label: "Total Projects",
      value: stats?.total_projects,
      icon: LayoutDashboard,
      color: "text-blue-400 bg-blue-400/10",
    },
    {
      label: "Active Alert Rules",
      value: stats?.active_alert_rules,
      icon: Activity,
      color: "text-amber-400 bg-amber-400/10",
    },
    {
      label: "Server Uptime",
      value: stats ? formatUptime(stats.uptime_seconds) : undefined,
      icon: Server,
      color: "text-emerald-400 bg-emerald-400/10",
    },
  ];

  const outboxItems = [
    {
      label: "Pending",
      value: stats?.outbox?.pending,
      icon: Clock,
      color: "text-blue-400",
    },
    {
      label: "Processed",
      value: stats?.outbox?.processed,
      icon: CheckCircle2,
      color: "text-emerald-400",
    },
    {
      label: "Failed",
      value: stats?.outbox?.failed,
      icon: XCircle,
      color: "text-red-400",
    },
  ];

  // -- Render --------------------

  return (
    <div className="space-y-6">
      {/* -- Stat Cards -- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Card
            key={s.label}
            className="border-none shadow-md bg-card/80 backdrop-blur-xl"
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div
                className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}
              >
                <s.icon className="size-5" />
              </div>
              <div>
                {statsLoading ? (
                  <Skeleton className="h-6 w-16 mb-1" />
                ) : (
                  <p className="text-xl font-bold">{s.value ?? "-"}</p>
                )}
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* -- Outbox Pipeline -- */}
      <Card className="border-none shadow-md bg-card/80 backdrop-blur-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Inbox className="size-4" /> Outbox Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          {outboxItems.map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <s.icon className={`size-4 ${s.color} shrink-0`} />
              <div>
                {statsLoading ? (
                  <Skeleton className="h-5 w-10" />
                ) : (
                  <p className="font-semibold text-sm">{s.value ?? 0}</p>
                )}
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* -- Circuit Breaker Dashboard -- */}
      <Card
        className={`border shadow-md backdrop-blur-xl transition-colors duration-700 ${
          isSimulating
            ? "bg-red-950/30 border-red-500/30"
            : circuitState === "open"
              ? "bg-red-950/20 border-red-500/20"
              : circuitState === "halfOpen"
                ? "bg-amber-950/20 border-amber-500/20"
                : "bg-card/80 border-border/30"
        }`}
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="size-4 text-amber-400" />
            Circuit Breaker &amp; RabbitMQ Simulator
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Simulation Mode Banner */}
          {isSimulating && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-xs font-medium">
              <span className="relative flex size-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-2 bg-red-500" />
              </span>
              SIMULATION MODE ACTIVE - RabbitMQ is held down, auto-reconnect
              suppressed
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <CircuitStat
              icon={CircleDot}
              label="Circuit State"
              value={<CircuitStateBadge state={circuitState} />}
              color="text-violet-400"
              loading={circuitLoading}
            />
            <CircuitStat
              icon={Wifi}
              label="RabbitMQ"
              value={<RmqStatusBadge status={rabbitmqStatus} />}
              color="text-blue-400"
              loading={circuitLoading}
            />
            <CircuitStat
              icon={Database}
              label="Redis Buffer"
              value={bufferCount}
              color={bufferCount > 0 ? "text-amber-400" : "text-emerald-400"}
              loading={circuitLoading}
            />
            <CircuitStat
              icon={Skull}
              label="Dead Buffer"
              value={deadBufferCount}
              color={deadBufferCount > 0 ? "text-red-400" : "text-zinc-400"}
              loading={circuitLoading}
            />
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-xs text-muted-foreground flex-1">
              {isSimulating
                ? "Send API hits while RabbitMQ is down to observe the circuit opening and Redis buffer filling. Click Restore when ready."
                : "Simulate an infrastructure failure to verify the circuit breaker failover and Redis buffer replay work correctly."}
            </p>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                id="rmq-simulate-btn"
                size="sm"
                variant="outline"
                className="gap-1.5 text-red-400 border-red-500/25 hover:bg-red-500/10 hover:text-red-300 transition-all"
                disabled={isMutating || isSimulating}
                onClick={() => downMutation.mutate()}
              >
                {downMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <FlaskConical className="size-3.5" />
                )}
                Simulate Failure
              </Button>

              <Button
                id="rmq-restore-btn"
                size="sm"
                variant="outline"
                className="gap-1.5 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/10 hover:text-emerald-300 transition-all"
                disabled={isMutating || !isSimulating}
                onClick={() => upMutation.mutate()}
              >
                {upMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="size-3.5" />
                )}
                Restore Connection
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
