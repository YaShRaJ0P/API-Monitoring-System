import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Clock,
  AlertTriangle,
  Zap,
  Code,
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getOverview,
  getTimeseries,
  getServices,
  getEndpoints,
} from "@/api/metrics.api";
import { computeDateRange } from "@/store/slices/filtersSlice";

const PIE_COLORS = [
  "#22d3ee", // cyan
  "#a78bfa", // violet
  "#10b981", // emerald
  "#f59e0b", // amber
  "#f43f5e", // rose
  "#ec4899", // pink
  "#f97316", // orange

  "#3b82f6", // blue
  "#6366f1", // indigo
  "#14b8a6", // teal
  "#84cc16", // lime
  "#eab308", // yellow
  "#ef4444", // red
  "#d946ef", // fuchsia

  "#0ea5e9", // sky
  "#8b5cf6", // purple
  "#06b6d4", // cyan-alt
  "#65a30d", // olive green
  "#ca8a04", // mustard
  "#dc2626", // strong red
  "#db2777", // deep pink

  "#2563eb", // darker blue
  "#7c3aed", // deeper violet
  "#0891b2", // deep cyan
  "#4d7c0f", // dark lime
  "#a16207", // brownish yellow
  "#b91c1c", // dark red
  "#9d174d", // wine

  "#1d4ed8", // strong blue
  "#6d28d9", // strong purple
];

