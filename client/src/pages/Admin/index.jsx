import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { Shield, LayoutDashboard, Users, Inbox } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OverviewTab from "./OverviewTab";
import UsersTab from "./UsersTab";
import DlqTab from "./DlqTab";

/**
 * Admin Panel root page.
 * Guards non-admin users and composes the tabbed layout from sub-components.
 */
export default function AdminPanel() {
  const user = useSelector((s) => s.auth.user);

  if (user && !user.is_admin) {
    return <Navigate to="../dashboard" replace />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="size-6 text-violet-400" /> Admin Panel
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage users, monitor system health, inspect the outbox queue, and test infrastructure.
        </p>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview" className="gap-1.5">
            <LayoutDashboard className="size-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5">
            <Users className="size-4" /> Users
          </TabsTrigger>
          <TabsTrigger value="dlq" className="gap-1.5">
            <Inbox className="size-4" /> DLQ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab />
        </TabsContent>
        <TabsContent value="dlq">
          <DlqTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
