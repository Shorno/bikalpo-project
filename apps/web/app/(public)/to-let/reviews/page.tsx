import Link from "next/link";
import { ToLetCommunityReviews } from "@/components/features/to-let/to-let-community-reviews";

export const metadata = { title: "To-Let tenant reviews | Bikalpo" };

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const params = await searchParams;
  const value = Number(params.page);
  const page = Number.isSafeInteger(value) && value > 0 ? Math.min(value, 10000) : 1;
  return <main><div className="site-container px-4 py-5"><Link href="/to-let" className="inline-flex min-h-11 items-center text-primary">← Back to To-Let</Link></div><ToLetCommunityReviews all page={page} /></main>;
}
