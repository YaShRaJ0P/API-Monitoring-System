import { useState } from "react";
import { useSelector } from "react-redux";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Shield,
  ShieldOff,
  Trash2,
  AlertTriangle,
  Users,
  Gauge,
  Zap,
  Globe,
  Lock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import * as adminApi from "@/api/admin.api";

export default function UsersTab() {
  const [deleteTarget, setDeleteTarget] = useState(null);
  const queryClient = useQueryClient();
  const currentUser = useSelector((s) => s.auth.user);

  // ---- Query ----
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: adminApi.getUsers,
  });

  // ---- Mutations ----
  const deleteMutation = useMutation({
    mutationFn: (id) => adminApi.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-system-stats"] });
      toast.success("User deleted");
      setDeleteTarget(null);
    },
    onError: (e) =>
      toast.error(
        e?.response?.data?.message ?? e?.message ?? "Failed to delete user",
      ),
  });

  const toggleMutation = useMutation({
    mutationFn: (id) => adminApi.toggleAdmin(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(res?.message ?? "Admin status updated");
    },
    onError: (e) =>
      toast.error(
        e?.response?.data?.message ?? e?.message ?? "Failed to toggle admin",
      ),
  });

  return (
    <div className="space-y-4">
      <Card className="border-none shadow-md bg-card/80 backdrop-blur-xl">
        <CardHeader className="py-4 px-5 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="size-4" /> All Users
          </CardTitle>
          <Badge variant="secondary">{users.length} total</Badge>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded" />
              ))}
            </div>
          ) : (
            <ScrollArea className="max-h-[560px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0">
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left p-3 font-medium">User</th>
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="text-center p-3 font-medium">Projects</th>
                    <th className="text-center p-3 font-medium">Role</th>
                    <th className="text-left p-3 font-medium">Joined</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((user) => {
                    const isSelf = user.id === currentUser?.id;
                    return (
                      <tr
                        key={user.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="size-7">
                              <AvatarImage src={user.avatar} />
                              <AvatarFallback className="text-xs">
                                {(user.name ||
                                  user.email)?.[0]?.toUpperCase() ?? "?"}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-xs truncate max-w-[140px]">
                              {user.name || "-"}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground truncate max-w-[180px]">
                          {user.email}
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="secondary" className="text-xs">
                            {user.project_count}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          {user.is_admin ? (
                            <Badge className="bg-violet-500/15 text-violet-400 border-none text-xs gap-1">
                              <Shield className="size-3" /> Admin
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs text-muted-foreground"
                            >
                              User
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(user.created_at), "MMM dd, yyyy")}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              title={
                                user.is_admin ? "Remove admin" : "Make admin"
                              }
                              disabled={isSelf || toggleMutation.isPending}
                              onClick={() => toggleMutation.mutate(user.id)}
                            >
                              {user.is_admin ? (
                                <ShieldOff className="size-3.5 text-amber-400" />
                              ) : (
                                <Shield className="size-3.5 text-violet-400" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 hover:text-red-400"
                              title="Delete user"
                              disabled={isSelf}
                              onClick={() => setDeleteTarget(user)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirm Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-400" /> Delete user?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <strong>{deleteTarget?.name || deleteTarget?.email}</strong> and
              all their projects and data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rate Limit Policies */}
      <Card className="border-none shadow-md bg-card/80 backdrop-blur-xl">
        <CardHeader className="py-4 px-5">
          <CardTitle className="text-base flex items-center gap-2">
            <Gauge className="size-4 text-amber-400" />
            Rate Limit Policies
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Active limits applied per route type. Ingest uses a per-API-key
            Token Bucket; auth &amp; global use an IP sliding window.
          </p>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Global IP limiter */}
            <div className="rounded-xl border border-border/40 bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Globe className="size-3.5 text-blue-400" />
                Global (all routes)
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Algorithm</span>
                  <span className="text-foreground font-medium">
                    Sliding Window
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Scope</span>
                  <span className="text-foreground font-medium">Per IP</span>
                </div>
                <div className="flex justify-between">
                  <span>Limit</span>
                  <span className="text-emerald-400 font-semibold">
                    1 000 req / 15 min
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Health endpoint</span>
                  <span className="text-foreground font-medium">Exempt</span>
                </div>
              </div>
            </div>

            {/* Auth IP limiter */}
            <div className="rounded-xl border border-border/40 bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Lock className="size-3.5 text-violet-400" />
                Auth routes
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Algorithm</span>
                  <span className="text-foreground font-medium">
                    Sliding Window
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Scope</span>
                  <span className="text-foreground font-medium">Per IP</span>
                </div>
                <div className="flex justify-between">
                  <span>Limit</span>
                  <span className="text-amber-400 font-semibold">
                    20 req / 15 min
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Purpose</span>
                  <span className="text-foreground font-medium">
                    Brute-force guard
                  </span>
                </div>
              </div>
            </div>

            {/* API-key Token Bucket limiter */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Zap className="size-3.5 text-amber-400" />
                Ingest endpoint
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Algorithm</span>
                  <span className="text-foreground font-medium">
                    Token Bucket
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Scope</span>
                  <span className="text-foreground font-medium">
                    Per API key
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Burst capacity</span>
                  <span className="text-amber-400 font-semibold">
                    500 tokens
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Sustained rate</span>
                  <span className="text-amber-400 font-semibold">
                    3 000 req / min
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Fail behaviour</span>
                  <span className="text-emerald-400 font-medium">
                    Fail-open ✓
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>State backend</span>
                  <span className="text-foreground font-medium">
                    Redis (distributed)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
