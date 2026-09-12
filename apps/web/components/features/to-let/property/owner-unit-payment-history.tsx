"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

function monthLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  }).format(new Date(`${value}T00:00:00+06:00`));
}

export function OwnerUnitPaymentHistory({
  propertyCode,
  unitCode,
}: {
  propertyCode: string;
  unitCode: string;
}) {
  const [page, setPage] = useState(1);
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const options = orpc.toLetRental.getOwnerUnitHistory.queryOptions({
    input: { propertyCode, unitCode, page },
  });
  const query = useQuery({
    ...options,
    queryKey: [
      ...options.queryKey,
      { ownerAccountId: session?.user.id ?? null },
    ],
    enabled: Boolean(session?.user.id) && !sessionPending,
    placeholderData: undefined,
    staleTime: 15_000,
    refetchInterval: 60_000,
    retry: false,
  });
  const data = query.data;

  return (
    <section
      aria-labelledby="owner-payment-history-title"
      className="mt-6 min-w-0 border-t border-gray-200 pt-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3
          id="owner-payment-history-title"
          className="font-semibold text-gray-900"
        >
          Payment History
        </h3>
        <span className="text-sm text-gray-500">
          Owner view · All rental contracts
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-gray-600">
        Current and previous tenants for this unit. Vacant rows mean no rental
        contract was recorded under your account for that month. Months without
        a started contract have no charge.
      </p>
      {sessionPending || query.isLoading ? (
        <p
          role="status"
          className="flex items-center gap-2 py-8 text-sm text-gray-600"
        >
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          Loading payment history
        </p>
      ) : !session?.user ? (
        <p className="py-6 text-sm text-gray-600">
          Sign in to the property owner account to view payment history.
        </p>
      ) : query.isError ? (
        <div role="alert" className="mt-4 text-sm text-red-700">
          <p>
            Payment history could not be loaded. Only the property owner can
            view these records.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void query.refetch()}
            className="mt-3"
          >
            Try again
          </Button>
        </div>
      ) : !data?.rows.length ? (
        <p className="py-8 text-sm text-gray-600">
          No rental payment history yet. Records appear after the first signed
          contract starts.
        </p>
      ) : (
        <>
          <div
            className="mt-4 overflow-x-auto rounded-lg border border-gray-200"
            role="region"
            aria-label="Unit payment history table"
            tabIndex={0}
          >
            <table className="w-full min-w-[760px] text-left text-sm">
              <caption className="sr-only">
                Owner-only payment history,{" "}
                {data.periodFrom && monthLabel(data.periodFrom)} to{" "}
                {data.periodTo && monthLabel(data.periodTo)}
              </caption>
              <thead className="bg-gray-50 text-xs text-gray-600">
                <tr>
                  {[
                    "Month",
                    "Tenant ID",
                    "Tenant Name",
                    "Rent",
                    "OTP",
                    "Payment",
                  ].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="px-4 py-3 font-medium"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {data.rows.map((row) => (
                  <tr key={row.key}>
                    <th
                      scope="row"
                      className="whitespace-nowrap px-4 py-3 font-medium text-gray-700"
                    >
                      {monthLabel(row.cycleMonth)}
                    </th>
                    <td className="max-w-44 break-all px-4 py-3 font-mono text-xs text-gray-600">
                      {row.tenantId ?? "—"}
                    </td>
                    <td className="min-w-36 max-w-56 break-words px-4 py-3">
                      <span className="font-medium text-gray-900">
                        {row.tenantName}
                      </span>
                      {row.bookingCode ? (
                        <span className="mt-1 block font-mono text-xs text-gray-500">
                          {row.bookingCode}
                        </span>
                      ) : null}
                      {row.referenceName ? (
                        <span className="mt-1 block text-xs text-gray-600">
                          Received by: {row.referenceName}
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono font-medium tabular-nums text-gray-900">
                      {row.amount === null
                        ? "—"
                        : `৳${new Intl.NumberFormat("en-BD").format(row.amount)}`}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-gray-700">
                      {row.otp ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {row.status === "vacant" ? (
                        <span className="text-gray-500">No charge</span>
                      ) : (
                        <>
                          <Badge
                            variant="outline"
                            className={
                              row.status === "paid"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                            }
                          >
                            {row.status === "paid" ? "Paid" : "Pending"}
                          </Badge>
                          {!row.recorded ? (
                            <span className="mt-1 block text-xs text-gray-500">
                              Awaiting cycle record
                            </span>
                          ) : null}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.totalPages > 1 ? (
            <nav
              aria-label="Payment history months"
              className="mt-4 flex flex-wrap items-center justify-between gap-3"
            >
              <p className="text-sm text-gray-600">
                {data.periodFrom && monthLabel(data.periodFrom)} –{" "}
                {data.periodTo && monthLabel(data.periodTo)}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || query.isFetching}
                  onClick={() => setPage((value) => value - 1)}
                >
                  <ChevronLeft aria-hidden="true" className="size-4" />
                  Newer months
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= data.totalPages || query.isFetching}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Older months
                  <ChevronRight aria-hidden="true" className="size-4" />
                </Button>
              </div>
            </nav>
          ) : null}
        </>
      )}
    </section>
  );
}
