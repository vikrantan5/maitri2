"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "cyan",
  delay = 0,
  testId,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  accent?: "cyan" | "pink" | "amber" | "ok" | "danger";
  delay?: number;
  testId?: string;
}) {
  const accentMap: Record<string, string> = {
    cyan: "from-cyan/20 to-cyan/0 text-cyan",
    pink: "from-pink/20 to-pink/0 text-pink",
    amber: "from-amber/20 to-amber/0 text-amber",
    ok: "from-ok/20 to-ok/0 text-ok",
    danger: "from-danger/20 to-danger/0 text-danger",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--glass)] p-5 backdrop-blur-xl"
      data-testid={testId}
    >
      <div className={cn("absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br blur-2xl", accentMap[accent])} />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/50">{label}</div>
          <div className="mt-2 font-mono text-3xl font-semibold tracking-tight text-white">{value}</div>
          {hint && <div className="mt-1 text-[11px] text-white/40">{hint}</div>}
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white/[0.03] p-2.5">
          <Icon className={cn("h-4 w-4", accentMap[accent].split(" ").pop())} />
        </div>
      </div>
    </motion.div>
  );
}
