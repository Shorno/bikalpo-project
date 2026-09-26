import type { ReactNode } from "react";

export function SetupActionRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 [&_button]:min-h-9 max-md:[&_button]:min-h-11">
      {children}
    </div>
  );
}
