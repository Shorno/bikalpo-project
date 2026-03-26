import type { Metadata } from "next";
import { SITE_NAME } from "@/constants/site-info";
import { LoginPageClient } from "./client";

export const metadata: Metadata = {
  title: "Login",
  description: `Sign in to your ${SITE_NAME} account to manage your orders and profile.`,
};

export default function LoginPage() {
  return <LoginPageClient />;
}
