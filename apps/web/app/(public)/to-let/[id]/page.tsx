import { ChevronRight, ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getToLetById } from "@/lib/public-data";
import { checkAuth } from "@/utils/auth";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

interface ToLetDetailsPageProps {
  params: Promise<{ id: string }>;
}

export default async function ToLetDetailsPage({
  params,
}: ToLetDetailsPageProps) {
  const { id } = await params;
  if (!(await checkAuth())?.user) {
    redirect(
      `/login?redirect=${encodeURIComponent(`/to-let/${encodeURIComponent(id)}`)}`,
    );
  }
  const toletId = Number(id);
  if (Number.isNaN(toletId)) {
    notFound();
  }

  const listing = await getToLetById(toletId, 300);
  if (!listing) {
    notFound();
  }

  const imageUrl =
    listing.imageUrl && listing.imageUrl.trim().length > 0
      ? listing.imageUrl
      : "/placeholder-image.svg";

  return (
    <div className="bg-gradient-to-b from-gray-50 to-white min-h-screen">
      <div className="site-container px-4 py-8 md:py-12">
        <div className="mb-4 text-sm text-muted-foreground">
          <nav className="flex items-center gap-2">
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            <ChevronRight className="h-4 w-4" />
            <Link href="/to-let" className="hover:text-foreground">
              To-Let
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-muted-foreground truncate max-w-xs">
              {listing.title}
            </span>
          </nav>
        </div>

        <div className="mb-6">
          <Link
            href="/to-let"
            className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Back to listings
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="relative h-72 sm:h-96">
              <Image
                src={imageUrl}
                alt={listing.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 66vw"
                unoptimized={imageUrl.startsWith("http")}
              />
            </div>
            <div className="p-6">
              <h1 className="text-2xl font-bold text-foreground">
                {listing.title}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">{listing.location}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Contact: {listing.contactInfo}
              </p>

              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                {listing.area && (
                  <span className="px-3 py-1 bg-primary/5 text-primary rounded-full">
                    Area: {listing.area}
                  </span>
                )}
                {listing.bedrooms != null && (
                  <span className="px-3 py-1 bg-primary/5 text-primary rounded-full">
                    Bedrooms: {listing.bedrooms}
                  </span>
                )}
                {listing.bathrooms != null && (
                  <span className="px-3 py-1 bg-primary/5 text-primary rounded-full">
                    Bathrooms: {listing.bathrooms}
                  </span>
                )}
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full">
                  {listing.active ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="mt-6 flex items-center gap-4">
                <span className="text-3xl font-bold text-emerald-600">
                  ৳ {Number(listing.rent).toLocaleString()}
                </span>
                <span className="text-sm text-muted-foreground">/ month</span>
              </div>

              <div className="mt-6 prose prose-sm prose-slate text-foreground max-w-none">
                <h2 className="text-lg font-semibold">Description</h2>
                <p>{listing.description || "No description provided."}</p>
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="bg-card rounded-xl border border-border shadow-sm p-4">
              <h3 className="text-sm font-semibold text-foreground">
                Quick Info
              </h3>
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                <li>
                  <span className="font-medium">Rent:</span> ৳{" "}
                  {Number(listing.rent).toLocaleString()}/month
                </li>
                <li>
                  <span className="font-medium">Location:</span>{" "}
                  {listing.location}
                </li>
                <li>
                  <span className="font-medium">Contact:</span>{" "}
                  {listing.contactInfo}
                </li>
                <li>
                  <span className="font-medium">Status:</span>{" "}
                  {listing.active ? "Available" : "Not Available"}
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
