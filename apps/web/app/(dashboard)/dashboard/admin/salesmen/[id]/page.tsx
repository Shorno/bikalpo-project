"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ADMIN_BASE } from "@/lib/routes";
import { orpc } from "@/utils/orpc";
import { SalesmanDetailClient } from "./salesman-detail-client";

export default function SalesmanDetailPage() {
  const params = useParams<{ id: string }>();
  const salesmanId = params.id;

  const { data, isLoading, error } = useQuery({
    ...orpc.salesman.getById.queryOptions({ input: { id: salesmanId } }),
    enabled: !!salesmanId,
  });

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="flex-1">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32 mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data?.salesman) {
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
            {error?.message || "Salesman not found"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
      <SalesmanDetailClient
        salesmanId={salesmanId}
        initialData={data.salesman}
      />
    </div>
  );
}
