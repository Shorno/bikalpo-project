import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export function ProductEditorSection({
  title,
  description,
  action,
  children,
  className,
  variant = "plain",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  variant?: "plain" | "card";
}) {
  return (
    <section
      className={cn(
        "px-5 py-6 sm:px-6",
        variant === "card" && "min-w-0 rounded-xl border bg-card",
        className,
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-[15px] font-semibold leading-none tracking-tight">
            {title}
          </h2>
          {description && (
            <p className="text-[13px] text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * Type, Category, Sub category and Core identity laid out exactly like the
 * Create Product pickers, for screens where they can no longer change (a
 * saved product, a catalog product a seller adds). The client wants this
 * block to look the same before and after the core identity is chosen.
 */
export function ProductIdentityFields({
  type,
  category,
  subCategory,
  coreIdentity,
}: {
  type?: string | null;
  category?: string | null;
  subCategory?: string | null;
  coreIdentity?: string | null;
}) {
  const fields = [
    { label: "Type", value: type },
    { label: "Category *", value: category },
    { label: "Sub category", value: subCategory, empty: "No sub category" },
    { label: "Core identity *", value: coreIdentity },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.map((field) => (
        <Field key={field.label}>
          <FieldLabel>{field.label}</FieldLabel>
          <div
            className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-2.5 text-sm dark:bg-input/30"
            title="Set when the product was created"
          >
            <span
              className={cn(
                "truncate",
                !field.value && "text-muted-foreground",
              )}
            >
              {field.value || field.empty || "—"}
            </span>
            <Lock
              aria-label="Can't be changed"
              className="size-3.5 shrink-0 text-muted-foreground"
            />
          </div>
        </Field>
      ))}
    </div>
  );
}
