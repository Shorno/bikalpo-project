import { ApprovalClient } from "./_components/approval-client";

export const metadata = {
  title: "Approval & Verification | Admin",
  description: "Onboarding and verification workflow",
};

export default function ApprovalPage() {
  return (
    <div className="p-4 sm:p-6">
      <ApprovalClient />
    </div>
  );
}
