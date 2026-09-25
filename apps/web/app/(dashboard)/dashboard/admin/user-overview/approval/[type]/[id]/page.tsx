import { notFound } from "next/navigation";
import {
  ApprovalDetailClient,
  type ApprovalType,
} from "../../_components/approval-detail-client";

export const metadata = {
  title: "Request Details | Admin",
  description: "Review a retailer or warehouse request",
};

const VALID_TYPES: ApprovalType[] = ["seller", "warehouse"];

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = await params;

  if (!VALID_TYPES.includes(type as ApprovalType)) {
    notFound();
  }

  return (
    <ApprovalDetailClient type={type as ApprovalType} applicationId={id} />
  );
}
