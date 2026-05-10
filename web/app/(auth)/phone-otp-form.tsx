"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Loader2, Phone, ShieldCheck } from "lucide-react";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { fetchUserRole, landingFor } from "@/lib/auth";
import { useAuthStore } from "@/lib/stores/auth.store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PhoneOtpForm({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [phone, setPhone] = useState("+91");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"phone" | "otp">("phone");
  const [submitting, setSubmitting] = useState(false);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const confirmRef = useRef<ConfirmationResult | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      try {
        verifierRef.current?.clear();
        verifierRef.current = null;
      } catch {}
    };
  }, []);

  const ensureVerifier = async () => {
    if (verifierRef.current) return verifierRef.current;
    if (!recaptchaContainerRef.current) throw new Error("reCAPTCHA container missing");
    const v = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
      size: "invisible",
    });
    await v.render();
    verifierRef.current = v;
    return v;
  };

  const sendOtp = async () => {
    if (!/^\+\d{8,15}$/.test(phone.trim())) {
      toast.error("Enter phone in international format, e.g. +919999999999");
      return;
    }
    setSubmitting(true);
    try {
      const v = await ensureVerifier();
      const result = await signInWithPhoneNumber(auth, phone.trim(), v);
      confirmRef.current = result;
      setStage("otp");
      toast.success("OTP sent", { description: `Code sent to ${phone.trim()}` });
    } catch (e: any) {
      const msg = e?.code === "auth/invalid-app-credential"
        ? "reCAPTCHA validation failed. Refresh the page and retry."
        : e?.code === "auth/billing-not-enabled"
          ? "Phone auth requires Firebase Blaze plan."
          : e?.message || "OTP send failed";
      toast.error("Couldn\u2019t send OTP", { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const verifyOtp = async () => {
    if (!/^\d{6}$/.test(otp)) {
      toast.error("Enter the 6-digit OTP");
      return;
    }
    if (!confirmRef.current) {
      toast.error("Session expired, request OTP again");
      setStage("phone");
      return;
    }
    setSubmitting(true);
    try {
      const cred = await confirmRef.current.confirm(otp);
      const user = await fetchUserRole(cred.user.uid, cred.user.email);
      setUser(user);
      toast.success(`Welcome, ${user.name || user.email || "operator"}`);
      router.push(landingFor(user.role));
    } catch (e: any) {
      toast.error("OTP verification failed", { description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
      data-testid="phone-otp-form"
    >
      <div ref={recaptchaContainerRef} id="recaptcha-container" />
      <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/[0.03] px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/60">
        <Phone className="h-3 w-3 text-cyan" />
        Phone OTP
      </div>

      {stage === "phone" ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="phone">Mobile number</Label>
            <Input
              id="phone"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+919999999999"
              data-testid="phone-input"
            />
            <p className="text-[11px] text-white/40">
              Use the international format including country code.
            </p>
          </div>
          <Button onClick={sendOtp} disabled={submitting} className="w-full" size="lg" data-testid="phone-send-otp">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Send OTP
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="otp">6-digit code</Label>
            <Input
              id="otp"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="••••••"
              className="text-center text-2xl font-mono tracking-[0.6em]"
              data-testid="otp-input"
            />
          </div>
          <Button onClick={verifyOtp} disabled={submitting} className="w-full" size="lg" data-testid="phone-verify-otp">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Verify & Continue
          </Button>
          <button
            onClick={() => {
              setOtp("");
              setStage("phone");
            }}
            className="w-full text-center text-[11px] uppercase tracking-[0.18em] text-white/40 hover:text-white"
            data-testid="phone-resend"
          >
            Use a different number
          </button>
        </div>
      )}




      <button
        onClick={onBack}
        className="w-full text-center text-[11px] uppercase tracking-[0.18em] text-white/40 hover:text-cyan"
        data-testid="phone-back"
      >
        ← Back to email login
      </button>
    </motion.div>
  );
}
