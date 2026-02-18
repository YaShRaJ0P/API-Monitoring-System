import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";

/**
 * Redirects to /onboarding if the authenticated user has no env_id.
 * Wrap around routes that require an API key to be set up.
 * @param {{ children: React.ReactNode }} props
 */
export function OnboardingGuard({ children }) {
  const { user } = useSelector((state) => state.auth);

  if (user && !user.env_id) {
    return <Navigate to="/onboarding" replace />;
  }

  return children;
}
