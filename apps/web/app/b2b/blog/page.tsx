"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Calendar, User } from "lucide-react";
import { orpc } from "@/utils/orpc";

export default function BlogListPage() {
  const { data: posts = [], isLoading } = useQuery({
    ...orpc.landing.getBlogPosts.queryOptions({
      input: { limit: 50 },
    }),
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Page Header */}
        <div className="mb-12">
          <Link
            href="/b2b"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#003178] hover:text-[#002060] mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          <h1
            className="text-4xl font-bold mb-3"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            Blog
          </h1>
          <p className="text-gray-600 text-lg">
            Business strategies, platform updates, and helpful guides.
          </p>
        </div>

        {/* Posts Grid */}
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl overflow-hidden animate-pulse"
              >
                <div className="h-48 bg-gray-200" />
                <div className="p-6 space-y-3">
                  <div className="h-3 bg-gray-200 rounded w-20" />
                  <div className="h-5 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">No blog posts yet.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/b2b/blog/${post.slug}`}
                className="bg-white rounded-xl overflow-hidden group block shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="h-48 overflow-hidden bg-gray-100">
                  {post.image && post.image.startsWith("http") ? (
                    <img
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      src={post.image}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-5xl">
                      📝
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <span className="text-xs font-bold text-[#003178] uppercase tracking-widest mb-2 block">
                    {post.category}
                  </span>
                  <h3
                    className="text-lg font-bold mb-2 line-clamp-2 group-hover:text-[#003178] transition-colors"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                  >
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {post.excerpt}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    {post.author?.name && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {post.author.name}
                      </span>
                    )}
                    {post.publishedAt && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(post.publishedAt).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
