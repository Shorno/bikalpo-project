"use client";
import { QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type * as React from "react";
import { LoginRequiredProvider } from "@/components/features/auth/login-required-modal";
import { Toaster } from "@/components/ui/sonner";
import { OrpcCartProvider } from "@/hooks/use-orpc-cart";
import { queryClient } from "@/utils/orpc";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>
        <LoginRequiredProvider>
          <OrpcCartProvider>
            <Toaster richColors position={"top-right"} />
            {children}
          </OrpcCartProvider>
        </LoginRequiredProvider>
      </NuqsAdapter>
    </QueryClientProvider>
  );
}
