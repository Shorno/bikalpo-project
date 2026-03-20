"use client";

import { useRouter } from "next/navigation";
import { AuthModal } from "@/components/features/auth/auth-modal";

export default function InterceptedLoginPage() {
  const router = useRouter();

  return (
    <AuthModal
      isOpen={true}
      onClose={() => router.back()}
    />
  );
}
