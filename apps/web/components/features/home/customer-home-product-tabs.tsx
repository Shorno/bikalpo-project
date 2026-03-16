"use client";

import { Package } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCustomerHomeProductTabs } from "@/hooks/use-customer-api";

type CustomerTabProduct = {
  id: number;
  name: string;
  description: string | null;
  image: string;
  price: number;
  isActive: boolean;
};

type CustomerTab = {
  id: number;
  name: string;
  description: string | null;
  products: CustomerTabProduct[];
};

export function CustomerHomeProductTabs() {
  const { data, isLoading } = useCustomerHomeProductTabs();
  const tabs = (data?.tabs ?? []) as CustomerTab[];
  const [activeTabId, setActiveTabId] = useState<number | null>(null);

  useEffect(() => {
    if (!tabs.length) {
      setActiveTabId(null);
      return;
    }

    if (!activeTabId || !tabs.some((tab) => tab.id === activeTabId)) {
      setActiveTabId(tabs[0]!.id);
    }
  }, [tabs, activeTabId]);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-11 w-28 rounded-full" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-72 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!activeTab) {
    return (
      <div className="rounded-3xl border border-dashed bg-white/80 p-10 text-center text-sm text-muted-foreground">
        No curated products are active for customers right now.
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab.id;
            return (
              <Button
                key={tab.id}
                type="button"
                variant={isActive ? "default" : "outline"}
                className={[
                  "rounded-full px-5",
                  isActive
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-white hover:bg-emerald-50 hover:text-emerald-700",
                ].join(" ")}
                onClick={() => setActiveTabId(tab.id)}
              >
                {tab.name}
              </Button>
            );
          })}
        </div>
        <div className="rounded-3xl bg-linear-to-r from-emerald-50 via-white to-amber-50 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <Badge className="mb-3 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                Customer selection
              </Badge>
              <h2 className="text-2xl font-semibold text-gray-900">
                {activeTab.name}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-gray-600">
                {activeTab.description ||
                  "Hand-picked products managed by the admin team for this section."}
              </p>
            </div>
            <p className="text-sm font-medium text-emerald-700">
              {activeTab.products.length} item
              {activeTab.products.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {activeTab.products.map((product) => (
          <article
            key={product.id}
            className="overflow-hidden rounded-2xl border bg-white shadow-sm transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
              {product.image ? (
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-cover"
                  unoptimized={product.image.startsWith("http")}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Package className="h-10 w-10 text-gray-300" />
                </div>
              )}
            </div>
            <div className="space-y-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  {product.name}
                </h3>
                <p className="shrink-0 text-lg font-bold text-emerald-700">
                  ৳{product.price.toLocaleString("en-BD")}
                </p>
              </div>
              <p className="line-clamp-3 text-sm leading-6 text-gray-600">
                {product.description || "No description available."}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
