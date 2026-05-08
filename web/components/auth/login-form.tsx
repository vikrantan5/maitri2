"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, LogIn, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { loginWithEmail, landingFor } from "@/lib/auth";
import { useAuthStore } from "@/lib/stores/auth.store";

const schema = z.object({
  email: z.string().email("Enter a valid work email"),
  password: z.string().min(6, "Min 6 characters"),
});

type FormValues = z.infer<typeof schema>;

export default function LoginForm() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async ({ email, password }: FormValues) => {
    setSubmitting(true);
    try {
      const user = await loginWithEmail(email, password);
      setUser(user);
      toast.success(`Welcome back, ${user.name || user.email || "operator"}`, {
        description: `Signed in as ${user.role.replace("_", " ")}`,
      });
      router.push(landingFor(user.role));
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code || "";
      const map: Record<string, string> = {
        "auth/invalid-credential": "Invalid email or password.",
        "auth/wrong-password": "Wrong password.",
        "auth/user-not-found": "No account with that email.",
        "auth/too-many-requests": "Too many attempts. Try again later.",
        "auth/network-request-failed": "Network error. Check your connection.",
      };
      toast.error("Sign-in failed", { description: map[code] || (e as Error)?.message || "Unknown error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full max-w-md"
    >
      <Card data-testid="login-card">
        <CardHeader>
          <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-white/[0.03] px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/60">
            <ShieldCheck className="h-3 w-3 text-cyan" />
            Secure access
          </div>
          <CardTitle>Sign in to Saheli</CardTitle>
          <CardDescription>
            Authorized personnel only. All sessions are logged for audit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" data-testid="login-form">
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                placeholder="officer@station.gov.in"
                autoComplete="email"
                data-testid="login-email-input"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-danger" data-testid="login-email-error">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  className="text-[11px] uppercase tracking-[0.18em] text-white/40 transition-colors hover:text-cyan"
                  onClick={() =>
                    toast.info("Password reset", {
                      description: "Contact your super-admin to reset credentials.",
                    })
                  }
                  data-testid="login-forgot-button"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPwd ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  data-testid="login-password-input"
                  {...register("password")}
                  className="pr-11"
                />
                <button
                  type="button"
                  aria-label={showPwd ? "Hide password" : "Show password"}
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 transition-colors hover:text-white"
                  data-testid="login-toggle-password-button"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-danger" data-testid="login-password-error">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={submitting}
              data-testid="login-submit-button"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Authenticating…
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Sign in
                </>
              )}
            </Button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-[var(--border)]" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em]">
                <span className="bg-[var(--bg-0)] px-2 text-white/40">or</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full"
              onClick={() =>
                toast.info("Phone OTP", {
                  description: "Phone-OTP login is wired to Firebase reCAPTCHA — coming in Phase 2.",
                })
              }
              data-testid="login-phone-otp-button"
            >
              Continue with phone OTP
            </Button>

            <p className="pt-2 text-center text-[12px] text-white/40">
              Police station owner?{" "}
              <a
                href="/register-station"
                className="text-cyan transition-colors hover:text-pink"
                data-testid="login-register-station-link"
              >
                Register your station
              </a>
            </p>
          </form>
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-[11px] uppercase tracking-[0.18em] text-white/30">
        © Saheli Operations · v0.1.0
      </p>
    </motion.div>
  );
}
