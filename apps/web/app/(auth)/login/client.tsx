"use client";

import { Navbar } from "@/components/layout/navbar";
import { AuthModal } from "@/components/features/auth/auth-modal";

export function LoginPageClient() {
  const handleComplete = () => {
    // Read role cookie to determine redirect destination
    const roleCookie = document.cookie.split("; ").find(c => c.startsWith("user-role="));
    const role = roleCookie?.split("=")[1];
    
    if (role === "shop_owner") {
      window.location.href = "http://shop.bikalpo.localhost:3001/dashboard";
    } else if (role === "admin" || role === "salesman" || role === "deliveryman") {
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
