import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SetupPageShellProps = {
  children: ReactNode;
  className?: string;
  width?: "compact" | "standard" | "wide" | "expanded";
};

const widthClasses = {
  compact: "max-w-3xl",
  standard: "max-w-4xl",
  wide: "max-w-5xl",
  expanded: "max-w-6xl",
} as const;

export function SetupPageShell({
  children,
  className,
  width,
}: SetupPageShellProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full space-y-5 max-md:min-w-0 max-md:space-y-4 max-md:[&_table]:table-fixed max-md:[&_[data-slot=skeleton]]:max-w-full",
        width ? widthClasses[width] : "max-w-7xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
