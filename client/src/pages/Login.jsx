import { Button } from "@/components/ui/button";
import { getGoogleOAuthUrl, getDemoLoginUrl } from "@/api/auth.api";
import { Zap } from "lucide-react";
import { config } from "@/config";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";

/**
 * Login page with Google OAuth sign-in.
 * Redirects to the app if the user is already authenticated.
 */
export default function Login() {
  const { isAuthenticated, loading, projects } = useSelector((state) => state.auth);

  // Redirect authenticated users away from /login
  if (!loading && isAuthenticated) {
    if (projects && projects.length > 0) {
      return <Navigate to="/" replace />;
    }
    return <Navigate to="/onboarding" replace />;
  }

  const handleGoogleLogin = () => {
    window.location.href = getGoogleOAuthUrl();
  };

  const handleDemoLogin = () => {
    window.location.href = getDemoLoginUrl();
  };

  return (
    <div className="relative min-h-screen w-full bg-[#09090e] flex items-center justify-center p-4 overflow-hidden dark">
      {/* Ambient background glows */}
      <div className="absolute size-[600px] rounded-full bg-cyan-500 blur-[160px] opacity-10 -top-48 -right-48 pointer-events-none" />
      <div className="absolute size-[500px] rounded-full bg-violet-600 blur-[160px] opacity-10 bottom-0 -left-48 pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(34,211,238,0.07), transparent)",
        }}
      />

      {/* Card */}
      <div
        className="relative w-full max-w-sm animate-in fade-in slide-in-from-bottom-6 duration-700"
        style={{ animationDelay: "100ms" }}
      >
        {/* Gradient border effect */}
        <div className="p-px rounded-2xl bg-linear-to-b from-white/10 to-white/5">
          <div className="relative rounded-2xl bg-[#111118]/90 backdrop-blur-xl p-8">
            {/* Logo & heading */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="relative mb-4">
                <div className="absolute inset-0 rounded-2xl bg-cyan-400/20 blur-xl" />
                <img
                  src={config.logo}
                  className="relative size-14 rounded-xl"
                  alt="logo"
                />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                {config.name}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                API Monitoring &amp; Observability
              </p>
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/8" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-[#111118] px-3 text-xs text-slate-500 uppercase tracking-widest">
                  Sign in to continue
                </span>
              </div>
            </div>

            {/* Google OAuth Button */}
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 h-11 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-cyan-400/30 text-sm font-medium text-slate-200 transition-all duration-200 group"
            >
              <svg className="size-4 shrink-0" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </button>

            {/* Primary CTA pulse */}
            <div className="mt-3">
              <Button
                onClick={handleDemoLogin}
                className="w-full h-11 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-[#09090e] font-semibold text-sm pulse-cyan transition-all duration-200 gap-2"
              >
                <Zap className="size-4" /> Explore Live Demo
              </Button>
            </div>

            {/* Footer */}
            <p className="text-center text-xs text-slate-600 mt-6 leading-relaxed">
              By signing in, you agree to our{" "}
              <span className="text-slate-400 hover:text-cyan-400 cursor-pointer transition-colors">
                Terms
              </span>{" "}
              and{" "}
              <span className="text-slate-400 hover:text-cyan-400 cursor-pointer transition-colors">
                Privacy Policy
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
