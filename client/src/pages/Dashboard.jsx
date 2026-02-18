import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Clock,
  AlertTriangle,
  Zap,
  Code,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getOverview, getTimeseries, getServices } from "@/api/metrics.api";
import { computeDateRange } from "@/store/slices/filtersSlice";

/**
 * Dashboard page — real-time API health overview.
 * Reads global filters from Redux and fetches live data via React Query.
 */
export default function Dashboard() {
  const { timeRange, environment, granularity } = useSelector(
    (state) => state.filters,
  );
  const { startDate, endDate } = computeDateRange(timeRange);
  const envFilter = environment !== "all" ? environment : undefined;

  const queryParams = {
    startDate,
    endDate,
    granularity,
    ...(envFilter && { environment: envFilter }),
  };

  // ─── Queries ───
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["overview", timeRange, environment],
    queryFn: () => getOverview(queryParams),
    staleTime: 10000,
    refetchInterval: 30000,
  });

  const { data: timeseries, isLoading: timeseriesLoading } = useQuery({
    queryKey: ["timeseries", timeRange, environment, granularity],
    queryFn: () => getTimeseries(queryParams),
    staleTime: 10000,
    refetchInterval: 30000,
  });

  const { data: services, isLoading: servicesLoading } = useQuery({
    queryKey: ["services", timeRange, environment],
    queryFn: () => getServices(queryParams),
    staleTime: 10000,
  });

  const hasData = overview && overview.total_requests > 0;

  // ─── Stat Cards Config ───
  const stats = overview
    ? [
        {
          label: "Total Requests",
          value: overview.total_requests?.toLocaleString() || "0",
          icon: Activity,
          color: "text-blue-500",
          bg: "bg-blue-500/10",
        },
        {
          label: "Avg Latency",
          value: `${Math.round(overview.avg_latency || 0)}ms`,
          icon: Clock,
          color: "text-amber-500",
          bg: "bg-amber-500/10",
        },
        {
          label: "Error Rate",
          value: `${(overview.error_rate || 0).toFixed(2)}%`,
          icon: AlertTriangle,
          color: overview.error_rate >= 5 ? "text-red-500" : "text-emerald-500",
          bg: overview.error_rate >= 5 ? "bg-red-500/10" : "bg-emerald-500/10",
        },
        {
          label: "P95 Latency",
          value: `${Math.round(overview.p95_latency || 0)}ms`,
          icon: Zap,
          color: "text-purple-500",
          bg: "bg-purple-500/10",
        },
      ]
    : [];

  // ─── Chart data formatting ───
  const chartData = (timeseries || []).map((bucket) => ({
    time: format(new Date(bucket.bucket), "HH:mm"),
    requests: bucket.request_count,
    errors: bucket.error_count,
    latency: Math.round(bucket.avg_latency || 0),
  }));

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Real-time overview of your API health and performance.
        </p>
      </div>

      {/* ─── Empty State ─── */}
      {!overviewLoading && !hasData && (
        <Card className="border-dashed border-2 bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="size-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <Code className="size-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No data yet</h3>
            <p className="text-muted-foreground text-sm max-w-sm mb-6">
              Send your first API event to start monitoring. It only takes a
              minute to set up.
            </p>
            <Button asChild>
              <Link to="/integration" className="gap-2">
                <Code className="size-4" />
                View Integration Guide
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ─── Stat Cards ─── */}
      {(overviewLoading || hasData) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {overviewLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card
                  key={i}
                  className="border-none shadow-md bg-card/80 backdrop-blur-xl"
                >
                  <CardContent className="p-6">
                    <Skeleton className="h-4 w-24 mb-3" />
                    <Skeleton className="h-8 w-20" />
                  </CardContent>
                </Card>
              ))
            : stats.map((stat) => (
                <Card
                  key={stat.label}
                  className="border-none shadow-md bg-card/80 backdrop-blur-xl hover:shadow-lg transition-shadow"
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium text-muted-foreground">
                        {stat.label}
                      </p>
                      <div
                        className={cn(
                          "size-9 rounded-lg flex items-center justify-center",
                          stat.bg,
                        )}
                      >
                        <stat.icon className={cn("size-4", stat.color)} />
                      </div>
                    </div>
                    <p className="text-2xl font-bold tracking-tight">
                      {stat.value}
                    </p>
                  </CardContent>
                </Card>
              ))}
        </div>
      )}

      {/* ─── Charts Row ─── */}
      {(timeseriesLoading || hasData) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Request Traffic */}
          <Card className="lg:col-span-2 border-none shadow-md bg-card/80 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                Request Traffic
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timeseriesLoading ? (
                <Skeleton className="h-[280px] w-full rounded-lg" />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient
                        id="colorReqs"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="hsl(var(--primary))"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="hsl(var(--primary))"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-border/50"
                    />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--card))",
                        fontSize: "12px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="requests"
                      stroke="hsl(var(--primary))"
                      fillOpacity={1}
                      fill="url(#colorReqs)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Error Distribution */}
          <Card className="border-none shadow-md bg-card/80 backdrop-blur-xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">
                Error Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {timeseriesLoading ? (
                <Skeleton className="h-[280px] w-full rounded-lg" />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-border/50"
                    />
                    <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--card))",
                        fontSize: "12px",
                      }}
                    />
                    <Bar
                      dataKey="errors"
                      fill="hsl(var(--destructive))"
                      radius={[4, 4, 0, 0]}
                      opacity={0.8}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Top Services ─── */}
      {(servicesLoading || (services && services.length > 0)) && (
        <Card className="border-none shadow-md bg-card/80 backdrop-blur-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Top Services
            </CardTitle>
          </CardHeader>
          <CardContent>
            {servicesLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left p-3 font-medium">Service</th>
                      <th className="text-right p-3 font-medium">Requests</th>
                      <th className="text-right p-3 font-medium">
                        Avg Latency
                      </th>
                      <th className="text-right p-3 font-medium">Error Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(services || []).slice(0, 5).map((svc) => (
                      <tr
                        key={svc.service}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="p-3 font-medium">{svc.service}</td>
                        <td className="p-3 text-right text-muted-foreground">
                          {svc.total_requests?.toLocaleString()}
                        </td>
                        <td className="p-3 text-right text-muted-foreground">
                          {Math.round(svc.avg_latency || 0)}ms
                        </td>
                        <td className="p-3 text-right">
                          <span
                            className={cn(
                              "text-xs font-medium px-2 py-0.5 rounded-full",
                              (svc.error_rate || 0) >= 5
                                ? "bg-red-500/10 text-red-500"
                                : "bg-emerald-500/10 text-emerald-500",
                            )}
                          >
                            {(svc.error_rate || 0).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
