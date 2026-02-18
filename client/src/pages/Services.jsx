import { useState } from "react";
import { useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  Layers,
  Activity,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getServices, getEndpoints } from "@/api/metrics.api";
import { computeDateRange } from "@/store/slices/filtersSlice";

/**
 * Services page — service cards that expand to show endpoints.
 */
export default function Services() {
  const [expanded, setExpanded] = useState(null);
  const { timeRange, environment, granularity } = useSelector(
    (state) => state.filters,
  );
  const { startDate, endDate } = computeDateRange(timeRange);
  const envFilter = environment !== "all" ? environment : undefined;

  const queryParams = {
    startDate,
    endDate,
    ...(envFilter && { environment: envFilter }),
  };

  const { data: services, isLoading } = useQuery({
    queryKey: ["services", timeRange, environment],
    queryFn: () => getServices(queryParams),
    staleTime: 10000,
  });

  // Fetch endpoints for the expanded service
  const { data: endpoints, isLoading: endpointsLoading } = useQuery({
    queryKey: ["endpoints", timeRange, environment, expanded],
    queryFn: () => getEndpoints({ ...queryParams, service: expanded }),
    enabled: !!expanded,
    staleTime: 10000,
  });

  const toggleService = (name) => {
    setExpanded((prev) => (prev === name ? null : name));
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Services</h1>
        <p className="text-muted-foreground mt-1">
          Performance breakdown by service. Click to expand endpoints.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : !services || services.length === 0 ? (
        <Card className="border-dashed border-2 bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="size-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <Layers className="size-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No services detected</h3>
            <p className="text-muted-foreground text-sm">
              Services will appear here once you start sending API events.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {services.map((svc) => {
            const isOpen = expanded === svc.service;
            return (
              <Card
                key={svc.service}
                className="border-none shadow-md bg-card/80 backdrop-blur-xl overflow-hidden"
              >
                {/* Service Header */}
                <button
                  onClick={() => toggleService(svc.service)}
                  className="w-full text-left p-5 flex items-center gap-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                    <Layers className="size-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{svc.service}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {svc.total_requests?.toLocaleString()} requests
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="text-muted-foreground text-xs">
                        Avg Latency
                      </p>
                      <p className="font-medium">
                        {Math.round(svc.avg_latency || 0)}ms
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground text-xs">
                        Error Rate
                      </p>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs",
                          (svc.error_rate || 0) >= 5
                            ? "bg-red-500/10 text-red-500"
                            : "bg-emerald-500/10 text-emerald-500",
                        )}
                      >
                        {(svc.error_rate || 0).toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="size-5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="size-5 text-muted-foreground shrink-0" />
                  )}
                </button>

                {/* Endpoints Table */}
                {isOpen && (
                  <div className="border-t bg-muted/20 animate-in slide-in-from-top-2 duration-200">
                    {endpointsLoading ? (
                      <div className="p-4 space-y-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <Skeleton key={i} className="h-10 w-full rounded" />
                        ))}
                      </div>
                    ) : !endpoints || endpoints.length === 0 ? (
                      <p className="p-6 text-center text-sm text-muted-foreground">
                        No endpoint data available
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/50">
                              <th className="text-left p-3 font-medium">
                                Endpoint
                              </th>
                              <th className="text-left p-3 font-medium">
                                Method
                              </th>
                              <th className="text-right p-3 font-medium">
                                Requests
                              </th>
                              <th className="text-right p-3 font-medium">
                                Avg Latency
                              </th>
                              <th className="text-right p-3 font-medium">
                                Error Rate
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {endpoints.map((ep, i) => (
                              <tr
                                key={i}
                                className="hover:bg-muted/30 transition-colors"
                              >
                                <td className="p-3 font-mono text-xs">
                                  {ep.endpoint}
                                </td>
                                <td className="p-3">
                                  <Badge
                                    variant="outline"
                                    className="text-xs font-mono"
                                  >
                                    {ep.method}
                                  </Badge>
                                </td>
                                <td className="p-3 text-right text-muted-foreground">
                                  {ep.total_requests?.toLocaleString()}
                                </td>
                                <td className="p-3 text-right text-muted-foreground">
                                  {Math.round(ep.avg_latency || 0)}ms
                                </td>
                                <td className="p-3 text-right">
                                  <span
                                    className={cn(
                                      "text-xs font-medium px-2 py-0.5 rounded-full",
                                      (ep.error_rate || 0) >= 5
                                        ? "bg-red-500/10 text-red-500"
                                        : "bg-emerald-500/10 text-emerald-500",
                                    )}
                                  >
                                    {(ep.error_rate || 0).toFixed(1)}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
