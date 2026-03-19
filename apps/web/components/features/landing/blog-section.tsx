"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { orpc } from "@/utils/orpc";

export function BlogSection() {
  const { data: posts = [] } = useQuery({
    ...orpc.landing.getBlogPosts.queryOptions({ input: { limit: 3 } }),
  });

  // Don't render section if no published posts
  if (posts.length === 0) return null;

  return (
    <section className="py-12 sm:py-24" style={{ backgroundColor: "#f3f4f5" }}>
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-end mb-16">
          <div>
            <h2
              className="text-3xl font-bold mb-4"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              Latest Insights
            </h2>
            <p className="text-gray-600">
              Business strategies and platform updates.
            </p>
          </div>
          <Link
            href="/b2b/blog"
            className="text-[#003178] font-bold flex items-center gap-2 group"
          >
            View All Posts{" "}
            <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
              arrow_forward
            </span>
          </Link>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/b2b/blog/${post.slug}`}
              className="bg-white rounded-xl overflow-hidden group block"
            >
              <div className="h-48 overflow-hidden bg-gray-100">
                {post.image && post.image.startsWith("http") ? (
                  <img
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    src={post.image}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl font-bold">
                    📝
                  </div>
                )}
              </div>
              <div className="p-6">
                <span className="text-xs font-bold text-[#003178] uppercase tracking-widest mb-3 block">
                  {post.category}
                </span>
                <h4
                  className="text-lg font-bold mb-4 line-clamp-2"
                  style={{ fontFamily: "'Manrope', sans-serif" }}
                >
                  {post.title}
                </h4>
                {post.excerpt && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {post.excerpt}
                  </p>
                )}
                <span className="text-sm font-bold flex items-center gap-2 hover:text-[#003178] transition-colors">
                  Read More{" "}
                  <span className="material-symbols-outlined text-sm">
                    chevron_right
                  </span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
