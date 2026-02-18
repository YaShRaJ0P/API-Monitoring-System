import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Bell,
  ShieldAlert,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { cn } from "@/lib/utils";
import * as alertsApi from "@/api/alerts.api";

const SEVERITY_CONFIG = {
  critical: {
    label: "Critical",
    icon: ShieldAlert,
    color: "bg-red-500/10 text-red-500",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangle,
    color: "bg-amber-500/10 text-amber-500",
  },
  info: { label: "Info", icon: Info, color: "bg-blue-500/10 text-blue-500" },
};

/**
 * Maps frontend window/cooldown labels to minutes (matching server schema).
 */
const WINDOW_OPTIONS = [
  { label: "1 minute", value: 1 },
  { label: "5 minutes", value: 5 },
  { label: "15 minutes", value: 15 },
  { label: "60 minutes", value: 60 },
];

const COOLDOWN_OPTIONS = [
  { label: "5 minutes", value: 5 },
  { label: "15 minutes", value: 15 },
  { label: "60 minutes", value: 60 },
  { label: "360 minutes", value: 360 },
];

const INITIAL_FORM = {
  name: "",
  metric: "error_rate",
  condition: ">",
  threshold: "",
  severity: "warning",
  window_minutes: 5,
  cooldown_minutes: 60,
  enabled: true,
};

/**
 * Alerts page — rules CRUD with severity, toggle, and history tab.
 */
