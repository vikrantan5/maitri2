"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] transition-colors",
  {
    variants: {
      variant: {
        default: "border-cyan/30 bg-cyan/10 text-cyan",
        pink: "border-pink/30 bg-pink/10 text-pink",
        amber: "border-amber/30 bg-amber/10 text-amber",
        ok: "border-ok/30 bg-ok/10 text-ok",
        danger: "border-danger/30 bg-danger/10 text-danger",
        outline: "border-[var(--border)] bg-white/[0.02] text-white/60",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
