import { useState, useMemo, useCallback } from "react";
import { useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ScrollText,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getLogs } from "@/api/metrics.api";
import { computeDateRange } from "@/store/slices/filtersSlice";

/**
 * Returns the status badge class for an HTTP status code.
 * @param {number} status
 * @returns {string}
 */
function statusBadgeClass(status) {
  if (status >= 500) return "badge-red";
  if (status >= 400) return "badge-amber";
  if (status >= 300) return "badge-cyan";
  return "badge-green";
}

/**
 * Returns the method badge class for an HTTP method.
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
 * Logs page - paginated raw event viewer with filters and CSV export.
 */
export default function Logs() {
  const [errorOnly, setErrorOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [methodFilter, setMethodFilter] = useState("all");

  const { timeRange, environment } = useSelector((state) => state.filters);
  const { activeProjectId } = useSelector((state) => state.auth);
  const { startDate, endDate } = computeDateRange(timeRange);
  const envFilter = environment !== "all" ? environment : undefined;

  const debounceTimer = useCallback(
    (() => {
      let timer;
      return (value) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          setDebouncedSearch(value);
          setPage(1);
        }, 300);
      };
    })(),
    [],
  );

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    debounceTimer(e.target.value);
  };

  const queryParams = {
    startDate,
    endDate,
    page,
    limit: 25,
    project_id: activeProjectId,
    ...(envFilter && { environment: envFilter }),
    ...(debouncedSearch && { endpoint: debouncedSearch }),
    ...(methodFilter !== "all" && { method: methodFilter }),
    ...(errorOnly && { errorOnly: true }),
  };

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: [
      "logs",
      timeRange,
      environment,
      page,
      debouncedSearch,
      methodFilter,
      errorOnly,
      activeProjectId,
    ],
    queryFn: () => getLogs(queryParams),
    staleTime: 5000,
  });

  const logs = useMemo(() => {
    return data?.data || [];
  }, [data]);

  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 25);

  /**
   * Exports current filtered logs as CSV.
   */
  const handleExportCSV = () => {
    if (!logs.length) return;
    const headers = [
      "Timestamp",
      "Service",
      "Endpoint",
      "Method",
      "Status",
      "Latency (ms)",
      "Error",
    ];
    const rows = logs.map((log) => [
      log.timestamp,
      log.service,
      log.endpoint,
      log.method,
      log.status,
      log.latency,
      log.error || "",
    ]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Logs</h1>
          <p className="text-sm text-slate-500 mt-1">
            Raw API event log viewer with filters and export.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2 self-start h-9 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-cyan-400/30 text-slate-300 text-sm font-medium transition-all"
            variant="ghost"
          >
            <RefreshCw
              className={cn("size-3.5", isFetching && "animate-spin")}
            />
            Refresh
          </Button>
          <Button
            onClick={handleExportCSV}
            disabled={!logs.length}
            className="gap-2 self-start h-9 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-cyan-400/30 text-slate-300 text-sm font-medium transition-all"
            variant="ghost"
          >
            <Download className="size-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* All / Errors toggle pills */}
        <div className="flex rounded-xl overflow-hidden border border-white/8 bg-[#111118]">
          <button
            onClick={() => {
              setErrorOnly(false);
              setPage(1);
            }}
            className={cn(
              "px-4 py-1.5 text-xs font-medium transition-all duration-200",
              !errorOnly
                ? "bg-cyan-400 text-[#09090e] font-semibold"
                : "text-slate-400 hover:text-slate-200",
            )}
          >
            All Logs
          </button>
          <button
            onClick={() => {
              setErrorOnly(true);
              setPage(1);
            }}
            className={cn(
              "px-4 py-1.5 text-xs font-medium transition-all duration-200",
              errorOnly
                ? "bg-rose-500 text-white font-semibold"
                : "text-slate-400 hover:text-slate-200",
            )}
          >
            Errors Only
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-500" />
          <Input
            placeholder="Search endpoint..."
            value={searchTerm}
            onChange={handleSearch}
            className="pl-9 h-9 text-xs bg-white/5 border-white/10 focus:border-cyan-400/30 focus:ring-cyan-400/10 placeholder:text-slate-600 rounded-xl"
          />
        </div>

        {/* Method filter */}
        <Select
          value={methodFilter}
          onValueChange={(v) => {
            setMethodFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[110px] h-9 text-xs bg-white/5 border-white/10 hover:border-cyan-400/30 rounded-xl">
            <Filter className="size-3 mr-1 text-slate-500 shrink-0" />
            <SelectValue placeholder="Method" />
          </SelectTrigger>
          <SelectContent className="bg-[#16161f] border-white/10">
            <SelectItem value="all">All Methods</SelectItem>
            <SelectItem value="GET">GET</SelectItem>
            <SelectItem value="POST">POST</SelectItem>
            <SelectItem value="PUT">PUT</SelectItem>
            <SelectItem value="DELETE">DELETE</SelectItem>
            <SelectItem value="PATCH">PATCH</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="relative rounded-2xl bg-[#111118] border border-white/5 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-cyan-400/30 to-transparent" />
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full bg-white/5 rounded-lg" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <ScrollText className="size-10 text-slate-700 mb-3" />
            <p className="text-slate-500 text-sm">
              No logs found for the current filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left p-3 pl-4 font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    Timestamp
                  </th>
                  <th className="text-left p-3 font-medium text-slate-500 uppercase tracking-wider">
                    Service
                  </th>
                  <th className="text-left p-3 font-medium text-slate-500 uppercase tracking-wider">
                    Endpoint
                  </th>
                  <th className="text-left p-3 font-medium text-slate-500 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="text-left p-3 font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right p-3 font-medium text-slate-500 uppercase tracking-wider">
                    Latency
                  </th>
                  <th className="text-left p-3 pr-4 font-medium text-slate-500 uppercase tracking-wider hidden lg:table-cell">
                    Error
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr
                    key={i}
                    className="border-b border-white/5 hover:bg-white/3 transition-colors group border-l-2 border-l-transparent hover:border-l-cyan-400/40"
                  >
                    <td className="p-3 pl-4 text-slate-500 whitespace-nowrap mono">
                      {format(new Date(log.timestamp), "MMM dd, HH:mm:ss")}
                    </td>
                    <td className="p-3 font-medium text-slate-300">
                      {log.service}
                    </td>
                    <td className="p-3 max-w-[200px] truncate">
                      <span
                        className="mono text-slate-400 group-hover:text-slate-200 transition-colors"
                        title={log.endpoint}
                      >
                        {log.endpoint}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={cn(
                          "badge mono",
                          methodBadgeClass(log.method),
                        )}
                      >
                        {log.method}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={cn(
                          "badge mono",
                          statusBadgeClass(log.status_code || log.status),
                        )}
                      >
                        {log.status_code || log.status}
                      </span>
                    </td>
                    <td className="p-3 text-right mono text-slate-400">
                      {Math.round(log.latency)}ms
                    </td>
                    <td className="p-3 pr-4 text-rose-400/80 max-w-[200px] truncate hidden lg:table-cell mono">
                      {log.error || <span className="text-slate-700">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <p className="text-xs text-slate-500">
              Page {page} of {totalPages} ·{" "}
              <span className="text-slate-400">
                {total.toLocaleString()} events
              </span>
            </p>
            <div className="flex items-center gap-1.5">
              <button
                className="size-7 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <button
                className="size-7 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
