import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import {
  Settings as SettingsIcon,
  User,
  Key,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

/**
 * Settings page — user profile overview.
 */
export default function Settings() {
  const { user } = useSelector((state) => state.auth);

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Account details and preferences.
        </p>
      </div>

      {/* Profile */}
      <Card className="border-none shadow-md bg-card/80 backdrop-blur-xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="size-5 text-primary" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="size-16 rounded-full object-cover ring-2 ring-primary/20"
              />
            ) : (
              <div className="size-16 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xl">
                {user?.name?.[0]?.toUpperCase() || "?"}
              </div>
            )}
            <div>
              <p className="font-semibold text-lg">{user?.name || "Unknown"}</p>
              <p className="text-sm text-muted-foreground">
                {user?.email || "—"}
              </p>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Account ID</p>
              <p className="font-mono text-xs mt-1">{user?.id || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Sign-in Provider</p>
              <p className="mt-1">Google OAuth</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Key Quick Link */}
      <Card className="border-none shadow-md bg-card/80 backdrop-blur-xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="size-5 text-primary" />
            API Key
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm">
                Manage your API key, view integration docs, and monitor usage.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Current key:{" "}
                <code className="bg-muted px-1.5 py-0.5 rounded">
                  {user?.env_id
                    ? `${user.env_id.slice(0, 8)}...`
                    : "Not generated"}
                </code>
              </p>
            </div>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="gap-2 shrink-0"
            >
              <Link to="/integration">
                <ExternalLink className="size-3.5" />
                Integration
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
