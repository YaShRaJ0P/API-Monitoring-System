import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

/**
 * Protects routes that require authentication.
 * Shows a loading spinner while auth state is initializing,
 * redirects to /login if not authenticated.
 * @param {{ children: React.ReactNode }} props
 */
export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useSelector((state) => state.auth);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="size-7 text-cyan-500 animate-spin mb-4" />
        <p className="text-muted-foreground text-sm font-medium">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
