import { notFound } from "next/navigation";
import { getEstimateById } from "@/actions/estimate/get-estimates";
import { EditEstimateForm } from "@/components/features/estimates/edit-estimate-form";

export default async function AdminEditEstimatePage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = await params;
  const result = await getEstimateById(Number(id));

  if (!result.success || !result.estimate) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Edit Estimate {result.estimate.estimateNumber}
        </h1>
      </div>

      <EditEstimateForm estimate={result.estimate} />
    </div>
  );
}