export default function Alerts() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [historyPage, setHistoryPage] = useState(1);
  const queryClient = useQueryClient();

  // ─── Rules Queries ───
  const { data: rules, isLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: alertsApi.getRules,
    staleTime: 10000,
  });

  // ─── History Query ───
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ["alert-history", historyPage],
    queryFn: () => alertsApi.getAlertHistory({ page: historyPage, limit: 15 }),
    staleTime: 10000,
  });

  const historyEntries = historyData?.data || [];
  const historyTotal = historyData?.total || 0;
  const historyTotalPages = Math.ceil(historyTotal / 15);

  // ─── Mutations ───
  const createMutation = useMutation({
    mutationFn: alertsApi.createRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      closeDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => alertsApi.updateRule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      closeDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: alertsApi.deleteRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      setDeleteId(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }) => alertsApi.updateRule(id, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingRule(null);
    setForm(INITIAL_FORM);
  };

  const openEdit = (rule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name || "",
      metric: rule.metric || "error_rate",
      condition: rule.condition || ">",
      threshold: rule.threshold?.toString() || "",
      severity: rule.severity || "warning",
      window_minutes: rule.window_minutes || 5,
      cooldown_minutes: rule.cooldown_minutes || 60,
      enabled: rule.enabled !== false,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    const payload = {
      ...form,
      threshold: Number(form.threshold),
      window_minutes: Number(form.window_minutes),
      cooldown_minutes: Number(form.cooldown_minutes),
    };
    if (editingRule) {
      updateMutation.mutate({ id: editingRule.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
          <p className="text-muted-foreground mt-1">
            Manage alert rules and view triggered alerts.
          </p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(v) => {
            if (!v) closeDialog();
            else setDialogOpen(true);
          }}
        >
          <DialogTrigger asChild>
            <Button
              className="gap-2"
              onClick={() => {
                setEditingRule(null);
                setForm(INITIAL_FORM);
              }}
            >
              <Plus className="size-4" />
              Create Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingRule ? "Edit Rule" : "Create Alert Rule"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Rule Name</Label>
                <Input
                  placeholder="e.g. High Error Rate"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Metric</Label>
                  <Select
                    value={form.metric}
                    onValueChange={(v) => updateField("metric", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="error_rate">Error Rate (%)</SelectItem>
                      <SelectItem value="latency">Avg Latency (ms)</SelectItem>
                      <SelectItem value="request_count">
                        Request Count
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Condition</Label>
                  <Select
                    value={form.condition}
                    onValueChange={(v) => updateField("condition", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value=">">Greater Than</SelectItem>
                      <SelectItem value="<">Less Than</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Threshold</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 5"
                    value={form.threshold}
                    onChange={(e) => updateField("threshold", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Severity</Label>
                  <Select
                    value={form.severity}
                    onValueChange={(v) => updateField("severity", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Window (minutes)</Label>
                  <Select
                    value={String(form.window_minutes)}
                    onValueChange={(v) =>
                      updateField("window_minutes", Number(v))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WINDOW_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cooldown (minutes)</Label>
                  <Select
                    value={String(form.cooldown_minutes)}
                    onValueChange={(v) =>
                      updateField("cooldown_minutes", Number(v))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COOLDOWN_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!form.name || !form.threshold}
              >
                {editingRule ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* ─── Rules Tab ─── */}
        <TabsContent value="rules" className="mt-4 space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : !rules || rules.length === 0 ? (
            <Card className="border-dashed border-2 bg-card/50">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="size-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                  <Bell className="size-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  No alert rules yet
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  Create your first rule to get notified when metrics breach
                  thresholds.
                </p>
              </CardContent>
            </Card>
          ) : (
            rules.map((rule) => {
              const sev =
                SEVERITY_CONFIG[rule.severity] || SEVERITY_CONFIG.warning;
              const SevIcon = sev.icon;
              return (
                <Card
                  key={rule.id}
                  className="border-none shadow-md bg-card/80 backdrop-blur-xl hover:shadow-lg transition-shadow"
                >
                  <CardContent className="p-5 flex items-center gap-4">
                    <div
                      className={cn(
                        "size-10 rounded-xl flex items-center justify-center shrink-0",
                        sev.color,
                      )}
                    >
                      <SevIcon className="size-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold truncate">{rule.name}</p>
                        <Badge
                          variant="secondary"
                          className={cn("text-xs", sev.color)}
                        >
                          {sev.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {rule.metric} {rule.condition} {rule.threshold} ·
                        Window: {rule.window_minutes}m · Cooldown:{" "}
                        {rule.cooldown_minutes}m
                      </p>
                    </div>

                    <Switch
                      checked={rule.enabled !== false}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: rule.id, enabled: checked })
                      }
                    />

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(rule)}>
                          <Pencil className="size-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(rule.id)}
                        >
                          <Trash2 className="size-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* ─── History Tab ─── */}
        <TabsContent value="history" className="mt-4">
          <Card className="border-none shadow-md bg-card/80 backdrop-blur-xl">
            <CardContent className="p-0">
              {historyLoading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded" />
                  ))}
                </div>
              ) : historyEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Bell className="size-10 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground text-sm">
                    No alerts have been triggered yet.
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 border-b">
                          <th className="text-left p-3 font-medium">
                            Triggered At
                          </th>
                          <th className="text-left p-3 font-medium">Rule</th>
                          <th className="text-left p-3 font-medium">
                            Severity
                          </th>
                          <th className="text-right p-3 font-medium">
                            Metric Value
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {historyEntries.map((entry, i) => {
                          const sev =
                            SEVERITY_CONFIG[entry.severity] ||
                            SEVERITY_CONFIG.warning;
                          return (
                            <tr
                              key={entry.id || i}
                              className="hover:bg-muted/30 transition-colors"
                            >
                              <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                                {format(
                                  new Date(entry.triggered_at),
                                  "MMM dd, HH:mm:ss",
                                )}
                              </td>
                              <td className="p-3 font-medium text-sm">
                                {entry.rule_name || "Deleted rule"}
                              </td>
                              <td className="p-3">
                                <Badge
                                  variant="secondary"
                                  className={cn("text-xs", sev.color)}
                                >
                                  {sev.label}
                                </Badge>
                              </td>
                              <td className="p-3 text-right font-mono text-sm">
                                {entry.metric_value}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {historyTotalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t">
                      <p className="text-xs text-muted-foreground">
                        Page {historyPage} of {historyTotalPages} (
                        {historyTotal} total)
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          disabled={historyPage <= 1}
                          onClick={() => setHistoryPage((p) => p - 1)}
                        >
                          <ChevronLeft className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          disabled={historyPage >= historyTotalPages}
                          onClick={() => setHistoryPage((p) => p + 1)}
                        >
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(v) => {
          if (!v) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete alert rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The rule will stop evaluating
              immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
