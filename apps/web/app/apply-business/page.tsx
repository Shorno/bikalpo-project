"use client";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { BusinessApplicationForm } from "@/components/features/auth/business-application-form";
import { Navbar } from "@/components/layout/navbar";
import { orpc } from "@/utils/orpc";

export default function ApplyBusinessPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isEditMode = searchParams.get("edit") === "true";

    const { data, isLoading } = useQuery({
        ...orpc.sellerApplication.getMyApplication.queryOptions(),
    });

    useEffect(() => {
        // If user has an application and NOT in edit mode, redirect to status
        if (data && data.status && !isEditMode) {
            router.replace("/application-status");
        }
    }, [data, isEditMode, router]);

    if (isLoading) {
        return (
            <>
                <Navbar />
                <div className="flex min-h-[calc(100dvh-80px)] items-center justify-center bg-[#FAF6F6]">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </>
        );
    }

    // Redirect while not in edit mode
    if (data && data.status && !isEditMode) {
        return (
            <>
                <Navbar />
                <div className="flex min-h-[calc(100dvh-80px)] items-center justify-center bg-[#FAF6F6]">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </>
        );
    }

    // Can't edit an approved application
    if (isEditMode && data?.status === "approved") {
        router.replace("/application-status");
        return null;
    }

    // Prepare initial data for edit mode
    const initialData = isEditMode && data ? {
        shopName: data.shopName,
        ownerName: data.ownerName,
        phoneNumber: data.phoneNumber,
        businessType: data.businessType as "retail" | "restaurant",
        shopAddress: data.shopAddress,
        tradeLicenseNumber: data.tradeLicenseNumber || "",
    } : undefined;

    return (
        <>
            <Navbar />
            <div className="flex min-h-[calc(100dvh-80px)] flex-col items-center bg-[#FAF6F6] px-4 py-8 pt-24 md:px-8">
                <div className="mb-6 text-center">
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                        {isEditMode ? "Edit Your Application" : "Become a Business Seller"}
                    </h1>
                    <p className="mt-2 text-muted-foreground">
                        {isEditMode
                            ? "Update your application details below"
                            : "Complete the application below to start selling on our platform"}
                    </p>
                </div>
                <BusinessApplicationForm
                    initialData={initialData}
                    isEditMode={isEditMode && !!data}
                />
            </div>
        </>
    );
}
