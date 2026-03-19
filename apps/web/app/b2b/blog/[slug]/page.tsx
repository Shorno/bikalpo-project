"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Calendar, Loader2, User } from "lucide-react";
import { orpc } from "@/utils/orpc";

export default function BlogPostPage() {
  const params = useParams();
  const slug = params.slug as string;

  const { data: post, isLoading } = useQuery({
    ...orpc.landing.getBlogPost.queryOptions({
      input: { slug },
    }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Post Not Found</h2>
          <p className="text-gray-500 mb-4">
            This blog post doesn&apos;t exist or has been unpublished.
          </p>
          <Link
            href="/b2b/blog"
            className="text-[#003178] font-medium flex items-center gap-1 justify-center"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Blog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <article className="max-w-4xl mx-auto px-6 py-12">
      {/* Back link */}
      <Link
        href="/b2b/blog"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Blog
      </Link>

      {/* Category */}
      <span className="text-xs font-bold text-[#003178] uppercase tracking-widest mb-4 block">
        {post.category}
      </span>

      {/* Title */}
      <h1
        className="text-3xl md:text-4xl font-bold mb-4 leading-tight"
        style={{ fontFamily: "'Manrope', sans-serif" }}
      >
        {post.title}
      </h1>

      {/* Meta */}
      <div className="flex items-center gap-4 text-sm text-gray-500 mb-8">
        {post.author?.name && (
          <span className="flex items-center gap-1">
            <User className="h-4 w-4" />
            {post.author.name}
          </span>
        )}
        {post.publishedAt && (
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {new Date(post.publishedAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        )}
      </div>

      {/* Cover Image */}
      {post.image && post.image.startsWith("http") && (
        <div className="rounded-xl overflow-hidden mb-8">
          <img
            src={post.image}
            alt={post.title}
            className="w-full h-auto max-h-[400px] object-cover"
          />
        </div>
      )}

      {/* Excerpt */}
      {post.excerpt && (
        <p className="text-lg text-gray-600 mb-6 leading-relaxed font-medium">
          {post.excerpt}
        </p>
      )}

      {/* Content */}
      {post.content && (
        <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
          {post.content}
        </div>
      )}
    </article>
  );
}
