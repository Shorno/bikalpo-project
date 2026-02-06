"use client";
import { QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type * as React from "react";
import { LoginRequiredProvider } from "@/components/features/auth/login-required-modal";
import { Toaster } from "@/components/ui/sonner";
import { CartProvider } from "@/hooks/use-cart";
import {queryClient} from "@/utils/orpc";

export default function Providers({ children }: { children: React.ReactNode }) {

  return (
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>
        <LoginRequiredProvider>
          <CartProvider>
            <Toaster richColors position={"top-right"} />
            {children}
          </CartProvider>
        </LoginRequiredProvider>
      </NuqsAdapter>
    </QueryClientProvider>
  );
}
