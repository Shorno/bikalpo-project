import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SetupPageShellProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Centered container for the product setup pages. These tables carry 4-7 narrow
 * columns, so a capped measure keeps the row content and its action column
 * within a comfortable scan distance.
 */
export function SetupPageShell({ children, className }: SetupPageShellProps) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl space-y-5", className)}>
      {children}
    </div>
  );
}
