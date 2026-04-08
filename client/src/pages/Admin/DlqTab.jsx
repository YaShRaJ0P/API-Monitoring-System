import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  RotateCcw,
  Play,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
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
import { toast } from "sonner";
import * as dlqApi from "@/api/dlq.api";

const STAT_CARD_CONFIG = [
  {
    key: "pending",
    label: "Pending",
    icon: Clock,
    color: "text-blue-400 bg-blue-400/10",
  },
  {
    key: "processed",
    label: "Processed",
    icon: CheckCircle2,
    color: "text-emerald-400 bg-emerald-400/10",
  },
  {
    key: "failed",
    label: "Failed",
    icon: XCircle,
    color: "text-red-400 bg-red-400/10",
  },
  {
    key: "total",
    label: "Total",
    icon: RefreshCw,
    color: "text-violet-400 bg-violet-400/10",
  },
];

export default function DlqTab() {
  const [page, setPage] = useState(1);
  const [replayAllOpen, setReplayAllOpen] = useState(false);
  const queryClient = useQueryClient();

  // ---- Queries ----
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dlq-stats"],
    queryFn: dlqApi.getDlqStats,
    refetchInterval: 15_000,
  });

  const { data: entriesData, isLoading: entriesLoading } = useQuery({
    queryKey: ["dlq-entries", page],
    queryFn: () => dlqApi.getDlqEntries({ page, limit: 15 }),
    staleTime: 5_000,
  });

  const entries = entriesData?.data ?? [];
  const totalPages = entriesData?.totalPages ?? 1;
  const total = entriesData?.total ?? 0;

  // ---- Mutations ----
  const replayOneMutation = useMutation({
    mutationFn: (id) => dlqApi.replayDlqEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dlq-entries"] });
      queryClient.invalidateQueries({ queryKey: ["dlq-stats"] });
      toast.success("Entry queued for replay");
    },
    onError: (e) =>
      toast.error(e?.response?.data?.message ?? "Failed to replay entry"),
  });

  const replayAllMutation = useMutation({
    mutationFn: dlqApi.replayAllDlq,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["dlq-entries"] });
      queryClient.invalidateQueries({ queryKey: ["dlq-stats"] });
      setReplayAllOpen(false);
      toast.success(res?.message ?? "All entries queued for replay");
    },
    onError: (e) =>
      toast.error(e?.response?.data?.message ?? "Failed to replay all entries"),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Dead Letter Queue</h2>
          <p className="text-sm text-muted-foreground">
            Monitor and replay failed outbox entries
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          disabled={total === 0 || replayAllMutation.isPending}
          onClick={() => setReplayAllOpen(true)}
        >
          <RotateCcw className="size-4" /> Replay All
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STAT_CARD_CONFIG.map((s) => (
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
                  <Skeleton className="h-6 w-12 mb-1" />
                ) : (
                  <p className="text-xl font-bold">{stats?.[s.key] ?? "-"}</p>
                )}
                <p className="text-xs text-muted-foreground">{s.label}</p>
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
                <CheckCircle2 className="size-8 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No failed entries</h3>
              <p className="text-muted-foreground text-sm">
                All outbox entries have been processed.
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
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
                      key={entry.event_id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-3 font-mono text-xs">
                        {entry.event_id}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(entry.created_at), "MMM dd, HH:mm:ss")}
                      </td>
                      <td className="p-3 text-center">
                        <Badge
                          variant="secondary"
                          className="bg-red-500/10 text-red-400"
                        >
                          {entry.attempts}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground max-w-[280px] truncate">
                        {entry.last_error || "-"}
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-xs"
                          disabled={replayOneMutation.isPending}
                          onClick={() =>
                            replayOneMutation.mutate(entry.event_id)
                          }
                        >
                          <Play className="size-3" /> Replay
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

      {/* Replay-All Confirm Dialog */}
      <AlertDialog open={replayAllOpen} onOpenChange={setReplayAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-400" /> Replay all
              failed entries?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will reset {total} failed entr{total === 1 ? "y" : "ies"}{" "}
              back to pending. The OutboxProcessor will re-attempt them on its
              next cycle.
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
