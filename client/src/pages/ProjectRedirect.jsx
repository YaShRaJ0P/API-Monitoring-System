import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { slugify } from "@/lib/slugify";

/**
 * ProjectRedirect - Handles the bare root "/" route.
 * Redirects authenticated users to their first project's dashboard.
 * OnboardingGuard above this will catch the zero-project case first.
 */
export default function ProjectRedirect() {
  const { projects } = useSelector((state) => state.auth);

  if (!projects || projects.length === 0) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Navigate to={`/${slugify(projects[0].name)}/dashboard`} replace />;
}
