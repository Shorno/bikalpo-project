import { AlertCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { client } from "@/utils/orpc";
import { ComplaintDetailsClient } from "./complaint-details-client";

interface AdminComplaintDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminComplaintDetailPage({
  params,
}: AdminComplaintDetailPageProps) {
  const { id } = await params;
  const complaintId = parseInt(id, 10);

  if (Number.isNaN(complaintId)) {
    notFound();
  }

  try {
    const result = await client.adminComplaint.getById({ id: complaintId });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <ComplaintDetailsClient complaint={result.data as any} />;
  } catch {
    return (
      <div className="p-6">
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900">Complaint Not Found</h3>
          <p className="text-sm text-gray-500 mt-1">
            Unable to load complaint details
          </p>
        </div>
      </div>
    );
  }
}
