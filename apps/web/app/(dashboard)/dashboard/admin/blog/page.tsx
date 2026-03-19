"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Edit,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { client, orpc } from "@/utils/orpc";

type BlogFormData = {
  title: string;
  excerpt: string;
  content: string;
  image: string;
  category: string;
  isPublished: boolean;
};

const EMPTY_FORM: BlogFormData = {
  title: "",
  excerpt: "",
  content: "",
  image: "",
  category: "General",
  isPublished: false,
};

export default function AdminBlogPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<BlogFormData>(EMPTY_FORM);

  // ── Queries ──
  const { data, isLoading } = useQuery({
    ...orpc.adminBlog.list.queryOptions({
      input: {
        search: search || undefined,
        page: 1,
        limit: 50,
      },
    }),
  });

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (data: BlogFormData) => client.adminBlog.create(data),
    onSuccess: () => {
      toast.success("Blog post created!");
      queryClient.invalidateQueries({
        predicate: (query) =>
          (query.queryKey[0] as string)?.toString().includes("adminBlog"),
      });
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: (data: BlogFormData & { id: number }) =>
      client.adminBlog.update(data),
    onSuccess: () => {
      toast.success("Blog post updated!");
      queryClient.invalidateQueries({
        predicate: (query) =>
          (query.queryKey[0] as string)?.toString().includes("adminBlog"),
      });
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => client.adminBlog.delete({ id }),
    onSuccess: () => {
      toast.success("Blog post deleted!");
      queryClient.invalidateQueries({
        predicate: (query) =>
          (query.queryKey[0] as string)?.toString().includes("adminBlog"),
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePublishMutation = useMutation({
    mutationFn: (id: number) => client.adminBlog.togglePublish({ id }),
    onSuccess: (result) => {
      toast.success(result.message);
      queryClient.invalidateQueries({
        predicate: (query) =>
          (query.queryKey[0] as string)?.toString().includes("adminBlog"),
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (post: {
    id: number;
    title: string;
    excerpt: string | null;
    content: string | null;
    image: string | null;
    category: string;
    isPublished: boolean;
  }) => {
    setForm({
      title: post.title,
      excerpt: post.excerpt || "",
      content: post.content || "",
      image: post.image || "",
      category: post.category,
      isPublished: post.isPublished,
    });
    setEditingId(post.id);
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (editingId) {
      updateMutation.mutate({ ...form, id: editingId });
    } else {
      createMutation.mutate(form);
    }
  };

  const posts = data?.posts || [];
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Blog Posts
          </h1>
          <p className="text-muted-foreground text-sm">
            Manage blog posts displayed on the B2B landing page.
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Post
        </Button>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">
              {editingId ? "Edit Blog Post" : "Create Blog Post"}
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={resetForm}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title *</label>
                <Input
                  placeholder="Blog post title..."
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Input
                  placeholder="e.g. Strategy, Updates, Guides"
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Cover Image URL</label>
              <Input
                placeholder="https://example.com/image.jpg"
                value={form.image}
                onChange={(e) =>
                  setForm((f) => ({ ...f, image: e.target.value }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Must be an https:// URL (upload to Cloudinary or use a web image link)
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Excerpt (short summary for cards)
              </label>
              <Textarea
                placeholder="A brief summary of the blog post..."
                value={form.excerpt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, excerpt: e.target.value }))
                }
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Content</label>
              <Textarea
                placeholder="Full blog post content..."
                value={form.content}
                onChange={(e) =>
                  setForm((f) => ({ ...f, content: e.target.value }))
                }
                rows={8}
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, isPublished: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                Publish immediately
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={handleSubmit} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingId ? "Update Post" : "Create Post"}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search posts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Posts Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No blog posts yet.</p>
              <p className="text-sm text-muted-foreground">
                Click &quot;New Post&quot; to create your first blog post.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Title</th>
                    <th className="px-4 py-3 text-left font-medium">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => (
                    <tr
                      key={post.id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {post.image && (
                            <img
                              src={post.image}
                              alt=""
                              className="h-10 w-14 rounded object-cover"
                            />
                          )}
                          <div>
                            <p className="font-medium line-clamp-1">
                              {post.title}
                            </p>
                            {post.excerpt && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {post.excerpt}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-xs">
                          {post.category}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={
                            post.isPublished
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                              : "bg-gray-100 text-gray-600 border-gray-200"
                          }
                        >
                          {post.isPublished ? "Published" : "Draft"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(post.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title={
                              post.isPublished ? "Unpublish" : "Publish"
                            }
                            onClick={() => togglePublishMutation.mutate(post.id)}
                          >
                            {post.isPublished ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Edit"
                            onClick={() => handleEdit(post)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700"
                            title="Delete"
                            onClick={() => {
                              if (
                                confirm(
                                  "Are you sure you want to delete this post?"
                                )
                              ) {
                                deleteMutation.mutate(post.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
