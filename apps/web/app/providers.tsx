"use client";
import { QueryClientProvider } from "@tanstack/react-query";
import type * as React from "react";
import { LoginRequiredProvider } from "@/components/features/auth/login-required-modal";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OrpcCartProvider } from "@/hooks/use-orpc-cart";
import { queryClient } from "@/utils/orpc";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <LoginRequiredProvider>
        <OrpcCartProvider>
          <TooltipProvider>
            <Toaster richColors position={"top-right"} />
            {children}
          </TooltipProvider>
        </OrpcCartProvider>
      </LoginRequiredProvider>
    </QueryClientProvider>
  );
}
