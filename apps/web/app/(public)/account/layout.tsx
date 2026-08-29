export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account/account-shell";
import { checkAuth } from "@/utils/auth";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await checkAuth();

  if (!session?.user) {
    redirect("/login?redirect=/account");
  }

  return (
    <AccountShell
      displayName={session.user.name || "there"}
      audience="consumer"
    >
      {children}
    </AccountShell>
  );
}
