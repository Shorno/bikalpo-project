"use client";

import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Quote,
  ShoppingBag,
} from "lucide-react";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import type { VerifiedUser } from "@/actions/users/get-verified-users";
import { CustomerProductsModal } from "@/components/features/users/customer-products-modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface DashboardCustomersGridProps {
  customers: VerifiedUser[];
  totalPages: number;
  currentPage: number;
}

export function DashboardCustomersGrid({
  customers,
  totalPages,
  currentPage,
}: DashboardCustomersGridProps) {
  const [, setPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({ shallow: false }),
  );
  const [search] = useQueryState("search", parseAsString.withDefault(""));
  const [selectedCustomer, setSelectedCustomer] = useState<VerifiedUser | null>(
    null,
  );
  const [modalOpen, setModalOpen] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleViewBoughtProducts = (customer: VerifiedUser) => {
    setSelectedCustomer(customer);
    setModalOpen(true);
  };

  if (customers.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
          <ShoppingBag className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          No customers found
        </h3>
        <p className="text-gray-500">
          {search
            ? "Try adjusting your search terms"
            : "There are no verified customers yet"}
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Section Title */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 text-center">
          All Verified Customers
        </h2>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {customers.map((customer) => (
          <Card
            key={customer.id}
            className="border-2 border-gray-100 hover:border-emerald-200 hover:shadow-lg transition-all duration-300"
          >
            <CardContent className="p-5">
              {/* Header: Avatar + Info */}
              <div className="flex items-start gap-4 mb-4">
                {/* Avatar */}
                <Avatar className="w-14 h-14 shrink-0">
                  <AvatarImage
                    src={customer.image || undefined}
                    alt={customer.name}
                  />
                  <AvatarFallback className="text-lg bg-gray-200 text-gray-600">
                    {getInitials(customer.shopName || customer.name)}
                  </AvatarFallback>
                </Avatar>

                {/* Shop Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 text-base truncate">
                    {customer.shopName || customer.name}
                  </h3>
                  {customer.area && (
                    <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="truncate">{customer.area}, Dhaka</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Total Orders: {customer.totalOrders}</span>
                  </div>
                </div>
              </div>

              {/* Reviews Section */}
              {customer.reviews.length > 0 && (
                <div className="bg-emerald-50 rounded-lg p-3 mb-4">
                  <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">
                    Reviews They Gave:
                  </p>
                  <ul className="space-y-1.5">
                    {customer.reviews.map((review) => (
                      <li
                        key={review.id}
                        className="flex items-start gap-2 text-sm text-gray-700"
                      >
                        <Quote className="w-3 h-3 text-emerald-400 mt-1 shrink-0 rotate-180" />
                        <span className="italic line-clamp-1">
                          "{review.comment}"
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* No Reviews Placeholder */}
              {customer.reviews.length === 0 && (
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Reviews They Gave:
                  </p>
                  <p className="text-sm text-gray-400 italic">No reviews yet</p>
                </div>
              )}

              {/* Action Button */}
              <Button
                variant="outline"
                className="w-full border-gray-300 hover:border-emerald-500 hover:text-emerald-600"
                onClick={() => handleViewBoughtProducts(customer)}
              >
                View Bought Products
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-10">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              return (
                <Button
                  key={pageNum}
                  variant={currentPage === pageNum ? "default" : "outline"}
                  size="sm"
                  className="w-9"
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
            {totalPages > 5 && currentPage < totalPages - 2 && (
              <>
                <span className="px-1 text-gray-400">...</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-9"
                  onClick={() => setPage(totalPages)}
                >
                  {totalPages}
                </Button>
              </>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => setPage(currentPage + 1)}
            className="flex items-center gap-1"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Products Modal */}
      <CustomerProductsModal
        customer={selectedCustomer}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  );
}
