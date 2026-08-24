"use client";
import { QueryClientProvider } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import type * as React from "react";
import { LoginRequiredProvider } from "@/components/features/auth/login-required-modal";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OrpcCartProvider } from "@/hooks/use-orpc-cart";
import { queryClient } from "@/utils/orpc";

function RouteAwareCartProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDashboardRoute =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/warehouse/") ||
    pathname.startsWith("/delivery/") ||
    pathname.startsWith("/sales/");

  if (isDashboardRoute) {
    return <>{children}</>;
  }

  return <OrpcCartProvider>{children}</OrpcCartProvider>;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <LoginRequiredProvider>
        <RouteAwareCartProvider>
          <TooltipProvider>
            <Toaster richColors position={"top-right"} />
            {children}
          </TooltipProvider>
        </RouteAwareCartProvider>
      </LoginRequiredProvider>
    </QueryClientProvider>
  );
}
