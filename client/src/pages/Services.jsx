import { useState } from "react";
import { useSelector } from "react-redux";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Layers, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getServices, getEndpoints } from "@/api/metrics.api";
import { computeDateRange } from "@/store/slices/filtersSlice";

/**
 * Returns the method badge class.
 * @param {string} method
 * @returns {string}
 */
function methodBadgeClass(method) {
  const map = {
    GET: "badge-green",
    POST: "badge-cyan",
    PUT: "badge-amber",
    PATCH: "badge-purple",
    DELETE: "badge-red",
  };
  return map[method] || "badge-muted";
}

/**
 * Services page - expandable service cards showing endpoint breakdown.
 */
export default function Services() {
  const [expanded, setExpanded] = useState(null);
  const { timeRange, environment } = useSelector((state) => state.filters);
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
    project_id: activeProjectId,
    ...(envFilter && { environment: envFilter }),
  };

  const {
    data: services,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["services", timeRange, environment, activeProjectId],
    queryFn: () => getServices(queryParams),
    staleTime: 10000,
  });

  const { data: endpoints, isLoading: endpointsLoading } = useQuery({
    queryKey: ["endpoints", timeRange, environment, expanded, activeProjectId],
    queryFn: () => getEndpoints({ ...queryParams, service: expanded }),
    enabled: !!expanded,
    staleTime: 10000,
  });

  const toggleService = (name) => {
    setExpanded((prev) => (prev === name ? null : name));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Services
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Performance breakdown by service. Click to expand endpoints.
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          className="gap-2 self-start h-9 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-cyan-400/30 text-slate-300 text-sm font-medium transition-all"
          variant="ghost"
        >
          <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : !services || services.length === 0 ? (
        <div className="relative rounded-2xl bg-[#111118] border border-dashed border-white/10 p-16 text-center overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-cyan-400/30 to-transparent" />
          <div className="size-14 mx-auto bg-cyan-400/10 border border-cyan-400/20 rounded-2xl flex items-center justify-center mb-4">
            <Layers className="size-7 text-cyan-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            No services detected
          </h3>
          <p className="text-sm text-slate-500">
            Services appear here once you start sending API events.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((svc) => {
            const isOpen = expanded === svc.service;
            const errorHigh = (svc.error_rate || 0) >= 5;
            return (
              <div
                key={svc.service}
                className={cn(
                  "relative rounded-2xl bg-[#111118] border overflow-hidden transition-all duration-300",
                  isOpen
                    ? "border-cyan-400/20"
                    : "border-white/5 hover:border-white/10",
                )}
              >
                {/* Gradient accent at top */}
                <div
                  className={cn(
                    "absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent to-transparent transition-opacity",
                    isOpen
                      ? "opacity-100 via-cyan-400/50"
                      : "opacity-0 via-cyan-400/30",
                  )}
                />

                {/* Service header row */}
                <button
                  onClick={() => toggleService(svc.service)}
                  className="w-full text-left p-5 flex items-center gap-4 hover:bg-white/3 transition-colors"
                >
                  <div
                    className={cn(
                      "size-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                      isOpen
                        ? "bg-cyan-400/15 border border-cyan-400/20"
                        : "bg-white/5",
                    )}
                  >
                    <Layers
                      className={cn(
                        "size-5",
                        isOpen ? "text-cyan-400" : "text-slate-500",
                      )}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-200 truncate">
                      {svc.service}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 mono">
                      {(svc.total_requests || 0).toLocaleString()} requests
                    </p>
                  </div>

                  <div className="hidden sm:flex items-center gap-6 text-sm mr-2">
                    <div className="text-center">
                      <p className="text-slate-600 text-xs mb-1">Avg Latency</p>
                      <p className="font-semibold text-slate-300 mono">
                        {Math.round(svc.avg_latency || 0)}ms
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-slate-600 text-xs mb-1">Error Rate</p>
                      <span
                        className={cn(
                          "badge",
                          errorHigh ? "badge-red" : "badge-green",
                        )}
                      >
                        {(svc.error_rate || 0).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {isOpen ? (
                    <ChevronDown className="size-4 text-cyan-400 shrink-0" />
                  ) : (
                    <ChevronRight className="size-4 text-slate-500 shrink-0" />
                  )}
                </button>

                {/* Endpoint sub-table */}
                {isOpen && (
                  <div className="border-t border-white/5 animate-in slide-in-from-top-2 duration-200">
                    {endpointsLoading ? (
                      <div className="p-4 space-y-2">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <Skeleton
                            key={i}
                            className="h-9 w-full bg-white/5 rounded-lg"
                          />
                        ))}
                      </div>
                    ) : !endpoints || endpoints.length === 0 ? (
                      <p className="p-6 text-center text-sm text-slate-600">
                        No endpoint data available
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-white/5 bg-white/2">
                              <th className="text-left p-3 pl-5 font-medium text-slate-600 uppercase tracking-wider">
                                Endpoint
                              </th>
                              <th className="text-left p-3 font-medium text-slate-600 uppercase tracking-wider">
                                Method
                              </th>
                              <th className="text-right p-3 font-medium text-slate-600 uppercase tracking-wider">
                                Requests
                              </th>
                              <th className="text-right p-3 font-medium text-slate-600 uppercase tracking-wider">
                                Avg Latency
                              </th>
                              <th className="text-right p-3 pr-5 font-medium text-slate-600 uppercase tracking-wider">
                                Error Rate
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {endpoints.map((ep, i) => (
                              <tr
                                key={i}
                                className="border-b border-white/5 hover:bg-white/3 transition-colors group"
                              >
                                <td
                                  className="p-3 pl-5 mono text-slate-400 group-hover:text-slate-200 transition-colors max-w-[260px] truncate"
                                  title={ep.endpoint}
                                >
                                  {ep.endpoint}
                                </td>
                                <td className="p-3">
                                  <span
                                    className={cn(
                                      "badge mono",
                                      methodBadgeClass(ep.method),
                                    )}
                                  >
                                    {ep.method}
                                  </span>
                                </td>
                                <td className="p-3 text-right text-slate-400 mono">
                                  {(ep.total_requests || 0).toLocaleString()}
                                </td>
                                <td className="p-3 text-right text-slate-400 mono">
                                  {Math.round(ep.avg_latency || 0)}ms
                                </td>
                                <td className="p-3 pr-5 text-right">
                                  <span
                                    className={cn(
                                      "badge",
                                      (ep.error_rate || 0) >= 5
                                        ? "badge-red"
                                        : "badge-green",
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
