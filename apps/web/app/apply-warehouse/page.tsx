"use client";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { WarehouseApplicationForm } from "@/components/features/auth/warehouse-application-form";
import { PublicHeader } from "@/components/layout/public-header";
import { orpc } from "@/utils/orpc";

function ApplyWarehouseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get("edit") === "true";

  const { data, isLoading } = useQuery({
    ...orpc.warehouseApplication.getMyApplication.queryOptions(),
  });

  useEffect(() => {
    // If user has an application and NOT in edit mode, redirect to status
    if (data?.status && !isEditMode) {
      router.replace("/warehouse-application-status");
    }
  }, [data, isEditMode, router]);

  if (isLoading) {
    return (
      <>
        <PublicHeader />
        <div className="flex min-h-[calc(100dvh-80px)] items-center justify-center bg-[#FAF6F6]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  // Redirect while not in edit mode
  if (data?.status && !isEditMode) {
    return (
      <>
        <PublicHeader />
        <div className="flex min-h-[calc(100dvh-80px)] items-center justify-center bg-[#FAF6F6]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  // Can't edit an approved application
  if (isEditMode && data?.status === "approved") {
    router.replace("/warehouse-application-status");
    return null;
  }

  // Prepare initial data for edit mode
  const initialData =
    isEditMode && data
      ? {
          warehouseName: data.warehouseName,
          ownerName: data.ownerName,
          phoneNumber: data.phoneNumber,
          warehouseAddress: data.warehouseAddress,
          tradeLicenseNumber: data.tradeLicenseNumber || "",
          documents: (data.documents as string[]) || [],
        }
      : undefined;

  return (
    <>
      <PublicHeader />
      <div className="flex min-h-[calc(100dvh-80px)] flex-col items-center bg-[#FAF6F6] px-4 py-8 pt-24 md:px-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {isEditMode
              ? "Edit Your Application"
              : "Become a Warehouse Supplier"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {isEditMode
              ? "Update your warehouse application details below"
              : "Complete the application below to start supplying products on our platform"}
          </p>
        </div>
        <WarehouseApplicationForm
          initialData={initialData}
          isEditMode={isEditMode && !!data}
        />
      </div>
    </>
  );
}

function LoadingFallback() {
  return (
    <>
      <PublicHeader />
      <div className="flex min-h-[calc(100dvh-80px)] items-center justify-center bg-[#FAF6F6]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </>
  );
}

export default function ApplyWarehousePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ApplyWarehouseContent />
    </Suspense>
  );
}
