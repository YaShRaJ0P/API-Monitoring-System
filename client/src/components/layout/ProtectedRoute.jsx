import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { Activity } from "lucide-react";

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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="size-16 bg-primary/10 rounded-2xl flex items-center justify-center">
            <Activity className="size-8 text-primary" />
          </div>
          <p className="text-muted-foreground text-sm font-medium">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
