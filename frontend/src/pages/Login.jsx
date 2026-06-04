import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Compass, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { formatApiError } from "@/lib/api";

const HERO_IMG =
  "https://images.unsplash.com/photo-1770553128747-0ec1a368e395?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzd8MHwxfHNlYXJjaHwyfHxzY2VuaWMlMjBjb2FzdGFsJTIwbGFuZHNjYXBlJTIwdHJhdmVsfGVufDB8fHx8MTc4MDMyOTY2Nnww&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await signup(fullName, email, password);
      }
      navigate("/");
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-[#F7F6F2]">
      {/* Hero image */}
      <div className="hidden lg:block lg:w-1/2 relative">
        <img
          src={HERO_IMG}
          alt="Scenic coastal landscape"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#292524]/70 via-transparent to-transparent" />
        <div className="absolute bottom-12 left-12 right-12 text-white">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-white/80 mb-3">
            OdysAI · Travel Planner
          </p>
          <h2 className="font-heading text-4xl xl:text-5xl font-medium leading-tight">
            Plan unforgettable journeys, one conversation at a time.
          </h2>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm odys-fade-up">
          <div className="flex items-center gap-2 mb-10">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3F5E4D] text-white">
              <Compass className="h-5 w-5" strokeWidth={1.5} />
            </span>
            <span className="font-heading text-2xl font-semibold text-[#292524]">OdysAI</span>
          </div>

          <h1 className="font-heading text-3xl sm:text-4xl font-medium text-[#292524] mb-2">
            {mode === "login" ? "Welcome back" : "Start exploring"}
          </h1>
          <p className="text-[#78716C] mb-8 text-sm">
            {mode === "login"
              ? "Sign in to continue planning your travels."
              : "Create an account to craft your first itinerary."}
          </p>

          <form onSubmit={submit} className="space-y-4" data-testid="auth-form">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="font-mono text-xs uppercase tracking-[0.2em] text-[#78716C]">
                  Full Name
                </Label>
                <Input
                  id="fullName"
                  data-testid="signup-fullname-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Amelia Earhart"
                  required
                  className="bg-white border-stone-200 h-11"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="font-mono text-xs uppercase tracking-[0.2em] text-[#78716C]">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                data-testid="auth-email-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="bg-white border-stone-200 h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="font-mono text-xs uppercase tracking-[0.2em] text-[#78716C]">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                data-testid="auth-password-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="bg-white border-stone-200 h-11"
              />
            </div>

            {error && (
              <p data-testid="auth-error" className="text-sm text-[#b91c1c]">
                {error}
              </p>
            )}

            <Button
              type="submit"
              data-testid="auth-submit-btn"
              disabled={loading}
              className="w-full h-11 bg-[#C05621] hover:bg-[#A8481B] text-white transition-all hover:-translate-y-0.5"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "login" ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-[#78716C]">
            {mode === "login" ? "No account yet?" : "Already have an account?"}{" "}
            <button
              type="button"
              data-testid="auth-toggle-btn"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError("");
              }}
              className="font-medium text-[#C05621] hover:underline"
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
