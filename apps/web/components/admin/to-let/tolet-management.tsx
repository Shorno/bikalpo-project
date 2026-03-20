"use client";

import type { ToletListing } from "@bikalpo-project/db/schema";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Plus, Pencil, CheckCircle, Circle } from "lucide-react";
import { client } from "@/utils/orpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import ImageUploader from "@/components/ImageUploader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";

const initialForm = {
  title: "",
  description: "",
  location: "",
  rent: 0,
  area: "",
  bedrooms: 0,
  bathrooms: 0,
  contactInfo: "",
  imageUrl: "",
  active: true,
};

export function ToLetManagement() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ToletListing | null>(null);
  const [form, setForm] = useState<typeof initialForm>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const getFormErrors = (currentForm: typeof initialForm) => {
    const errs: Record<string, string> = {};

    if (!currentForm.title.trim()) {
      errs.title = "Title is required";
    } else if (currentForm.title.trim().length < 3) {
      errs.title = "Title must be at least 3 characters";
    }

    if (!currentForm.location.trim()) {
      errs.location = "Location is required";
    } else if (currentForm.location.trim().length < 3) {
      errs.location = "Location must be at least 3 characters";
    }

    if (currentForm.rent < 0 || Number.isNaN(currentForm.rent)) {
      errs.rent = "Rent must be a valid non-negative number";
    }

    if (!currentForm.contactInfo.trim()) {
      errs.contactInfo = "Contact information is required";
    } else if (currentForm.contactInfo.trim().length < 5) {
      errs.contactInfo = "Contact information must be at least 5 characters";
    }

    if (currentForm.imageUrl?.trim()) {
      try {
        new URL(currentForm.imageUrl);
      } catch {
        errs.imageUrl =
          "Image URL must be valid (or leave empty when uploading)";
      }
    }

    return errs;
  };

  const validateForm = () => {
    const errs = getFormErrors(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      console.warn("To-Let validation errors", errs);
    }
    return Object.keys(errs).length === 0;
  };

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["admin-tolet"],
    queryFn: () => client.adminToLet.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => client.adminToLet.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tolet"] });
      setForm(initialForm);
      setShowForm(false);
      toast.success("To-Let listing created");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: any) => client.adminToLet.update(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tolet"] });
      setForm(initialForm);
      setEditing(null);
      setShowForm(false);
      toast.success("To-Let listing updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => client.adminToLet.delete({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tolet"] });
      toast.success("To-Let listing deleted");
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      client.adminToLet.update({ id, data: { active } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tolet"] });
    },
  });

  const openCreateForm = () => {
    setEditing(null);
    setForm(initialForm);
    setShowForm(true);
  };

  const openEditForm = (listing: ToletListing) => {
    setEditing(listing);
    setForm({
      title: listing.title,
      description: listing.description || "",
      location: listing.location,
      rent: Number(listing.rent ?? 0),
      area: listing.area || "",
      bedrooms: listing.bedrooms ?? 0,
      bathrooms: listing.bathrooms ?? 0,
      contactInfo: listing.contactInfo,
      imageUrl: listing.imageUrl || "",
      active: listing.active,
    });
    setShowForm(true);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the validation errors before submitting.");
      return;
    }

    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, data: form });
      } else {
        await createMutation.mutateAsync(form);
      }
    } catch (error: unknown) {
      const details = (error as any)?.data?.issues;
      if (details) {
        console.error("ORPC validation issues", details);
      }

      const message =
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : (error as any)?.data?.message ||
              (error as any)?.message ||
              "Validation failed; check required fields";

      toast.error(message);
      console.error("Submit failed", error);
    }
  };

  const rows = useMemo(() => listings || [], [listings]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">To-Let Listings</h1>
          <p className="text-sm text-gray-500">
            Add, edit or remove To-Let listings for public view.
          </p>
        </div>
        <Button onClick={openCreateForm} className="gap-2">
          <Plus className="w-4 h-4" /> New Listing
        </Button>
      </div>

      {showForm && (
        <form
          className="rounded-xl border bg-white p-5 shadow-sm"
          onSubmit={handleSubmit}
        >
          {Object.keys(errors).length > 0 && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <p className="font-medium">Please fix these errors:</p>
              <ul className="list-disc pl-5">
                {Object.entries(errors).map(([key, message]) => (
                  <li key={key}>{message}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Input
              required
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <Input
              required
              placeholder="Location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
            <Input
              required
              type="number"
              placeholder="Rent"
              value={form.rent}
              onChange={(e) =>
                setForm({ ...form, rent: Number(e.target.value) || 0 })
              }
            />
            <Input
              placeholder="Area (e.g. 1200 sqft)"
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value })}
            />
            <Input
              type="number"
              placeholder="Bedrooms"
              value={form.bedrooms}
              onChange={(e) =>
                setForm({ ...form, bedrooms: Number(e.target.value) || 0 })
              }
            />
            <Input
              type="number"
              placeholder="Bathrooms"
              value={form.bathrooms}
              onChange={(e) =>
                setForm({ ...form, bathrooms: Number(e.target.value) || 0 })
              }
            />
            <Input
              required
              placeholder="Contact Info"
              value={form.contactInfo}
              onChange={(e) =>
                setForm({ ...form, contactInfo: e.target.value })
              }
            />
            <div className="col-span-1 lg:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Image
              </label>
              <ImageUploader
                value={form.imageUrl}
                onChange={(url) => setForm({ ...form, imageUrl: url })}
                folder="tolet"
              />
              <p className="mt-1 text-xs text-gray-500">
                Upload an image. The system will store and provide URL
                automatically.
              </p>
            </div>
            <textarea
              className="w-full rounded-lg border p-2"
              placeholder="Description"
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Active listing
            </label>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Button type="submit" className="gap-2">
              <CheckCircle className="w-4 h-4" />
              {editing ? "Update" : "Create"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowForm(false);
                setEditing(null);
                setForm(initialForm);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto bg-white rounded-xl border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Rent</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6">
                  Loading...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-6">
                  No To-Let listings yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((listing) => (
                <TableRow key={listing.id}>
                  <TableCell>{listing.title}</TableCell>
                  <TableCell>{listing.location}</TableCell>
                  <TableCell>
                    {Number(listing.rent).toLocaleString()}৳
                  </TableCell>
                  <TableCell>
                    {listing.active ? (
                      <span className="inline-flex items-center gap-1 text-green-600">
                        <CheckCircle className="w-3 h-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-gray-500">
                        <Circle className="w-3 h-3" /> Inactive
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditForm(listing)}
                      className="gap-1"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteMutation.mutate(listing.id)}
                      className="gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        toggleActiveMutation.mutate({
                          id: listing.id,
                          active: !listing.active,
                        })
                      }
                      className="gap-1"
                    >
                      {listing.active ? "Deactivate" : "Activate"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
