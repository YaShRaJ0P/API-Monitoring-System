import { useState, useEffect } from "react";
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import {
  LayoutDashboard,
  Bell,
  Settings,
  LogOut,
  Menu,
  Layers,
  ScrollText,
  Code,
  Shield,
  X,
  Clock,
  ChevronDown,
  Check,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/slugify";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutUser } from "@/store/slices/authSlice";
import {
  setTimeRange,
  setEnvironment,
  TIME_RANGES,
} from "@/store/slices/filtersSlice";
import { useQuery } from "@tanstack/react-query";
import { getOverview } from "@/api/metrics.api";
import { computeDateRange } from "@/store/slices/filtersSlice";

/**
 * Builds the sidebar navigation entries scoped to the current project slug.
 * The Admin link is only injected when the user has is_admin = true.
 * @param {string} projectSlug - URL project slug
 * @param {object|null} user - Current user from Redux
 * @returns {object[]}
 */
function getNavigation(projectSlug, user) {
  const base = `/${projectSlug}`;
  const nav = [
    {
      name: "Dashboard",
      href: `${base}/dashboard`,
      icon: LayoutDashboard,
      hasHealthDot: true,
    },
    { name: "Services", href: `${base}/services`, icon: Layers },
    { name: "Alerts", href: `${base}/alerts`, icon: Bell },
    { name: "Logs", href: `${base}/logs`, icon: ScrollText },
    { name: "Integration", href: `${base}/integration`, icon: Code },
  ];

  if (user?.is_admin) {
    nav.push({ name: "Admin", href: `${base}/admin`, icon: Shield });
  }

  return nav;
}

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

/**
 * Shell - application layout wrapper.
 * @param {{ children: React.ReactNode }} props
 */
export function Shell({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { projectName: projectSlug } = useParams();
  const { user, activeProjectId, projects } = useSelector(
    (state) => state.auth,
  );
  const { timeRange, environment } = useSelector((state) => state.filters);

  // -- Sync filters FROM URL on initial render -------------
  useEffect(() => {
    const urlTime = searchParams.get("t");
    const urlEnv = searchParams.get("env");
    if (urlTime && TIME_RANGES[urlTime] && urlTime !== timeRange) {
      dispatch(setTimeRange(urlTime));
    }
    if (urlEnv && urlEnv !== environment) {
      dispatch(setEnvironment(urlEnv));
    }
  }, []);

  /**
   * Updates a filter both in Redux and in the URL search params.
   * @param {"t"|"env"} key
   * @param {string} value
   */
  const handleFilterChange = (key, value) => {
    if (key === "t") {
      dispatch(setTimeRange(value));
    } else {
      dispatch(setEnvironment(value));
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set(key, value);
        return next;
      },
      { replace: true },
    );
  };

  const { startDate, endDate } = computeDateRange(timeRange);
  const envFilter = environment !== "all" ? environment : undefined;

  const { data: overview } = useQuery({
    queryKey: ["overview-health", timeRange, environment, activeProjectId],
    queryFn: () =>
      getOverview({
        startDate,
        endDate,
        project_id: activeProjectId,
        ...(envFilter && { environment: envFilter }),
      }),
    refetchInterval: 30000,
    staleTime: 10000,
    enabled: !!activeProjectId,
  });

  const isHealthy = overview ? overview.error_rate < 5 : true;

  const navigation = getNavigation(projectSlug || "", user);

  const handleLogout = () => {
    dispatch(logoutUser())
      .unwrap()
      .finally(() => navigate("/login", { replace: true }));
  };

  /**
   * Switches to a different project by navigating to its slugified dashboard URL.
   * Preserves the current sub-route.
   * @param {string} name - Target project raw name
   */
  const handleProjectSwitch = (name) => {
    const currentSub =
      location.pathname.split("/").slice(2).join("/") || "dashboard";
    navigate(`/${slugify(name)}/${currentSub}${location.search}`);
  };

  const displayName = user?.name || user?.email || "User";
  const initials = getInitials(user);

  const currentPageLabel = location.pathname.split("/").at(-1) || "dashboard";
  const formattedPageLabel =
    currentPageLabel.charAt(0).toUpperCase() + currentPageLabel.slice(1);

  /**
   * Single sidebar nav link.
   * @param {{ item: object, mobile?: boolean }} props
   */
  const NavItem = ({ item, mobile = false }) => {
    const isActive = location.pathname === item.href;
    return (
      <Link
        to={{ pathname: item.href, search: location.search }}
        onClick={mobile ? () => setSidebarOpen(false) : undefined}
        className={cn(
          "group flex items-center gap-x-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
          isActive
            ? "nav-active text-cyan-400"
            : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border-l-2 border-transparent",
        )}
      >
        <item.icon
          className={cn(
            "size-4 shrink-0 transition-all duration-200",
            isActive
              ? "text-cyan-400"
              : "text-slate-500 group-hover:text-slate-300",
          )}
        />
        {item.name}
        {item.hasHealthDot && (
          <span
            className={cn(
              "ml-auto size-1.5 rounded-full",
              isHealthy ? "bg-emerald-400 animate-pulse" : "bg-rose-400",
            )}
          />
        )}
      </Link>
    );
  };

  const SidebarContent = ({ mobile = false }) => (
    <div className="flex grow flex-col h-full">
      {/* Project Switcher */}
      <div className="flex h-16 shrink-0 items-center px-4 border-b border-white/5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 w-full group rounded-xl px-2 py-1.5 hover:bg-white/5 transition-colors">
              <div className="size-7 rounded-lg bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center shrink-0">
                <FolderOpen className="size-3.5 text-cyan-400" />
              </div>
              <span className="text-sm font-semibold text-white truncate flex-1 text-left">
                {projectSlug || "Select Project"}
              </span>
              <ChevronDown className="size-3.5 text-slate-500 shrink-0 group-hover:text-slate-300 transition-colors" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="bottom"
            align="start"
            className="w-56 bg-[#16161f] border border-white/10 rounded-xl shadow-xl"
          >
            <DropdownMenuLabel className="text-xs text-slate-500 font-medium uppercase tracking-wider">
              Switch Project
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-white/5" />
            {projects.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => handleProjectSwitch(p.name)}
                className={cn(
                  "flex items-center gap-2 rounded-lg cursor-pointer",
                  slugify(p.name) === projectSlug
                    ? "text-cyan-400 bg-cyan-400/5"
                    : "text-slate-300 hover:text-white",
                )}
              >
                <FolderOpen className="size-3.5 shrink-0 opacity-60" />
                <span className="flex-1 truncate">{p.name}</span>
                {slugify(p.name) === projectSlug && (
                  <Check className="size-3 shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {mobile && (
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-2 text-slate-400 hover:text-white shrink-0"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-widest text-slate-600">
          Monitoring
        </p>
        {navigation.map((item) => (
          <NavItem key={item.name} item={item} mobile={mobile} />
        ))}

        <div className="pt-4 mt-4 border-t border-white/5">
          <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-widest text-slate-600">
            System
          </p>
          <Link
            to={{
              pathname: `/${projectSlug}/settings`,
              search: location.search,
            }}
            onClick={mobile ? () => setSidebarOpen(false) : undefined}
            className={cn(
              "group flex items-center gap-x-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 border-l-2",
              location.pathname === `/${projectSlug}/settings`
                ? "nav-active text-cyan-400"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border-transparent",
            )}
          >
            <Settings className="size-4 shrink-0 group-hover:rotate-45 transition-transform duration-300" />
            Settings
          </Link>
        </div>
      </nav>

      {/* User section */}
      <div className="px-3 py-4 border-t border-white/5">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors">
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={displayName}
              className="size-7 rounded-full object-cover ring-1 ring-cyan-400/30"
            />
          ) : (
            <div className="size-7 rounded-full bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center text-cyan-400 font-bold text-xs">
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">
              {displayName}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {user?.email || ""}
            </p>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            className="text-slate-500 hover:text-rose-400 transition-colors"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background font-sans dark">
      {/* ------ Mobile Sidebar Overlay ------ */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64 bg-[#0f0f17] border-r border-white/5 animate-in slide-in-from-left duration-250">
            <SidebarContent mobile />
          </div>
        </div>
      )}

      {/* ------ Desktop Sidebar ------ */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-40 lg:flex lg:w-60 lg:flex-col">
        <div className="flex grow flex-col overflow-y-auto bg-[#0f0f17] border-r border-white/5">
          <SidebarContent />
        </div>
      </div>

      {/* ------ Main Content ------ */}
      <div className="lg:pl-60">
        {/* ------ Top Bar ------ */}
        <div className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-x-3 border-b border-white/5 bg-background/80 backdrop-blur-xl px-4 sm:px-6">
          <button
            type="button"
            className="text-slate-400 hover:text-white lg:hidden transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="size-5" />
          </button>

          {/* Breadcrumb */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500">
            <span className="text-cyan-400 font-medium">{projectSlug}</span>
            <span>/</span>
            <span className="text-slate-300 capitalize">
              {formattedPageLabel}
            </span>
          </div>

          <div className="flex flex-1 items-center justify-end gap-x-2">
            {/* Environment filter - synced to URL ?env= */}
            <Select
              value={environment}
              onValueChange={(val) => handleFilterChange("env", val)}
            >
              <SelectTrigger className="w-[130px] h-8 text-xs bg-white/5 border-white/10 hover:border-cyan-400/30 transition-colors focus:ring-cyan-400/20 rounded-xl">
                <SelectValue placeholder="Environment" />
              </SelectTrigger>
              <SelectContent className="bg-[#16161f] border-white/10">
                <SelectItem value="all">All Envs</SelectItem>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
                <SelectItem value="development">Development</SelectItem>
              </SelectContent>
            </Select>

            {/* Time Range filter - synced to URL ?t= */}
            <Select
              value={timeRange}
              onValueChange={(val) => handleFilterChange("t", val)}
            >
              <SelectTrigger className="w-[130px] h-8 text-xs bg-white/5 border-white/10 hover:border-cyan-400/30 transition-colors focus:ring-cyan-400/20 rounded-xl">
                <Clock className="size-3 mr-1 text-slate-500 shrink-0" />
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent className="bg-[#16161f] border-white/10">
                {Object.entries(TIME_RANGES).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="h-5 w-px bg-white/10 hidden sm:block" />

            {/* User avatar */}
            <div className="flex items-center gap-2 pl-1">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={displayName}
                  className="size-7 rounded-full object-cover ring-1 ring-cyan-400/25"
                />
              ) : (
                <div className="size-7 rounded-full bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center text-cyan-400 font-bold text-xs">
                  {initials}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ------ Page Content ------ */}
        <main className="py-8 relative">
          <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
            <div className="bg-blob size-[500px] bg-cyan-500 -top-48 -right-48" />
            <div className="bg-blob size-[400px] bg-violet-600 bottom-0 -left-48" />
          </div>
          <div className="px-4 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
