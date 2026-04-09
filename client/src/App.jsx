import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { initializeAuth } from "@/store/slices/authSlice";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { OnboardingGuard } from "@/components/layout/OnboardingGuard";
import { ProjectLayout } from "@/components/layout/ProjectLayout";
import { Shell } from "@/components/layout/Shell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { getAccessToken } from "@/api/client";

// ---- Pages ----
import Login from "@/pages/Login";
import LoginSuccess from "@/pages/LoginSuccess";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import Services from "@/pages/Services";
import Alerts from "@/pages/Alerts";
import Logs from "@/pages/Logs";
import Integration from "@/pages/Integration";
import Settings from "@/pages/Settings";
import AdminPanel from "@/pages/Admin";
import ProjectRedirect from "@/pages/ProjectRedirect";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Root application component.
 */
export default function App() {
  const dispatch = useDispatch();
  const accessToken = getAccessToken();
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  useEffect(() => {
    const isOAuthCallback =
      window.location.pathname.startsWith("/login/success");
    if (isOAuthCallback || isAuthenticated || accessToken) return;
    dispatch(initializeAuth());
  }, [dispatch]);

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Routes>
            {/* ---- Public Routes ---- */}
            <Route path="/login" element={<Login />} />
            <Route path="/login/success" element={<LoginSuccess />} />

            {/* ---- Onboarding (protected, no shell) ---- */}
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              }
            />

            {/* ---- Project-scoped app routes ---- */}
            <Route
              path="/:projectName"
              element={
                <ProtectedRoute>
                  <OnboardingGuard>
                    <ProjectLayout />
                  </OnboardingGuard>
                </ProtectedRoute>
              }
            >
              {/* Default: /:projectName → /:projectName/dashboard */}
              <Route index element={<Navigate to="dashboard" replace />} />

              <Route
                path="dashboard"
                element={
                  <Shell>
                    <Dashboard />
                  </Shell>
                }
              />
              <Route
                path="services"
                element={
                  <Shell>
                    <Services />
                  </Shell>
                }
              />
              <Route
                path="alerts"
                element={
                  <Shell>
                    <Alerts />
                  </Shell>
                }
              />
              <Route
                path="logs"
                element={
                  <Shell>
                    <Logs />
                  </Shell>
                }
              />
              <Route
                path="integration"
                element={
                  <Shell>
                    <Integration />
                  </Shell>
                }
              />
              <Route
                path="settings"
                element={
                  <Shell>
                    <Settings />
                  </Shell>
                }
              />
              <Route
                path="admin"
                element={
                  <Shell>
                    <AdminPanel />
                  </Shell>
                }
              />
            </Route>

            {/* ---- Root redirect → first project's dashboard ---- */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <OnboardingGuard>
                    <ProjectRedirect />
                  </OnboardingGuard>
                </ProtectedRoute>
              }
            />

            {/* ---- Catch-all ---- */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </TooltipProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
