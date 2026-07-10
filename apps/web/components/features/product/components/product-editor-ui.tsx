import { Package } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

export function ProductEditorSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="px-5 py-6 sm:px-6">
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

export function ProductEditorIdentity({
  image,
  name,
  meta,
  action,
}: {
  image?: string | null;
  name: string;
  meta: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
      {image ? (
        <Image
          src={image}
          alt={name}
          width={44}
          height={44}
          className="h-11 w-11 rounded-lg border bg-background object-cover"
        />
      ) : (
        <div className="flex h-11 w-11 items-center justify-center rounded-lg border bg-background">
          <Package className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{name}</p>
        {meta && (
          <p className="truncate text-xs text-muted-foreground">{meta}</p>
        )}
      </div>
      {action}
    </div>
  );
}
