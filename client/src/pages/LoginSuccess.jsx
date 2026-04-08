import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import { handleOAuthCallback } from "@/store/slices/authSlice";
import { Loader2 } from "lucide-react";

/**
 * OAuth callback landing page.
 * Reads the accessToken from URL params, stores it via Redux,
 * fetches the user profile, and redirects to the dashboard.
 */
export default function LoginSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  useEffect(() => {
    const token = searchParams.get("accessToken");

    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    dispatch(handleOAuthCallback(token))
      .unwrap()
      .then((data) => {
        if (data.projects && data.projects.length > 0) {
          navigate("/", { replace: true });
        } else {
          navigate("/onboarding", { replace: true });
        }
      })
      .catch(() => navigate("/login?error=auth_failed", { replace: true }));
  }, [searchParams, navigate, dispatch]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-cyan-500">
        <Loader2 className="size-7 animate-spin" />
        <p className="text-muted-foreground text-sm font-medium">
          Completing sign in...
        </p>
      </div>
    </div>
  );
}
