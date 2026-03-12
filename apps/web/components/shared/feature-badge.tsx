import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureBadgeProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  className?: string;
}

export function FeatureBadge({
  icon: Icon,
  title,
  subtitle,
  className,
}: FeatureBadgeProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="size-5 text-primary" />
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-900 leading-tight">
          {title}
        </p>
        <p className="text-[11px] text-gray-500 leading-tight">{subtitle}</p>
      </div>
    </div>
  );
}
