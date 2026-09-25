import { Suspense } from "react";
import { ApprovalClient } from "./_components/approval-client";

export const metadata = {
  title: "Approval | Admin",
  description: "Retailer and warehouse requests",
};

export default function ApprovalPage() {
  return (
    <Suspense
      fallback={<div className="h-64 animate-pulse rounded-xl bg-muted" />}
    >
      <ApprovalClient />
    </Suspense>
  );
}
