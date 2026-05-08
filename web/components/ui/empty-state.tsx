import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01] p-8 text-center",
        className,
      )}
      {...props}
    >
      {Icon && (
        <div className="mb-3 rounded-full border border-white/10 bg-white/[0.03] p-3">
          <Icon className="h-5 w-5 text-white/50" />
        </div>
      )}
      <p className="text-sm font-medium text-white">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-white/40">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
