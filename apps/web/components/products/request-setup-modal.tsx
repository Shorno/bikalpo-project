"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RequestType = "category" | "sub_category" | "brand" | "variant" | "core_product";

type Props = {
  /** Which types of requests to allow */
  allowedTypes?: RequestType[];
  /** Pre-select a type */
  defaultType?: RequestType;
  /** Trigger button label */
  triggerLabel?: string;
};

const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  category: "Category",
  sub_category: "Sub Category",
  brand: "Brand",
  variant: "Variant Option",
  core_product: "Core Product",
};

export function RequestSetupModal({
  allowedTypes = ["category", "sub_category", "brand", "variant", "core_product"],
  defaultType,
  triggerLabel = "+ Request Setup",
}: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<RequestType>(defaultType ?? allowedTypes[0]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Please enter a name");
      return;
    }
    setSubmitting(true);
    try {
      // For now, show a success toast — can be wired to catalogApprovalRequest API later
      toast.success(`Request submitted: ${REQUEST_TYPE_LABELS[type]} "${name.trim()}"`);
      setOpen(false);
      setName("");
      setDescription("");
    } catch {
      toast.error("Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-amber-700 border-amber-300 hover:bg-amber-50 gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request New Setup</DialogTitle>
          <DialogDescription>
            Can&apos;t find what you need? Submit a request to the admin team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Type */}
          <div className="space-y-2">
            <Label>Request Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as RequestType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowedTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {REQUEST_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label>Name <span className="text-red-500">*</span></Label>
            <Input
              placeholder={`Enter ${REQUEST_TYPE_LABELS[type].toLowerCase()} name...`}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description (Optional)</Label>
            <Textarea
              placeholder="Add any details to help admin understand your request..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="resize-none h-20"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !name.trim()}>
            {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