/**
 * A subtle custom tooltip for Recharts.
 * @param {{ active: boolean, payload: object[], label: string }} props
 */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-xl p-3 text-xs min-w-[140px]">
      <p className="text-slate-400 mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span
              className="size-1.5 rounded-full"
              style={{ background: p.color }}
            />
            {p.name}
          </span>
          <span className="font-medium text-white">
            {p.value?.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * A stat tile card.
 * @param {{ label: string, value: string, icon: React.ElementType, accent: string, trend?: string }} props
 */
function StatTile({ label, value, icon: Icon, accent, trend, trendUp }) {
  return (
    <div className="relative group rounded-2xl bg-[#111118] border border-white/5 p-5 overflow-hidden transition-all duration-300 hover:border-white/10 hover:shadow-lg">
      {/* Gradient top border */}
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}50, transparent)`,
        }}
      />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
            {label}
          </p>
          <p className="text-2xl font-bold text-white tracking-tight">
            {value}
          </p>
          {trend && (
            <p
              className={cn(
                "flex items-center gap-1 text-xs mt-1.5",
                trendUp ? "text-emerald-400" : "text-rose-400",
              )}
            >
              {trendUp ? (
                <TrendingUp className="size-3" />
              ) : (
                <TrendingDown className="size-3" />
              )}
              {trend}
            </p>
          )}
        </div>
        <div
          className="size-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${accent}15` }}
        >
          <Icon className="size-4" style={{ color: accent }} />
        </div>
      </div>
      {/* Hover glow */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 0% 100%, ${accent}08, transparent 60%)`,
        }}
      />
    </div>
  );
}

/**
 * A chart container card with a gradient top border.
 * @param {{ title: string, children: React.ReactNode, className?: string }} props
 */
function ChartCard({ title, children, className = "" }) {
  return (
    <div
      className={cn(
        "relative rounded-2xl bg-[#111118] border border-white/5 p-5 overflow-hidden",
        className,
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-cyan-400/40 to-transparent" />
      <p className="text-sm font-semibold text-slate-200 mb-4">{title}</p>
      {children}
    </div>
  );
}

/**
 * Dashboard page - real-time API health overview.
 * Reads global filters from Redux and fetches live data via React Query.
 */
export default function Dashboard() {
  const { timeRange, environment, granularity } = useSelector(
    (state) => state.filters,
  );
  const { activeProjectId } = useSelector((state) => state.auth);
  const { startDate, endDate } = computeDateRange(timeRange);
  const envFilter = environment !== "all" ? environment : undefined;
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries();
  };

  const queryParams = {
    startDate,
    endDate,
    granularity,
    project_id: activeProjectId,
    ...(envFilter && { environment: envFilter }),
  };

  // ---- Queries ----
  const {
    data: overview,
    isLoading: overviewLoading,
    isFetching: overviewFetching,
  } = useQuery({
    queryKey: ["overview", timeRange, environment, activeProjectId],
    queryFn: () => getOverview(queryParams),
    staleTime: 10000,
    refetchInterval: 30000,
  });

  const {
    data: timeseries,
    isLoading: timeseriesLoading,
    isFetching: timeseriesFetching,
  } = useQuery({
    queryKey: [
      "timeseries",
      timeRange,
      environment,
      granularity,
      activeProjectId,
    ],
    queryFn: () => getTimeseries(queryParams),
    staleTime: 10000,
    refetchInterval: 30000,
  });

  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ["services", timeRange, environment, activeProjectId],
    queryFn: () => getServices(queryParams),
    staleTime: 10000,
  });

  const { data: endpoints, isLoading: endpointsLoading } = useQuery({
    queryKey: ["endpoints", timeRange, environment, activeProjectId],
    queryFn: () => getEndpoints(queryParams),
    staleTime: 10000,
  });

  const hasData = overview && overview.total_requests > 0;

  // ---- Stat tiles config ----
  const stats = overview
    ? [
        {
          label: "Total Requests",
          value: (overview.total_requests || 0).toLocaleString(),
          icon: Activity,
          accent: "#22d3ee",
        },
        {
          label: "Avg Latency",
          value: `${Math.round(overview.avg_latency || 0)}ms`,
          icon: Clock,
          accent: "#f59e0b",
        },
        {
          label: "Error Rate",
          value: `${(overview.error_rate || 0).toFixed(2)}%`,
          icon: AlertTriangle,
          accent: (overview.error_rate || 0) >= 5 ? "#f43f5e" : "#10b981",
        },
        {
          label: "P95 Latency",
          value: `${Math.round(overview.p95_latency || 0)}ms`,
          icon: Zap,
          accent: "#a78bfa",
        },
      ]
    : [];

  // ---- Chart time formatting ----
  const formatTime = (isoString) => {
    const d = new Date(isoString);
    if (["1m", "5m", "15m"].includes(granularity)) return format(d, "HH:mm");
    if (granularity === "1h") return format(d, "MMM dd, HH:mm");
    return format(d, "MMM dd");
  };

  const chartData = (timeseries || []).map((bucket) => ({
    time: formatTime(bucket.bucket),
    requests: bucket.request_count,
    errors: bucket.error_count,
    latency: Math.round(bucket.avg_latency || 0),
  }));

  const SkeletonTile = () => (
    <div className="rounded-2xl bg-[#111118] border border-white/5 p-5">
      <Skeleton className="h-3 w-24 mb-4 bg-white/5" />
      <Skeleton className="h-7 w-20 bg-white/5" />
    </div>
  );

  const SkeletonChart = ({ height = 260 }) => (
    <Skeleton className="w-full rounded-xl bg-white/5" style={{ height }} />
  );

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time API health · auto-refreshes every 30s
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleRefresh}
            className="h-7 px-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-cyan-400/30 text-slate-300 text-xs font-medium transition-all"
            variant="ghost"
          >
            <RefreshCw
              className={cn(
                "size-3 mr-1.5",
                (overviewFetching || timeseriesFetching) && "animate-spin",
              )}
            />
            Refresh
          </Button>
          <span
            className={cn("badge", hasData ? "badge-green" : "badge-muted")}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                hasData ? "bg-emerald-400 animate-pulse" : "bg-slate-500",
              )}
            />
            {hasData ? "Live" : "No data"}
          </span>
        </div>
      </div>

      {/* ---- Empty State ---- */}
      {!overviewLoading && !hasData && (
        <div className="relative rounded-2xl bg-[#111118] border border-dashed border-white/10 p-16 text-center overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-cyan-400/30 to-transparent" />
          <div className="relative size-16 mx-auto bg-cyan-400/10 border border-cyan-400/20 rounded-2xl flex items-center justify-center mb-5">
            <Code className="size-7 text-cyan-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No data yet</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
            Send your first API event to start monitoring. It only takes a
            minute to set up.
          </p>
          <Link to="/integration">
            <Button className="bg-cyan-400 hover:bg-cyan-300 text-[#09090e] font-semibold rounded-xl px-6 pulse-cyan">
              View Integration Guide
            </Button>
          </Link>
        </div>
      )}

      {/* ---- Stat Tiles ---- */}
      {(overviewLoading || hasData) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {overviewLoading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonTile key={i} />)
            : stats.map((s) => <StatTile key={s.label} {...s} />)}
        </div>
      )}

      {/* ---- Charts Row 1: Traffic full-width ---- */}
      {(timeseriesLoading || hasData) && (
        <ChartCard title="Request Traffic">
          {timeseriesLoading ? (
            <SkeletonChart />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gradReqs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradErr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                  vertical={false}
                />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{
                    paddingTop: "12px",
                    fontSize: "12px",
                    color: "#94a3b8",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="requests"
                  name="Requests"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  fill="url(#gradReqs)"
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: "#22d3ee",
                    stroke: "#09090e",
                    strokeWidth: 2,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="errors"
                  name="Errors"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  fill="url(#gradErr)"
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: "#f43f5e",
                    stroke: "#09090e",
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      )}

      {/* ---- Charts Row 2: Latency + Error Distribution ---- */}
      {(timeseriesLoading || hasData) && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <ChartCard title="Latency Trend (ms)" className="lg:col-span-3">
            {timeseriesLoading ? (
              <SkeletonChart />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData}>
                  <defs>
                    <linearGradient
                      id="gradLatency"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="latency"
                    name="Latency (ms)"
                    stroke="#a78bfa"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{
                      r: 4,
                      fill: "#a78bfa",
                      stroke: "#09090e",
                      strokeWidth: 2,
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Error Distribution" className="lg:col-span-2">
            {timeseriesLoading ? (
              <SkeletonChart />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} barCategoryGap="30%">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="errors" name="Errors" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={
                          entry.errors > 0
                            ? "#f43f5e"
                            : "rgba(255,255,255,0.05)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      )}

      {/* ---- Breakdowns: Services + Endpoints ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Services */}
        {(servicesLoading || (services && services.length > 0)) && (
          <div className="relative rounded-2xl bg-[#111118] border border-white/5 overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-cyan-400/30 to-transparent" />
            <div className="p-5">
              <p className="text-sm font-semibold text-slate-200 mb-4">
                Top Services
              </p>
              {servicesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 bg-white/5 rounded-lg" />
                  ))}
                </div>
              ) : (
                <>
                  {/* Pie chart */}
                  {services.length > 0 && (
                    <div className="h-[180px] mb-5">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={services.slice(0, 5)}
                            dataKey="total_requests"
                            nameKey="service"
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={72}
                            paddingAngle={4}
                          >
                            {services.slice(0, 5).map((_, i) => (
                              <Cell
                                key={i}
                                fill={PIE_COLORS[i % PIE_COLORS.length]}
                                strokeWidth={0}
                              />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {/* Table */}
                  <div className="space-y-1">
                    {(services || []).slice(0, 5).map((svc, i) => (
                      <div
                        key={svc.service}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors group"
                      >
                        <div
                          className="size-1.5 rounded-full shrink-0"
                          style={{
                            background: PIE_COLORS[i % PIE_COLORS.length],
                          }}
                        />
                        <span className="flex-1 text-sm text-slate-300 truncate group-hover:text-white transition-colors">
                          {svc.service}
                        </span>
                        <span className="text-xs text-slate-500 mono">
                          {svc.total_requests?.toLocaleString()}
                        </span>
                        <span
                          className={cn(
                            "badge shrink-0",
                            (svc.error_rate || 0) >= 5
                              ? "badge-red"
                              : "badge-green",
                          )}
                        >
                          {(svc.error_rate || 0).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Top Endpoints */}
        {(endpointsLoading || (endpoints && endpoints.length > 0)) && (
          <div className="relative rounded-2xl bg-[#111118] border border-white/5 overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-violet-400/30 to-transparent" />
            <div className="p-5">
              <p className="text-sm font-semibold text-slate-200 mb-4">
                Top Endpoints
              </p>
              {endpointsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 bg-white/5 rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="space-y-1">
                  {(endpoints || []).slice(0, 8).map((ep) => (
                    <div
                      key={ep.endpoint}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors group border-l-2 border-transparent hover:border-violet-400/40"
                    >
                      <span
                        className="flex-1 text-xs font-medium mono text-slate-400 truncate group-hover:text-slate-200 transition-colors"
                        title={ep.endpoint}
                      >
                        {ep.endpoint}
                      </span>
                      <span className="text-xs text-slate-500 shrink-0 mono">
                        {Math.round(ep.avg_latency || 0)}ms
                      </span>
                      <span
                        className={cn(
                          "badge shrink-0",
                          (ep.error_rate || 0) >= 5
                            ? "badge-red"
                            : "badge-green",
                        )}
                      >
                        {(ep.error_rate || 0).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
