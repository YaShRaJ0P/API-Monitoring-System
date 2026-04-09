import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  User,
  FolderOpen,
  Plus,
  Trash2,
  Copy,
  Check,
  Key,
  ExternalLink,
  Calendar,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { createProject, listProjects, deleteProject } from "@/api/tenant.api";
import { setProjects, setActiveProject } from "@/store/slices/authSlice";
import { slugify } from "@/lib/slugify";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

/**
 * Settings page - profile overview + project management with API keys.
 */
export default function Settings() {
  const { user, projects, activeProjectId } = useSelector(
    (state) => state.auth,
  );
  const { projectName: projectSlug } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [newProjectName, setNewProjectName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);


  const handleCopy = (keyType, text) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyType);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      await createProject(newProjectName.trim());
      const updatedProjects = await listProjects();
      dispatch(setProjects(updatedProjects));
      setNewProjectName("");
    } catch {
      setCreateError("Failed to create project. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = async (id, name) => {
    setDeleting(id);
    try {
      await deleteProject(id);
      const updatedProjects = await listProjects();
      dispatch(setProjects(updatedProjects));
      if (id === activeProjectId) {
        const remaining = updatedProjects.filter((p) => p.id !== id);
        if (remaining.length > 0) {
          dispatch(setActiveProject(remaining[0].id));
          navigate(`/${slugify(remaining[0].name)}/settings`, {
            replace: true,
          });
        } else {
          navigate("/onboarding", { replace: true });
        }
      }
    } finally {
      setDeleting(null);
    }
  };

  const cardCls =
    "relative rounded-2xl bg-[#111118] border border-white/5 overflow-hidden";
  const inputCls =
    "bg-white/5 border-white/10 focus:border-cyan-400/30 rounded-xl placeholder:text-slate-600 text-slate-300";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Account details and project management.
        </p>
      </div>

      {/* ---- Profile ---- */}
      <div className={cardCls}>
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-cyan-400/30 to-transparent" />
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <User className="size-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Profile</h2>
          </div>
          <div className="flex items-center gap-4 mb-4">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="size-14 rounded-full object-cover ring-2 ring-cyan-400/20"
              />
            ) : (
              <div className="size-14 rounded-full bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center text-cyan-400 font-bold text-xl">
                {user?.name?.[0]?.toUpperCase() || "?"}
              </div>
            )}
            <div>
              <p className="font-semibold text-white">
                {user?.name || "Unknown"}
              </p>
              <p className="text-sm text-slate-400">{user?.email || "-"}</p>
              <p className="text-xs text-slate-600 mt-0.5">Google OAuth</p>
            </div>
          </div>
          <Separator className="bg-white/5 mb-4" />
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-slate-600 mb-1">Account ID</p>
              <p className="mono text-slate-400 truncate">{user?.id || "-"}</p>
            </div>
            <div>
              <p className="text-slate-600 mb-1">Projects</p>
              <p className="text-slate-400">
                {projects.length} project{projects.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Projects & API Keys ---- */}
      <div className={cardCls}>
        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-violet-400/30 to-transparent" />
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="size-4 text-violet-400" />
            <h2 className="text-sm font-semibold text-white">
              Projects &amp; API Keys
            </h2>
          </div>

          {/* Project list */}
          <div className="space-y-2 mb-4">
            {projects.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-6">
                No projects yet. Create one below.
              </p>
            ) : (
              projects.map((project) => {
                const isActive = project.id === activeProjectId;
                const isDeleting = deleting === project.id;
                const createdAt = project.created_at
                  ? format(new Date(project.created_at), "MMM d, yyyy")
                  : null;

                return (
                  <div
                    key={project.id}
                    className={cn(
                      "flex items-center gap-3 p-3.5 rounded-xl border transition-all group",
                      isActive
                        ? "border-cyan-400/20 bg-cyan-400/5"
                        : "border-white/5 hover:border-white/10 hover:bg-white/3",
                    )}
                  >
                    <div
                      className={cn(
                        "size-8 rounded-lg flex items-center justify-center shrink-0",
                        isActive ? "bg-cyan-400/10" : "bg-white/5",
                      )}
                    >
                      <FolderOpen
                        className={cn(
                          "size-4",
                          isActive ? "text-cyan-400" : "text-slate-500",
                        )}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm text-slate-200 truncate">
                          {project.name}
                        </p>
                        {isActive && (
                          <span className="badge badge-cyan shrink-0">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-0.5">
                        <p
                          className="text-xs mono text-slate-500 truncate max-w-[140px]"
                          title="API Key"
                        >
                          <span className="text-slate-600 mr-1">KEY:</span>
                          {project.api_key}
                        </p>
                        <p
                          className="text-xs mono text-slate-500 truncate max-w-[140px]"
                          title="API Secret"
                        >
                          <span className="text-slate-600 mr-1">SEC:</span>
                          <span className="blur-sm group-hover:blur-none transition-all">
                            {project.api_secret}
                          </span>
                        </p>
                      </div>
                    </div>

                    {createdAt && (
                      <div className="hidden sm:flex items-center gap-1 text-xs text-slate-600 shrink-0 mr-2">
                        <Calendar className="size-3" />
                        {createdAt}
                      </div>
                    )}

                    {/* Copy key/secret */}
                    <button
                      onClick={() =>
                        handleCopy(project.id + "-key", project.api_key)
                      }
                      title="Copy API key"
                      className="size-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-cyan-400 hover:bg-white/5 transition-all shrink-0"
                    >
                      {copiedKey === project.id + "-key" ? (
                        <Check className="size-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() =>
                        handleCopy(project.id + "-sec", project.api_secret)
                      }
                      title="Copy API secret"
                      className="size-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-rose-400 hover:bg-white/5 transition-all shrink-0"
                    >
                      {copiedKey === project.id + "-sec" ? (
                        <Check className="size-3.5 text-emerald-400" />
                      ) : (
                        <Key className="size-3.5" />
                      )}
                    </button>

                    {/* Delete */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          disabled={isDeleting}
                          title="Delete project"
                          className="size-7 flex items-center justify-center rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-400/5 transition-all shrink-0 disabled:opacity-40"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-[#16161f] border border-white/10 rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-white flex items-center gap-2">
                            <AlertCircle className="size-4 text-rose-400" />
                            Delete "{project.name}"?
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-400">
                            This permanently deletes the project and its API
                            key. Services using this key will stop sending data.
                            Existing metrics remain.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-white/5 border-white/10 text-slate-300 hover:text-white rounded-xl">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              handleDeleteProject(project.id, project.name)
                            }
                            className="bg-rose-500 hover:bg-rose-400 text-white rounded-xl"
                          >
                            {isDeleting ? "Deleting…" : "Delete Project"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                );
              })
            )}
          </div>

          {/* Create new project */}
          <div className="flex items-center gap-2 pt-3 border-t border-white/5">
            <Input
              className={cn(inputCls, "flex-1 h-9 text-sm")}
              placeholder="New project name…"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
              disabled={creating}
            />
            <button
              onClick={handleCreateProject}
              disabled={creating || !newProjectName.trim()}
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#09090e] text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <Plus className="size-3.5" />
              {creating ? "Creating…" : "Create"}
            </button>
          </div>
          {createError && (
            <p className="text-xs text-rose-400 mt-2">{createError}</p>
          )}
        </div>
      </div>

      {/* ---- Quick link to Integration docs ---- */}
      <div className={cardCls}>
        <div className="p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-white/5 flex items-center justify-center">
              <Key className="size-4 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">
                Integration Docs
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                SDK setup and payload reference
              </p>
            </div>
          </div>
          <Link
            to={`/${projectSlug}/integration`}
            className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            View docs
            <ChevronRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
