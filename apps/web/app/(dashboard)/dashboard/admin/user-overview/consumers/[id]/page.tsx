import { ConsumerDetailClient } from "./consumer-detail-client";

export const metadata = {
  title: "Consumer Details | Admin",
  description: "Consumer profile and activity",
};

export default async function ConsumerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ConsumerDetailClient userId={id} />;
}
