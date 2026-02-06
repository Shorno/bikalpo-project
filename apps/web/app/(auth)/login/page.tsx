import type { Metadata } from "next";
import { LoginForm } from "@/components/features/auth/login-form";
import { SITE_NAME } from "@/constants/site-info";

export const metadata: Metadata = {
  title: "Login",
  description: `Sign in to your ${SITE_NAME} account to manage your orders and profile.`,
};

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100dvh-130px)] flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <LoginForm />
      </div>
    </div>
  );
}
