"use client";

import { Navbar } from "@/components/layout/navbar";
import { AuthModal } from "@/components/features/auth/auth-modal";

export function LoginPageClient() {
  const handleComplete = () => {
    // Read role cookie to determine redirect destination
    const roleCookie = document.cookie.split("; ").find(c => c.startsWith("user-role="));
    const role = roleCookie?.split("=")[1];
    
    // Route all authenticated staff through the main dashboard dispatcher first.
    // It resolves the live session and then forwards cross-subdomain roles safely.
    if (role === "shop_owner" || role === "warehouse" || role === "admin" || role === "salesman" || role === "deliveryman") {
      window.location.href = "/dashboard";
    } else {
      window.location.href = "/";
    }
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
