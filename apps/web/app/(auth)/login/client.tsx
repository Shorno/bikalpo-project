"use client";

import { Navbar } from "@/components/layout/navbar";
import { AuthModal } from "@/components/features/auth/auth-modal";

export function LoginPageClient() {
  const handleComplete = () => {
    window.location.href = "/";
  };

  return (
    <>
      <Navbar />
      <div className="flex h-[calc(100vh-105px)] items-center justify-center bg-[#FAF6F6] p-4 md:p-10">
        <AuthModal isOpen={true} onClose={handleComplete} embedded />
      </div>
    </>
  );
}
