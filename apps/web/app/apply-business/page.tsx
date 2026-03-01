import type { Metadata } from "next";
import { BusinessApplicationForm } from "@/components/features/auth/business-application-form";
import { Navbar } from "@/components/layout/navbar";

export const metadata: Metadata = {
    title: "Become a Business Seller",
    description: "Apply to become a business seller on our platform. Fill out the application form to get started.",
};

export default function ApplyBusinessPage() {
    return (
        <>
            <Navbar />
            <div className="flex min-h-[calc(100dvh-80px)] flex-col items-center bg-[#FAF6F6] px-4 py-8 pt-24 md:px-8">
                <div className="mb-6 text-center">
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                        Become a Business Seller
                    </h1>
                    <p className="mt-2 text-muted-foreground">
                        Complete the application below to start selling on our platform
                    </p>
                </div>
                <BusinessApplicationForm />
            </div>
        </>
    );
}
