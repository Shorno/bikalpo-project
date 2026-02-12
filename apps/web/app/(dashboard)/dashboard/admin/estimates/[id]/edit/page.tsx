import { notFound } from "next/navigation";
import { EditEstimateForm } from "@/components/features/estimates/edit-estimate-form";
import { client } from "@/utils/orpc";

export default async function AdminEditEstimatePage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = await params;
  let estimateData;
  try {
    const result = await client.adminEstimate.getById({ id: Number(id) });
    estimateData = result.estimate;
  } catch {
    notFound();
  }

  if (!estimateData) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Edit Estimate {estimateData.estimateNumber}
        </h1>
      </div>

      <EditEstimateForm estimate={estimateData} />
    </div>
  );
}
