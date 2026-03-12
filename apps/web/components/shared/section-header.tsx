import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  viewAllHref?: string;
  countdown?: React.ReactNode;
  className?: string;
  variant?: "default" | "light";
}

export function SectionHeader({
  title,
  viewAllHref,
  countdown,
  className,
  variant = "default",
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between mb-4 border-b pb-2",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <h2
          className={cn(
            "text-lg sm:text-xl font-bold uppercase",
            variant === "light" ? "text-white" : "text-gray-900",
          )}
        >
          {title}
        </h2>
        {countdown}
      </div>
      {viewAllHref && (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className={cn(
            "font-medium",
            variant === "light"
              ? "text-white hover:text-white/90 hover:bg-white/10"
              : "text-primary hover:text-primary/80",
          )}
        >
          <Link href={viewAllHref} className="flex items-center gap-1">
            View All
            <ChevronRight className="size-4" />
          </Link>
        </Button>
      )}
    </div>
  );
}
