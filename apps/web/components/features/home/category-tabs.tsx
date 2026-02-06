import { ChevronRight, Grid } from "lucide-react";
import Link from "next/link";
import getCategories from "@/actions/category/get-categories";

export async function CategoryTabs() {
  const categories = await getCategories();

  return (
    <div className="relative mb-8">
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
        {/* All Categories Pill */}
        <Link
          href="/products"
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-full shadow-sm hover:border-emerald-200 hover:bg-emerald-50 transition-all whitespace-nowrap group"
        >
          <div className="p-1 rounded-full bg-emerald-100/50 group-hover:bg-emerald-100 transition-colors">
            <Grid size={14} className="text-emerald-700" />
          </div>
          <span className="text-xs font-bold text-gray-700">All Products</span>
        </Link>

        {/* Dynamic Category Pills */}
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/products?category=${cat.slug}`}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-full shadow-sm hover:border-emerald-200 hover:bg-emerald-50 transition-all whitespace-nowrap group"
          >
            {/* Logic for category icons could go here if available in DB */}
            <span className="text-xs font-bold text-gray-700">{cat.name}</span>
          </Link>
        ))}

        {/* More button */}
        <Link
          href="/products"
          className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-transparent rounded-full hover:bg-gray-100 transition-all whitespace-nowrap"
        >
          <span className="text-xs font-bold text-gray-500">More...</span>
          <ChevronRight size={14} className="text-gray-400" />
        </Link>
      </div>

      {/* Visual fading indicator for horizontal scroll */}
      <div className="absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-[#f8f9fa] to-transparent pointer-events-none" />
    </div>
  );
}
