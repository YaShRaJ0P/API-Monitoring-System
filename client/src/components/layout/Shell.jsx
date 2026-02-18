import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import {
  LayoutDashboard,
  Bell,
  Settings,
  LogOut,
  Menu,
  Activity,
  Layers,
  ScrollText,
  Code,
  Sun,
  Moon,
  ChevronDown,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { logoutUser } from "@/store/slices/authSlice";
import {
  setTimeRange,
  setEnvironment,
  TIME_RANGES,
} from "@/store/slices/filtersSlice";
import { useQuery } from "@tanstack/react-query";
import { getOverview } from "@/api/metrics.api";
import { computeDateRange } from "@/store/slices/filtersSlice";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, hasHealthDot: true },
  { name: "Services", href: "/services", icon: Layers },
  { name: "Alerts", href: "/alerts", icon: Bell },
  { name: "Logs", href: "/logs", icon: ScrollText },
  { name: "Integration", href: "/integration", icon: Code },
  { name: "DLQ", href: "/admin/dlq", icon: AlertTriangle },
];

/**
 * Extracts user initials from name or email for the avatar.
 * @param {object|null} user
 * @returns {string}
 */
function getInitials(user) {
  if (!user) return "?";
  if (user.name) {
    return user.name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return (user.email?.[0] || "?").toUpperCase();
}

export function Shell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { timeRange, environment } = useSelector((state) => state.filters);

  // Fetch overview to compute health status
  const { startDate, endDate } = computeDateRange(timeRange);
  const envFilter = environment !== "all" ? environment : undefined;

  const { data: overview } = useQuery({
    queryKey: ["overview-health", timeRange, environment],
    queryFn: () =>
      getOverview({
        startDate,
        endDate,
        ...(envFilter && { environment: envFilter }),
      }),
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const isHealthy = overview ? overview.error_rate < 5 : true;

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  const handleLogout = () => {
    dispatch(logoutUser())
      .unwrap()
      .finally(() => navigate("/login", { replace: true }));
  };

  const displayName = user?.name || user?.email || "User";
  const initials = getInitials(user);

  const NavItem = ({ item, mobile = false }) => {
    const isActive = location.pathname === item.href;
    return (
      <Link
        to={item.href}
        onClick={mobile ? () => setSidebarOpen(false) : undefined}
        className={cn(
          "group flex items-center gap-x-3 rounded-xl p-2.5 text-sm font-medium leading-6 transition-all duration-200",
          isActive
            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 translate-x-1"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:translate-x-1",
        )}
      >
        <item.icon
          className={cn(
            "size-5 shrink-0 transition-transform duration-200 group-hover:scale-110",
            isActive ? "" : "text-muted-foreground",
          )}
        />
        {item.name}
        {item.hasHealthDot && (
          <span
            className={cn(
              "ml-auto size-2 rounded-full transition-colors",
              isHealthy ? "bg-emerald-500" : "bg-red-500",
            )}
          />
        )}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-background font-sans selection:bg-primary/20">
      {/* ─── Mobile Sidebar ─── */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          sidebarOpen ? "block" : "hidden",
        )}
      >
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
        <div className="fixed inset-y-0 left-0 w-72 bg-card border-r p-6 animate-in slide-in-from-left duration-300">
          <div className="flex items-center gap-3 mb-10">
            <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Activity className="size-6 text-primary" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              Antigravity
            </span>
          </div>
          <nav className="space-y-1.5">
            {navigation.map((item) => (
              <NavItem key={item.name} item={item} mobile />
            ))}
          </nav>
        </div>
      </div>

      {/* ─── Desktop Sidebar ─── */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-7 overflow-y-auto border-r bg-card px-8 pb-4">
          <div className="flex h-20 shrink-0 items-center gap-3">
            <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Activity className="size-6 text-primary" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              Antigravity
            </span>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1.5">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      <NavItem item={item} />
                    </li>
                  ))}
                </ul>
              </li>
              <li className="mt-auto">
                <Link
                  to="/settings"
                  className="group -mx-2 flex gap-x-3 rounded-xl p-2.5 text-sm font-medium leading-6 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                >
                  <Settings className="size-5 shrink-0 group-hover:rotate-45 transition-transform" />
                  Settings
                </Link>
                <button
                  onClick={handleLogout}
                  className="group -mx-2 flex w-full gap-x-3 rounded-xl p-2.5 text-sm font-medium leading-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
                >
                  <LogOut className="size-5 shrink-0 group-hover:-translate-x-1 transition-transform" />
                  Logout
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* ─── Main Content ─── */}
      <div className="lg:pl-72">
        {/* ─── Top Bar ─── */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b bg-background/80 backdrop-blur-xl px-4 sm:gap-x-6 sm:px-6 lg:px-8">
          {/* Mobile menu toggle */}
          <button
            type="button"
            className="-m-2.5 p-2.5 text-muted-foreground lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="size-6" />
          </button>

          <div className="flex flex-1 items-center justify-end gap-x-3">
            {/* Environment Switcher */}
            <Select
              value={environment}
              onValueChange={(val) => dispatch(setEnvironment(val))}
            >
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <SelectValue placeholder="Environment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Environments</SelectItem>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
                <SelectItem value="development">Development</SelectItem>
              </SelectContent>
            </Select>

            {/* Time Range Picker */}
            <Select
              value={timeRange}
              onValueChange={(val) => dispatch(setTimeRange(val))}
            >
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <Clock className="size-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIME_RANGES).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="h-6 w-px bg-border hidden sm:block" />

            {/* Dark Mode Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground h-9 w-9"
              onClick={() => setDarkMode(!darkMode)}
            >
              {darkMode ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
            </Button>

            {/* Notifications */}
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground relative h-9 w-9"
            >
              <Bell className="size-4" />
              <span className="absolute top-1.5 right-1.5 size-2 bg-destructive rounded-full border-2 border-background" />
            </Button>

            <div className="h-6 w-px bg-border hidden sm:block" />

            {/* User Avatar */}
            <div className="flex items-center gap-3">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={displayName}
                  className="size-8 rounded-full object-cover ring-2 ring-primary/20"
                />
              ) : (
                <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                  {initials}
                </div>
              )}
              <span className="hidden lg:block text-sm font-semibold">
                {displayName}
              </span>
            </div>
          </div>
        </div>

        <main className="py-8">
          <div className="px-4 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
