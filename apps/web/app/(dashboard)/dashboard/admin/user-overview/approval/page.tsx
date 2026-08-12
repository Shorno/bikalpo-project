import { Suspense } from "react";
import { ApprovalClient } from "./_components/approval-client";

export const metadata = {
  title: "Approval & Verification | Admin",
  description: "Shop Owner and Warehouse Owner onboarding workflow",
};

export default function ApprovalPage() {
  return (
    <div className="p-4 sm:p-6">
      <Suspense
        fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}
      >
        <ApprovalClient />
      </Suspense>
    </div>
  );
}
