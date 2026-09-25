"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { ApplicationDetailData } from "@/components/features/admin/application-detail-sections";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AdminNotesContent,
  BusinessInformation,
  DocumentsContent,
  PlanContent,
  type UserDetailData,
} from "./user-detail-content";

/** Profile and approval views share the exact same information hierarchy. */
export function UserDetailsLayout({
  title = "User Details",
  backHref,
  backLabel,
  headingAside,
  hero,
  businessName,
  detail,
  data,
  performance,
  actions,
}: {
  title?: string;
  backHref: string;
  backLabel: string;
  headingAside?: ReactNode;
  hero: ReactNode;
  businessName: string;
  detail: ApplicationDetailData;
  data: UserDetailData;
  performance: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {headingAside}
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={backHref}>
            <ArrowLeft className="size-4" aria-hidden />
            {backLabel}
          </Link>
        </Button>
      </div>
      {hero}
      <Tabs defaultValue="basic" className="min-w-0 gap-6">
        <div className="min-w-0 overflow-x-auto pb-1">
          <TabsList
            variant="line"
            aria-label="User details sections"
            className="w-max min-w-full justify-start gap-1 border-b p-0 group-data-horizontal/tabs:h-12"
          >
            {[
              ["basic", "Basic Information"],
              ["documents", "Documents"],
              ["plan", "Plan"],
              ["performance", "Performance"],
              ["notes", "Admin Notes"],
            ].map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="h-12 flex-none px-4 after:bottom-0"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="basic">
          <BusinessInformation detail={detail} businessName={businessName} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsContent detail={detail} />
        </TabsContent>
        <TabsContent value="plan">
          <PlanContent data={data} />
        </TabsContent>
        <TabsContent value="performance">{performance}</TabsContent>
        <TabsContent value="notes">
          <AdminNotesContent data={data} />
        </TabsContent>
      </Tabs>
      <section
        aria-labelledby="user-actions-heading"
        className="space-y-3 border-t pt-5"
      >
        <h2 id="user-actions-heading" className="text-sm font-semibold">
          Actions
        </h2>
        <div className="flex flex-wrap items-center gap-3">{actions}</div>
      </section>
    </div>
  );
}
