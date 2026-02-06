"use client";

import {
  Calendar,
  ExternalLink,
  ImageIcon,
  MessageSquare,
  Package,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { ItemRequestWithRelations } from "@/db/schema/item-request";
import { cn } from "@/lib/utils";
import { RequestStatusBadge } from "./request-status-badge";

interface RequestItemCardProps {
  request: ItemRequestWithRelations;
}

// Get status-based styling for the card
function getStatusStyles(status: string) {
  switch (status) {
    case "approved":
      return {
        border: "border-green-200 dark:border-green-800",
        bg: "bg-green-50/50 dark:bg-green-950/20",
        accent: "bg-green-500",
      };
    case "rejected":
      return {
        border: "border-red-200 dark:border-red-800",
        bg: "bg-red-50/50 dark:bg-red-950/20",
        accent: "bg-red-500",
      };
    case "suggested":
      return {
        border: "border-blue-200 dark:border-blue-800",
        bg: "bg-blue-50/50 dark:bg-blue-950/20",
        accent: "bg-blue-500",
      };
    default:
      return {
        border: "border-gray-200 dark:border-gray-800",
        bg: "",
      };
  }
}

export function RequestItemCard({ request }: RequestItemCardProps) {
  const formattedDate = new Date(request.createdAt).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    },
  );

  const statusStyles = getStatusStyles(request.status);

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all duration-200 hover:shadow-md",
        statusStyles.border,
        statusStyles.bg,
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-4 items-start flex-1 min-w-0">
            {/* Image thumbnail or placeholder */}
            <div className="shrink-0 size-16 rounded-lg overflow-hidden bg-muted border flex items-center justify-center">
              {request.image ? (
                <Image
                  src={request.image}
                  alt={request.itemName}
                  width={64}
                  height={64}
                  className="size-full object-cover"
                />
              ) : (
                <ImageIcon className="size-6 text-muted-foreground" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {request.requestNumber}
                </span>
                <RequestStatusBadge status={request.status} />
              </div>
              <h3 className="font-semibold text-base truncate">
                {request.itemName}
              </h3>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                {request.brand && <span>{request.brand}</span>}
                {request.brand && request.category && <span>•</span>}
                {request.category && <span>{request.category}</span>}
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="size-3" />
              {formattedDate}
            </div>
            <div className="text-sm font-medium mt-1">
              Qty: {request.quantity}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Description */}
        {request.description && (
          <div className="text-sm bg-muted/50 rounded-lg p-3">
            <span className="text-muted-foreground font-medium">Notes: </span>
            <span>{request.description}</span>
          </div>
        )}

        {/* Admin Response */}
        {request.adminResponse && (
          <div
            className={cn(
              "rounded-lg p-3 space-y-1",
              request.status === "approved" &&
                "bg-green-100 dark:bg-green-900/30",
              request.status === "rejected" && "bg-red-100 dark:bg-red-900/30",
              request.status === "suggested" &&
                "bg-blue-100 dark:bg-blue-900/30",
              request.status === "pending" && "bg-muted/70",
            )}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <MessageSquare className="size-4" />
              Admin Response
            </div>
            <p className="text-sm">{request.adminResponse}</p>
          </div>
        )}

        {/* Suggested Product */}
        {request.status === "suggested" && request.suggestedProduct && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2">
              SUGGESTED ALTERNATIVE
            </p>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="size-14 bg-white dark:bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden shadow-sm">
                  {request.suggestedProduct.image ? (
                    <Image
                      src={request.suggestedProduct.image}
                      alt={request.suggestedProduct.name}
                      width={56}
                      height={56}
                      className="size-full object-cover"
                    />
                  ) : (
                    <Package className="size-6 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-sm">
                    {request.suggestedProduct.name}
                  </p>
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                    ৳{Number(request.suggestedProduct.price).toLocaleString()}
                  </p>
                </div>
              </div>
              <Button variant="default" size="sm" asChild className="shrink-0">
                <Link href={`/products/${request.suggestedProduct.id}`}>
                  View Product
                  <ExternalLink className="ml-1.5 size-3" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
