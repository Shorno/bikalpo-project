"use client";

import { useSearchParams } from "next/navigation";
import { parseAsInteger, useQueryState } from "nuqs";
import type { PaginationData } from "@/actions/products/get-product-with-query";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface ProductPaginationProps {
  pagination: PaginationData;
}

export function ProductPagination({ pagination }: ProductPaginationProps) {
  const { page, totalPages, totalCount } = pagination;
  const searchParams = useSearchParams();
  const [, setPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({ shallow: false }),
  );

  if (totalPages <= 1) return null;

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    const showPages = 5; // Max number of page buttons to show

    if (totalPages <= showPages) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (page > 3) {
        pages.push("ellipsis");
      }

      // Show pages around current
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (page < totalPages - 2) {
        pages.push("ellipsis");
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    // Scroll to top on page change
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const createPageUrl = (pageNum: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(pageNum));
    return `?${params.toString()}`;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t">
      <p className="text-sm text-muted-foreground">
        Showing {(page - 1) * pagination.limit + 1} -{" "}
        {Math.min(page * pagination.limit, totalCount)} of {totalCount} products
      </p>

      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href={createPageUrl(Math.max(1, page - 1))}
              onClick={(e) => {
                e.preventDefault();
                if (page > 1) handlePageChange(page - 1);
              }}
              aria-disabled={page <= 1}
              className={
                page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"
              }
            />
          </PaginationItem>

          {getPageNumbers().map((pageNum, idx) => (
            <PaginationItem
              key={pageNum === "ellipsis" ? `ellipsis-${idx}` : pageNum}
            >
              {pageNum === "ellipsis" ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink
                  href={createPageUrl(pageNum)}
                  onClick={(e) => {
                    e.preventDefault();
                    handlePageChange(pageNum);
                  }}
                  isActive={pageNum === page}
                >
                  {pageNum}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}

          <PaginationItem>
            <PaginationNext
              href={createPageUrl(Math.min(totalPages, page + 1))}
              onClick={(e) => {
                e.preventDefault();
                if (page < totalPages) handlePageChange(page + 1);
              }}
              aria-disabled={page >= totalPages}
              className={
                page >= totalPages
                  ? "pointer-events-none opacity-50"
                  : "cursor-pointer"
              }
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
