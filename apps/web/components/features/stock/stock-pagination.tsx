import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ADMIN_BASE } from "@/lib/routes";

function buildHref(queryWithoutPage: string, page: number): string {
  const q =
    page > 1
      ? queryWithoutPage
        ? `${queryWithoutPage}&page=${page}`
        : `page=${page}`
      : queryWithoutPage;
  return `${ADMIN_BASE}/stock${q ? `?${q}` : ""}`;
}

interface StockPaginationProps {
  queryWithoutPage: string;
  currentPage: number;
  totalPages: number;
}

export function StockPagination({
  queryWithoutPage,
  currentPage,
  totalPages,
}: StockPaginationProps) {
  if (totalPages <= 1) return null;

  const prevHref = buildHref(queryWithoutPage, currentPage - 1);
  const nextHref = buildHref(queryWithoutPage, currentPage + 1);

  const from = Math.max(1, currentPage - 1);
  const to = Math.min(totalPages, currentPage + 1);
  const pages: number[] = [];
  for (let i = from; i <= to; i++) pages.push(i);

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href={currentPage <= 1 ? "#" : prevHref}
            aria-disabled={currentPage <= 1}
            className={
              currentPage <= 1 ? "pointer-events-none opacity-50" : undefined
            }
          />
        </PaginationItem>
        {pages.map((p) => (
          <PaginationItem key={p}>
            <PaginationLink
              href={buildHref(queryWithoutPage, p)}
              isActive={p === currentPage}
            >
              {p}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext
            href={currentPage >= totalPages ? "#" : nextHref}
            aria-disabled={currentPage >= totalPages}
            className={
              currentPage >= totalPages
                ? "pointer-events-none opacity-50"
                : undefined
            }
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
