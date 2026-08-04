import Link from "next/link";
import type { ReactNode } from "react";
import {
  SetupEmptySection,
  SetupRelatedTable,
} from "@/components/features/product-setup";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type TypeSellerRankingRow = {
  userId: string;
  displayName: string;
  deliveredOrderCount: number;
  averageRating: number;
};

export function TypeSellerRankingTable({
  rows,
  roleLabel,
  rankOffset = 0,
  sellerHref,
  footer,
}: {
  rows: TypeSellerRankingRow[];
  roleLabel: string;
  rankOffset?: number;
  sellerHref?: (row: TypeSellerRankingRow) => string;
  footer?: ReactNode;
}) {
  if (rows.length === 0) {
    return (
      <>
        <SetupEmptySection
          description={`No ${roleLabel.toLowerCase()} sellers are linked to this Type.`}
          title={`No ${roleLabel} ranking`}
        />
        {footer}
      </>
    );
  }

  return (
    <>
      <SetupRelatedTable tableClassName="min-w-[680px]">
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead>Rank</TableHead>
            <TableHead>Seller Name</TableHead>
            <TableHead>Orders</TableHead>
            <TableHead>Rating</TableHead>
            <TableHead>User ID</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={row.userId}>
              <TableCell className="font-mono text-xs tabular-nums">
                {rankOffset + index + 1}
              </TableCell>
              <TableCell className="font-medium">
                {sellerHref ? (
                  <Link
                    className="hover:text-primary hover:underline"
                    href={sellerHref(row)}
                  >
                    {row.displayName}
                  </Link>
                ) : (
                  row.displayName
                )}
              </TableCell>
              <TableCell className="font-mono text-xs tabular-nums">
                {row.deliveredOrderCount.toLocaleString()}
              </TableCell>
              <TableCell className="font-mono text-xs tabular-nums">
                <span aria-hidden="true" className="text-amber-600">
                  ★
                </span>{" "}
                {row.averageRating.toFixed(1)}
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {sellerHref ? (
                  <Link
                    className="hover:text-primary hover:underline"
                    href={sellerHref(row)}
                  >
                    {row.userId}
                  </Link>
                ) : (
                  row.userId
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </SetupRelatedTable>
      {footer}
    </>
  );
}
