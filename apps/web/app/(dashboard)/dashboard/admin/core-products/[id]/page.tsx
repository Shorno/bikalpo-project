"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ADMIN_BASE } from "@/lib/routes";
import { orpc } from "@/utils/orpc";

export default function CoreProductDetailPage() {
  const params = useParams();
  const id = Number(params.id);

  const { data, isLoading } = useQuery(
    orpc.adminCoreProduct.getById.queryOptions({
      input: { id },
    }),
  );

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-40 bg-muted rounded-lg" />
          <div className="h-40 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  const cp = data?.coreProduct;
  if (!cp) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center py-20">
          <h2 className="text-xl font-semibold mb-2">
            Core Product Not Found
          </h2>
          <Button asChild variant="outline">
            <Link href={`${ADMIN_BASE}/core-products`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to list
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href={`${ADMIN_BASE}/core-products`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{cp.name}</h1>
          <p className="text-muted-foreground text-sm">
            SKU: <span className="font-mono">{cp.sku}</span> · Slug:{" "}
            <span className="font-mono">{cp.slug}</span>
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Product Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image + Basic Info */}
          <div className="border rounded-lg p-6 space-y-4">
            <div className="flex items-start gap-6">
              <div className="w-32 h-32 relative rounded-lg overflow-hidden border shadow-sm shrink-0">
                <Image
                  src={cp.image}
                  alt={cp.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex-1 space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Category</span>
                    <p className="font-medium">{cp.category.name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Sub Category</span>
                    <p className="font-medium">
                      {cp.subCategory?.name ?? "—"}
                    </p>
                  </div>
                </div>
                {cp.description && (
                  <p className="text-sm text-muted-foreground">
                    {cp.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
