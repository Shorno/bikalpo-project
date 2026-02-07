import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { unauthorized } from "next/navigation";
import { getSalesmanById } from "@/actions/admin/salesman-actions";
import { checkIsAdmin } from "@/utils/auth";
import { Button } from "@/components/ui/button";
import { ADMIN_BASE } from "@/lib/routes";
import { SalesmanDetailClient } from "./salesman-detail-client";

interface SalesmanDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function SalesmanDetailPage({
  params,
}: SalesmanDetailPageProps) {
  const session = await checkIsAdmin();
  if (!session) {
    unauthorized();
  }

  const { id } = await params;
  const result = await getSalesmanById(id);

  if (!result.success || !result.salesman) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="flex items-center gap-4 mb-4">
          <Link href={`${ADMIN_BASE}/salesmen`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Salesman Not Found</h1>
        </div>
        <div className="flex items-center justify-center h-40 border rounded-lg bg-muted/30">
          <p className="text-muted-foreground">
            {result.error || "Salesman not found"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
      <SalesmanDetailClient salesmanId={id} initialData={result.salesman} />
    </div>
  );
}
