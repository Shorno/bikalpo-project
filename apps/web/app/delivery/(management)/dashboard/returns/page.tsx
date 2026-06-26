import { RotateCcw } from "lucide-react";
import { type client, orpc, queryClient } from "@/utils/orpc";
import { ReturnsClient } from "./returns-client";

export const dynamic = "force-dynamic";

export default async function ReturnsPage() {
  type ReturnItem = Awaited<
    ReturnType<typeof client.returns.getAll>
  >["returns"][number];
  let returns: ReturnItem[] = [];

  try {
    const result = await queryClient.fetchQuery(
      orpc.returns.getAll.queryOptions(),
    );
    returns = result.returns || [];
  } catch (error) {
    console.error("Failed to load returns:", error);
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Header with Icon */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <RotateCcw className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Returns
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Manage product return requests
          </p>
        </div>
      </div>

      {/* Returns List */}
      <ReturnsClient returns={returns || []} />
    </div>
  );
}
