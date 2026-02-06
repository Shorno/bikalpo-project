import type { Metadata } from "next";
import { SignupForm } from "@/components/features/auth/signup-form";
import { SITE_NAME } from "@/constants/site-info";

export const metadata: Metadata = {
  title: "Sign Up",
  description: `Create a new account to start shopping with ${SITE_NAME}.`,
};

export default function LoginPage() {
  return (
    <div className=" flex min-h-[calc(100dvh-130px)] flex-col items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <SignupForm />
      </div>
    </div>
  );
}
