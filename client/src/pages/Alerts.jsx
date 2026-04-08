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
  Mail,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useSelector } from "react-redux";
import * as alertsApi from "@/api/alerts.api";

const SEVERITY_CONFIG = {
  critical: {
    label: "Critical",
    icon: ShieldAlert,
    badge: "badge-red",
    iconColor: "text-rose-400",
    iconBg: "bg-rose-400/10 border border-rose-400/20",
  },
  warning: {
    label: "Warning",
    icon: AlertTriangle,
    badge: "badge-amber",
    iconColor: "text-amber-400",
    iconBg: "bg-amber-400/10 border border-amber-400/20",
  },
  info: {
    label: "Info",
    icon: Info,
    badge: "badge-cyan",
    iconColor: "text-cyan-400",
    iconBg: "bg-cyan-400/10 border border-cyan-400/20",
  },
};

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
  send_email: false,
};

/**
 * Alerts page - rules CRUD with severity, toggle, and history tab.
 */
export default function Alerts() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [historyPage, setHistoryPage] = useState(1);
  const queryClient = useQueryClient();
  const { activeProjectId } = useSelector((state) => state.auth);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["alerts"] });
    queryClient.invalidateQueries({ queryKey: ["alert-history"] });
  };

  const {
    data: rules,
    isLoading,
    isFetching: rulesFetching,
  } = useQuery({
    queryKey: ["alerts", activeProjectId],
    queryFn: () => alertsApi.getRules(activeProjectId),
    staleTime: 10000,
    enabled: !!activeProjectId,
  });

  const {
    data: historyData,
    isLoading: historyLoading,
    isFetching: historyFetching,
  } = useQuery({
    queryKey: ["alert-history", historyPage, activeProjectId],
    queryFn: () =>
      alertsApi.getAlertHistory(activeProjectId, {
        page: historyPage,
        limit: 15,
      }),
    staleTime: 10000,
    enabled: !!activeProjectId,
  });

  const historyEntries = historyData?.data || [];
  const historyTotal = historyData?.total || 0;
  const historyTotalPages = Math.ceil(historyTotal / 15);

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
  const resolveMutation = useMutation({
    mutationFn: alertsApi.resolveRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["alert-history"] });
    },
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
      send_email: rule.send_email ?? false,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    const payload = {
      ...form,
      threshold: Number(form.threshold),
      window_minutes: Number(form.window_minutes),
      cooldown_minutes: Number(form.cooldown_minutes),
      project_id: activeProjectId,
    };
    if (editingRule)
      updateMutation.mutate({ id: editingRule.id, data: payload });
    else createMutation.mutate(payload);
  };

  const updateField = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const inputCls =
    "bg-white/5 border-white/10 focus:border-cyan-400/30 focus:ring-cyan-400/10 rounded-xl placeholder:text-slate-600";
  const labelCls = "text-xs font-medium text-slate-400";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Alerts
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage alert rules and view triggered alerts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleRefresh}
            className="gap-2 h-9 px-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-cyan-400/30 text-slate-300 text-sm font-medium transition-all"
            variant="ghost"
          >
            <RefreshCw
              className={cn(
                "size-3.5",
                (rulesFetching || historyFetching) && "animate-spin",
              )}
            />
            Refresh
          </Button>
          <Dialog
            open={dialogOpen}
            onOpenChange={(v) => {
              if (!v) closeDialog();
              else setDialogOpen(true);
            }}
          >
            <DialogTrigger asChild>
              <button
                className="flex items-center gap-2 h-9 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#09090e] text-sm font-semibold transition-all pulse-cyan"
                onClick={() => {
                  setEditingRule(null);
                  setForm(INITIAL_FORM);
                }}
              >
                <Plus className="size-3.5" />
                Create Rule
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-[#16161f] border border-white/10 rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-white">
                  {editingRule ? "Edit Rule" : "Create Alert Rule"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label className={labelCls}>Rule Name</Label>
                  <Input
                    className={inputCls}
                    placeholder="e.g. High Error Rate"
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className={labelCls}>Metric</Label>
                    <Select
                      value={form.metric}
                      onValueChange={(v) => updateField("metric", v)}
                    >
                      <SelectTrigger className={inputCls}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#16161f] border-white/10">
                        <SelectItem value="error_rate">
                          Error Rate (%)
                        </SelectItem>
                        <SelectItem value="latency">
                          Avg Latency (ms)
                        </SelectItem>
                        <SelectItem value="request_count">
                          Request Count
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className={labelCls}>Condition</Label>
                    <Select
                      value={form.condition}
                      onValueChange={(v) => updateField("condition", v)}
                    >
                      <SelectTrigger className={inputCls}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#16161f] border-white/10">
                        <SelectItem value=">">Greater Than</SelectItem>
                        <SelectItem value="<">Less Than</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className={labelCls}>Threshold</Label>
                    <Input
                      className={inputCls}
                      type="number"
                      placeholder="e.g. 5"
                      value={form.threshold}
                      onChange={(e) => updateField("threshold", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className={labelCls}>Severity</Label>
                    <Select
                      value={form.severity}
                      onValueChange={(v) => updateField("severity", v)}
                    >
                      <SelectTrigger className={inputCls}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#16161f] border-white/10">
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className={labelCls}>Window (minutes)</Label>
                    <Select
                      value={String(form.window_minutes)}
                      onValueChange={(v) =>
                        updateField("window_minutes", Number(v))
                      }
                    >
                      <SelectTrigger className={inputCls}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#16161f] border-white/10">
                        {WINDOW_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={String(opt.value)}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className={labelCls}>Cooldown (minutes)</Label>
                    <Select
                      value={String(form.cooldown_minutes)}
                      onValueChange={(v) =>
                        updateField("cooldown_minutes", Number(v))
                      }
                    >
                      <SelectTrigger className={inputCls}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#16161f] border-white/10">
                        {COOLDOWN_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={String(opt.value)}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {/* Email notification toggle */}
                <div className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Mail className="size-4 text-slate-400" />
                    <div>
                      <p className="text-xs font-medium text-slate-300">
                        Email notification
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Send an email when this rule fires
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={form.send_email}
                    onCheckedChange={(v) => updateField("send_email", v)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={closeDialog}
                  className="text-slate-400 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!form.name || !form.threshold}
                  className="bg-cyan-400 hover:bg-cyan-300 text-[#09090e] font-semibold rounded-xl"
                >
                  {editingRule ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="rules">
        <TabsList className="bg-white/5 border border-white/8 rounded-xl p-1">
          <TabsTrigger
            value="rules"
            className="rounded-lg text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400"
          >
            Rules
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="rounded-lg text-xs data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400"
          >
            History
          </TabsTrigger>
        </TabsList>

        {/* Rules Tab */}
        <TabsContent value="rules" className="mt-4 space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="h-20 w-full rounded-2xl bg-white/5"
                />
              ))}
            </div>
          ) : !rules || rules.length === 0 ? (
            <div className="relative rounded-2xl bg-[#111118] border border-dashed border-white/10 p-16 text-center overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-cyan-400/30 to-transparent" />
              <div className="size-14 mx-auto bg-cyan-400/10 border border-cyan-400/20 rounded-2xl flex items-center justify-center mb-4">
                <Bell className="size-7 text-cyan-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                No alert rules yet
              </h3>
              <p className="text-sm text-slate-500">
                Create your first rule to get notified when metrics breach
                thresholds.
              </p>
            </div>
          ) : (
            rules.map((rule) => {
              const sev =
                SEVERITY_CONFIG[rule.severity] || SEVERITY_CONFIG.warning;
              const SevIcon = sev.icon;
              return (
                <div
                  key={rule.id}
                  className="relative rounded-2xl bg-[#111118] border border-white/5 hover:border-white/10 p-5 flex items-center gap-4 transition-all overflow-hidden group"
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/10 to-transparent" />
                  <div
                    className={cn(
                      "size-10 rounded-xl flex items-center justify-center shrink-0",
                      sev.iconBg,
                    )}
                  >
                    <SevIcon className={cn("size-5", sev.iconColor)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-slate-200 truncate">
                        {rule.name}
                      </p>
                      <span className={cn("badge shrink-0", sev.badge)}>
                        {sev.label}
                      </span>
                      {rule.status === "triggered" ? (
                        <span className="badge shrink-0 bg-rose-400/10 text-rose-400 border-rose-400/20 animate-pulse">
                          Triggered
                        </span>
                      ) : (
                        <span className="badge shrink-0 bg-emerald-400/10 text-emerald-400 border-emerald-400/20">
                          Resolved
                        </span>
                      )}
                      {rule.send_email && (
                        <span className="flex items-center gap-1 text-[11px] text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 rounded-full px-2 py-0.5 shrink-0">
                          <Mail className="size-3" /> Email
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mono">
                      {rule.metric} {rule.condition} {rule.threshold} · window{" "}
                      {rule.window_minutes}m · cooldown {rule.cooldown_minutes}m
                    </p>
                  </div>
                  <Switch
                    checked={rule.enabled !== false}
                    onCheckedChange={(checked) =>
                      toggleMutation.mutate({ id: rule.id, enabled: checked })
                    }
                    className="shrink-0"
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="size-8 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 text-slate-400 hover:text-white transition-all shrink-0">
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="bg-[#16161f] border-white/10 rounded-xl"
                    >
                      <DropdownMenuItem
                        onClick={() => openEdit(rule)}
                        className="text-slate-300 hover:text-white rounded-lg"
                      >
                        <Pencil className="size-3.5 mr-2" /> Edit
                      </DropdownMenuItem>
                      {rule.status === "triggered" && (
                        <DropdownMenuItem
                          onClick={() => resolveMutation.mutate(rule.id)}
                          className="text-emerald-400 hover:text-emerald-300 rounded-lg"
                        >
                          <CheckCircle2 className="size-3.5 mr-2" /> Resolve
                          Incident
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-rose-400 hover:text-rose-300 rounded-lg"
                        onClick={() => setDeleteId(rule.id)}
                      >
                        <Trash2 className="size-3.5 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4">
          <div className="relative rounded-2xl bg-[#111118] border border-white/5 overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-violet-400/30 to-transparent" />
            {historyLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    className="h-10 w-full bg-white/5 rounded-lg"
                  />
                ))}
              </div>
            ) : historyEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Bell className="size-10 text-slate-700 mb-3" />
                <p className="text-slate-500 text-sm">
                  No alerts have been triggered yet.
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left p-3 pl-4 font-medium text-slate-600 uppercase tracking-wider whitespace-nowrap">
                          Triggered At
                        </th>
                        <th className="text-left p-3 font-medium text-slate-600 uppercase tracking-wider">
                          Rule
                        </th>
                        <th className="text-left p-3 font-medium text-slate-600 uppercase tracking-wider">
                          Severity
                        </th>
                        <th className="text-left p-3 font-medium text-slate-600 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="text-right p-3 pr-4 font-medium text-slate-600 uppercase tracking-wider">
                          Value
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyEntries.map((entry, i) => {
                        const sev =
                          SEVERITY_CONFIG[entry.severity] ||
                          SEVERITY_CONFIG.warning;
                        return (
                          <tr
                            key={entry.id || i}
                            className="border-b border-white/5 hover:bg-white/3 transition-colors"
                          >
                            <td className="p-3 pl-4 text-slate-500 whitespace-nowrap mono">
                              {format(
                                new Date(entry.triggered_at),
                                "MMM dd, HH:mm:ss",
                              )}
                            </td>
                            <td className="p-3 font-semibold text-slate-300">
                              {entry.rule_name || "Deleted rule"}
                            </td>
                            <td className="p-3">
                              <span className={cn("badge", sev.badge)}>
                                {sev.label}
                              </span>
                            </td>
                            <td className="p-3">
                              {entry.status === "triggered" ? (
                                <span className="badge bg-rose-400/10 text-rose-400 border-rose-400/20">
                                  Triggered
                                </span>
                              ) : (
                                <span className="badge bg-emerald-400/10 text-emerald-400 border-emerald-400/20">
                                  Resolved
                                </span>
                              )}
                            </td>
                            <td className="p-3 pr-4 text-right mono text-slate-400">
                              {entry.metric_value}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {historyTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                    <p className="text-xs text-slate-500">
                      Page {historyPage} of {historyTotalPages}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        className="size-7 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        disabled={historyPage <= 1}
                        onClick={() => setHistoryPage((p) => p - 1)}
                      >
                        <ChevronLeft className="size-3.5" />
                      </button>
                      <button
                        className="size-7 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        disabled={historyPage >= historyTotalPages}
                        onClick={() => setHistoryPage((p) => p + 1)}
                      >
                        <ChevronRight className="size-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(v) => {
          if (!v) setDeleteId(null);
        }}
      >
        <AlertDialogContent className="bg-[#16161f] border border-white/10 rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              Delete alert rule?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              This will permanently remove the rule. It stops evaluating
              immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 text-slate-300 hover:text-white rounded-xl">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deleteId)}
              className="bg-rose-500 hover:bg-rose-400 text-white rounded-xl"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
