import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import {
  AccountSidebar,
  type AccountSidebarProps,
} from "@/components/account/account-sidebar";

const accountInter = Inter({
  subsets: ["latin"],
  variable: "--font-account-inter",
});

const ACCOUNT_DIRECTION_CONTRACT = `<!--
THESIS: A registry desk for buyer identity, delivery, and order activity; it refuses the flat settings-menu plus KPI-card default.
OWN-WORLD: Registry Blue, cool zinc canvas, flat white fields, one-pixel structural borders, compact Inter typography, and monospace commerce data.
STORY: A buyer confirms who they are and where orders arrive, then moves directly into current and historical buying work.
FIRST VIEWPORT: A narrow grouped navigation rail frames an asymmetric profile/address summary above one dense recent-order ledger.
FORM: Grouped registry desk, selected from the approved Daraz-informed account research; seed key ACCOUNT-REGISTRY-2026.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->`;

type AccountShellProps = Pick<
  AccountSidebarProps,
  "displayName" | "audience"
> & {
  children: ReactNode;
};

export function AccountShell({
  children,
  displayName,
  audience,
}: AccountShellProps) {
  return (
    <div
      className={`${accountInter.variable} min-h-screen bg-zinc-50 font-(family-name:--font-account-inter)`}
    >
      <div
        aria-hidden="true"
        className="hidden"
        dangerouslySetInnerHTML={{ __html: ACCOUNT_DIRECTION_CONTRACT }}
      />
      <div className="container mx-auto max-w-7xl px-4 py-5 sm:py-7 lg:py-9">
        <div className="grid items-start gap-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-7 xl:grid-cols-[16rem_minmax(0,1fr)] xl:gap-9">
          <AccountSidebar displayName={displayName} audience={audience} />
          <div id="account-content" className="min-w-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
