import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { initializeAuth } from "@/store/slices/authSlice";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { OnboardingGuard } from "@/components/layout/OnboardingGuard";
import { Shell } from "@/components/layout/Shell";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// ─── Pages ───
import Login from "@/pages/Login";
import LoginSuccess from "@/pages/LoginSuccess";
import Onboarding from "@/pages/Onboarding";
import Dashboard from "@/pages/Dashboard";
import Services from "@/pages/Services";
import Alerts from "@/pages/Alerts";
import Logs from "@/pages/Logs";
import Integration from "@/pages/Integration";
import Settings from "@/pages/Settings";
import DlqMonitor from "@/pages/DlqMonitor";

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
 * Sets up providers (React Query, Tooltip, Toaster),
 * initializes auth on mount, and defines all routes.
 */
export default function App() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(initializeAuth());
  }, [dispatch]);

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Routes>
            {/* ─── Public Routes ─── */}
            <Route path="/login" element={<Login />} />
            <Route path="/login/success" element={<LoginSuccess />} />

            {/* ─── Onboarding (protected, no sidebar) ─── */}
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute>
                  <Onboarding />
                </ProtectedRoute>
              }
            />

            {/* ─── App Routes (protected + onboarding guard + sidebar) ─── */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <OnboardingGuard>
                    <Shell>
                      <Dashboard />
                    </Shell>
                  </OnboardingGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/services"
              element={
                <ProtectedRoute>
                  <OnboardingGuard>
                    <Shell>
                      <Services />
                    </Shell>
                  </OnboardingGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/alerts"
              element={
                <ProtectedRoute>
                  <OnboardingGuard>
                    <Shell>
                      <Alerts />
                    </Shell>
                  </OnboardingGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/logs"
              element={
                <ProtectedRoute>
                  <OnboardingGuard>
                    <Shell>
                      <Logs />
                    </Shell>
                  </OnboardingGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/integration"
              element={
                <ProtectedRoute>
                  <OnboardingGuard>
                    <Shell>
                      <Integration />
                    </Shell>
                  </OnboardingGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <OnboardingGuard>
                    <Shell>
                      <Settings />
                    </Shell>
                  </OnboardingGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/dlq"
              element={
                <ProtectedRoute>
                  <OnboardingGuard>
                    <Shell>
                      <DlqMonitor />
                    </Shell>
                  </OnboardingGuard>
                </ProtectedRoute>
              }
            />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </TooltipProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
