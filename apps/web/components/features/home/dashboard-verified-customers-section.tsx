"use client";

import { Building2 } from "lucide-react";
import Link from "next/link";
import type { VerifiedUser } from "@/actions/users/get-verified-users";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface DashboardVerifiedCustomersSectionProps {
  customers: VerifiedUser[];
}

export function DashboardVerifiedCustomersSection({
  customers,
}: DashboardVerifiedCustomersSectionProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
    });
  };

  return (
    <section className="py-12 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
            Other Verified B2B Customers
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-sm md:text-base">
            See other verified businesses on our platform
          </p>
        </div>

        {customers.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No verified customers yet</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-6 mb-8 max-w-4xl mx-auto">
              {customers.slice(0, 3).map((customer) => (
                <Card
                  key={customer.id}
                  className="hover:shadow-lg transition-shadow duration-300 border-2 border-gray-100 hover:border-emerald-200"
                >
                  <CardContent className="p-3 sm:p-6 text-center">
                    <Avatar className="w-12 h-12 sm:w-20 sm:h-20 mx-auto mb-2 sm:mb-4">
                      <AvatarImage
                        src={customer.image || undefined}
                        alt={customer.name}
                      />
                      <AvatarFallback className="text-xs sm:text-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
                        {getInitials(customer.name)}
                      </AvatarFallback>
                    </Avatar>

                    <h3 className="font-semibold text-gray-900 mb-1 sm:mb-2 line-clamp-1 text-xs sm:text-base">
                      {customer.shopName || customer.name}
                    </h3>

                    <div className="hidden sm:block">
                      {customer.ownerName && (
                        <p className="text-sm text-gray-600 mb-2 flex items-center justify-center gap-1">
                          <Building2 className="w-3 h-3" />
                          {customer.ownerName}
                        </p>
                      )}

                      <p className="text-xs text-gray-500 mb-3">
                        Customer since {formatDate(customer.createdAt)}
                      </p>
                    </div>

                    <div className="inline-flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] sm:text-xs font-medium">
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-emerald-500 rounded-full" />
                      Verified
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="text-center">
              <Button
                size="lg"
                asChild
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Link href="/verified-customers">
                  View All Verified B2B Customers
                </Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
