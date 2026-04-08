import { useEffect } from "react";
import { useParams, Navigate, Outlet } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { setActiveProject } from "@/store/slices/authSlice";
import { slugify } from "@/lib/slugify";

/**
 * ProjectLayout - URL ↔ Redux bridge for project-scoped routes. *
 * Redirects to the first available project slug if no match is found.
 */
export function ProjectLayout() {
  const { projectName } = useParams();
  const dispatch = useDispatch();
  const { projects, activeProjectId } = useSelector((state) => state.auth);

  // Match the URL slug against slugified project names
  const matchedProject = projects.find((p) => slugify(p.name) === projectName);

  useEffect(() => {
    if (matchedProject && matchedProject.id !== activeProjectId) {
      dispatch(setActiveProject(matchedProject.id));
    }
  }, [matchedProject, activeProjectId, dispatch]);

  // Unknown slug → redirect to first known project
  if (!matchedProject) {
    if (projects.length === 0) {
      return <Navigate to="/onboarding" replace />;
    }
    return <Navigate to={`/${slugify(projects[0].name)}/dashboard`} replace />;
  }

  return <Outlet />;
}
