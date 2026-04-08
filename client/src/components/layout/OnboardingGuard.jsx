import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";

/**
 * Redirects to /onboarding if the authenticated user has no projects.
 * Wrap around routes that require at least one project to be set up.
 * @param {{ children: React.ReactNode }} props
 */
export function OnboardingGuard({ children }) {
  const { projects } = useSelector((state) => state.auth);

  if (projects && projects.length === 0) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}
