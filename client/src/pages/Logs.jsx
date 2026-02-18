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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
 * Logs page — paginated raw event viewer with filters and CSV export.
 */
export default function Logs() {
  const [errorOnly, setErrorOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [methodFilter, setMethodFilter] = useState("all");

  const { timeRange, environment } = useSelector((state) => state.filters);
  const { startDate, endDate } = computeDateRange(timeRange);
  const envFilter = environment !== "all" ? environment : undefined;

  // Debounce search input (300ms)
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
    ...(envFilter && { environment: envFilter }),
    ...(debouncedSearch && { endpoint: debouncedSearch }),
    ...(methodFilter !== "all" && { method: methodFilter }),
  };

  const { data, isLoading } = useQuery({
    queryKey: [
      "logs",
      timeRange,
      environment,
      page,
      debouncedSearch,
      methodFilter,
      errorOnly,
    ],
    queryFn: () => getLogs(queryParams),
    staleTime: 5000,
  });

  // Filter errors client-side for the toggle
  const logs = useMemo(() => {
    if (!data?.data) return [];
    if (errorOnly) return data.data.filter((log) => log.status >= 400);
    return data.data;
  }, [data, errorOnly]);

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

  /**
   * Returns a color class based on HTTP status code.
   * @param {number} status
   * @returns {string}
   */
  const statusColor = (status) => {
    if (status >= 500) return "bg-red-500/10 text-red-500";
    if (status >= 400) return "bg-amber-500/10 text-amber-500";
    if (status >= 300) return "bg-blue-500/10 text-blue-500";
    return "bg-emerald-500/10 text-emerald-500";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Logs</h1>
          <p className="text-muted-foreground mt-1">
            Raw API event log viewer with filters and export.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          className="gap-2 self-start"
        >
          <Download className="size-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* All / Errors toggle */}
        <div className="flex rounded-lg border overflow-hidden">
          <button
            onClick={() => {
              setErrorOnly(false);
              setPage(1);
            }}
            className={cn(
              "px-3 py-1.5 text-sm font-medium transition-colors",
              !errorOnly
                ? "bg-primary text-primary-foreground"
                : "bg-card hover:bg-accent",
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
              "px-3 py-1.5 text-sm font-medium transition-colors",
              errorOnly
                ? "bg-destructive text-destructive-foreground"
                : "bg-card hover:bg-accent",
            )}
          >
            Errors Only
          </button>
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search endpoint..."
            value={searchTerm}
            onChange={handleSearch}
            className="pl-9 h-9"
          />
        </div>

        <Select
          value={methodFilter}
          onValueChange={(v) => {
            setMethodFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[110px] h-9 text-xs">
            <SelectValue placeholder="Method" />
          </SelectTrigger>
          <SelectContent>
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
      <Card className="border-none shadow-md bg-card/80 backdrop-blur-xl">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ScrollText className="size-10 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground text-sm">
                No logs found for the current filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left p-3 font-medium">Timestamp</th>
                    <th className="text-left p-3 font-medium">Service</th>
                    <th className="text-left p-3 font-medium">Endpoint</th>
                    <th className="text-left p-3 font-medium">Method</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-right p-3 font-medium">Latency</th>
                    <th className="text-left p-3 font-medium hidden lg:table-cell">
                      Error
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {logs.map((log, i) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.timestamp), "MMM dd, HH:mm:ss")}
                      </td>
                      <td className="p-3 font-medium text-xs">{log.service}</td>
                      <td className="p-3 font-mono text-xs max-w-[200px] truncate">
                        {log.endpoint}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs font-mono">
                          {log.method}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <span
                          className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-full",
                            statusColor(log.status),
                          )}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="p-3 text-right text-muted-foreground text-xs">
                        {Math.round(log.latency)}ms
                      </td>
                      <td className="p-3 text-xs text-red-500 max-w-[200px] truncate hidden lg:table-cell">
                        {log.error || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages} ({total} total)
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
