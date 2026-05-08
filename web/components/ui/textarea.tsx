"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[88px] w-full rounded-xl border border-[var(--border)] bg-white/[0.02] px-4 py-3 text-sm text-white placeholder:text-white/30 transition-colors",
        "focus-visible:outline-none focus-visible:border-[var(--border-hi)] focus-visible:bg-white/[0.04]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
