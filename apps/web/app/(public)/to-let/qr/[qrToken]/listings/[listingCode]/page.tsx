import type { Metadata } from "next";
import PublicListingPage from "@/app/(public)/to-let/listings/[listingCode]/page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "To-Let listing",
  description: "View an available unit from a property's permanent QR page.",
  robots: {
    index: false,
    follow: false,
  },
};

interface QrListingPageProps {
  params: Promise<{ qrToken: string; listingCode: string }>;
}

export default async function QrListingPage({ params }: QrListingPageProps) {
  const { qrToken, listingCode } = await params;

  return (
    <PublicListingPage
      params={Promise.resolve({ listingCode })}
      searchParams={Promise.resolve({ qrToken })}
    />
  );
}
