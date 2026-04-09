import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  RefreshCw,
  Play,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as dlqApi from "@/api/dlq.api";

/**
 * DLQ monitoring page. Shows failed outbox entries with replay capabilities.
 */
export default function DlqMonitor() {
  const [page, setPage] = useState(1);
  const [replayAllOpen, setReplayAllOpen] = useState(false);
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["dlq-stats"] });
    queryClient.invalidateQueries({ queryKey: ["dlq-entries"] });
  };

  // ---- Queries ----
  const {
    data: statsData,
    isLoading: statsLoading,
    isFetching: statsFetching,
  } = useQuery({
    queryKey: ["dlq-stats"],
    queryFn: dlqApi.getDlqStats,
    refetchInterval: 15000,
  });

  const {
    data: entriesData,
    isLoading: entriesLoading,
    isFetching: entriesFetching,
  } = useQuery({
    queryKey: ["dlq-entries", page],
    queryFn: () => dlqApi.getDlqEntries({ page, limit: 15 }),
    staleTime: 5000,
  });

  const entries = entriesData?.data || [];
  const totalPages = entriesData?.totalPages || 1;
  const total = entriesData?.total || 0;

  // ---- Mutations ----
  const replayOneMutation = useMutation({
    mutationFn: dlqApi.replayDlqEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dlq-entries"] });
      queryClient.invalidateQueries({ queryKey: ["dlq-stats"] });
    },
  });

  const replayAllMutation = useMutation({
    mutationFn: dlqApi.replayAllDlq,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dlq-entries"] });
      queryClient.invalidateQueries({ queryKey: ["dlq-stats"] });
      setReplayAllOpen(false);
    },
  });

  const STAT_CARDS = [
    {
      label: "Pending",
      value: statsData?.pending ?? "-",
      icon: Clock,
      color: "text-blue-500 bg-blue-500/10",
    },
    {
      label: "Processed",
      value: statsData?.processed ?? "-",
      icon: CheckCircle2,
      color: "text-emerald-500 bg-emerald-500/10",
    },
    {
      label: "Failed",
      value: statsData?.failed ?? "-",
      icon: XCircle,
      color: "text-red-500 bg-red-500/10",
    },
    {
      label: "Total",
      value: statsData?.total ?? "-",
      icon: RefreshCw,
      color: "text-violet-500 bg-violet-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Dead Letter Queue
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor and replay failed outbox projection entries.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={handleRefresh}>
            <RefreshCw
              className={cn(
                "size-4",
                (statsFetching || entriesFetching) && "animate-spin",
              )}
            />
            Refresh
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            disabled={total === 0}
            onClick={() => setReplayAllOpen(true)}
          >
            <RotateCcw className="size-4" />
            Replay All
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STAT_CARDS.map((stat) => (
          <Card
            key={stat.label}
            className="border-none shadow-md bg-card/80 backdrop-blur-xl"
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div
                className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}
              >
                <stat.icon className="size-5" />
              </div>
              <div>
                {statsLoading ? (
                  <Skeleton className="h-6 w-12 mb-1" />
                ) : (
                  <p className="text-xl font-bold">{stat.value}</p>
                )}
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Entries Table */}
      <Card className="border-none shadow-md bg-card/80 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between py-4 px-5">
          <CardTitle className="text-base">
            Failed Entries{total > 0 && ` (${total})`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {entriesLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="size-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-4">
                <CheckCircle2 className="size-8 text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No failed entries</h3>
              <p className="text-muted-foreground text-sm">
                All outbox entries have been processed successfully.
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0">
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left p-3 font-medium">Event ID</th>
                    <th className="text-left p-3 font-medium">Created</th>
                    <th className="text-center p-3 font-medium">Attempts</th>
                    <th className="text-left p-3 font-medium">Last Error</th>
                    <th className="text-right p-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map((entry) => (
                    <tr
                      key={entry._id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-3 font-mono text-xs">
                        {entry.event_id}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(entry.createdAt), "MMM dd, HH:mm:ss")}
                      </td>
                      <td className="p-3 text-center">
                        <Badge
                          variant="secondary"
                          className="bg-red-500/10 text-red-500"
                        >
                          {entry.attempts}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground max-w-[300px] truncate">
                        {entry.lastError || "-"}
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-xs"
                          onClick={() => replayOneMutation.mutate(entry._id)}
                          disabled={replayOneMutation.isPending}
                        >
                          <Play className="size-3" />
                          Replay
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
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

      {/* Replay All Confirmation */}
      <AlertDialog open={replayAllOpen} onOpenChange={setReplayAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-amber-500" />
                Replay all failed entries?
              </div>
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will reset {total} failed entr{total === 1 ? "y" : "ies"}{" "}
              back to pending. The OutboxProcessor will re-attempt projection to
              PostgreSQL on its next polling cycle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => replayAllMutation.mutate()}
              disabled={replayAllMutation.isPending}
            >
              Replay All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
