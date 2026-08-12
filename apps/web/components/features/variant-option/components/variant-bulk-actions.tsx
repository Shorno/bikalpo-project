"use client";

import { useQueryClient } from "@tanstack/react-query";
import { FileUp, Layers3 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { SetupFormDialog } from "@/components/features/product-setup";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { orpc } from "@/utils/orpc";

const HEADERS = [
  "kind",
  "value",
  "measurementUnit",
  "container",
  "attribute",
  "displayAlias",
  "typeId",
  "categoryId",
  "sortOrder",
];

export default function VariantBulkActions() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(`${HEADERS.join(",")}\n`);
  const [isImporting, setIsImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const importRows = async (csv: string) => {
    setIsImporting(true);
    try {
      const rows = parseCsv(csv);
      if (rows[0]?.map((item) => item.trim()).join(",") !== HEADERS.join(",")) {
        throw new Error(`CSV headers must be: ${HEADERS.join(", ")}`);
      }
      let imported = 0;
      for (const row of rows.slice(1)) {
        if (!row.some((item) => item.trim())) continue;
        const [
          kind,
          definitionValue,
          measurementUnit,
          container,
          attribute,
          displayAlias,
          typeId,
          categoryId,
          sortOrder,
        ] = row.map((item) => item.trim());
        const definition = buildDefinition({
          kind,
          value: definitionValue,
          measurementUnit,
          container,
          attribute,
        });
        await orpc.adminVariantOption.create.call({
          definition,
          displayAlias: displayAlias || undefined,
          typeId: Number(typeId),
          categoryId: categoryId ? Number(categoryId) : null,
          sortOrder: Number(sortOrder || 0),
        });
        imported += 1;
      }
      await queryClient.invalidateQueries({
        queryKey: orpc.adminVariantOption.getAll.key(),
      });
      toast.success(`${imported} variant${imported === 1 ? "" : "s"} added`);
      setOpen(false);
      setValue(`${HEADERS.join(",")}\n`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Variant import failed",
      );
    } finally {
      setIsImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <input
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void file.text().then(importRows);
        }}
        ref={fileRef}
        type="file"
      />
      <Button onClick={() => fileRef.current?.click()} variant="outline">
        <FileUp aria-hidden="true" className="size-4" />
        Import CSV
      </Button>

      <SetupFormDialog
        description="Paste CSV rows below. Every row uses the same canonical-definition and scope validation as single creation."
        hasUnsavedChanges={() => value !== `${HEADERS.join(",")}\n`}
        isSubmitting={isImporting}
        onOpenChange={setOpen}
        onSubmit={() => void importRows(value)}
        open={open}
        size="large"
        submitLabel="Add Variants"
        title="Bulk Add Variants"
        trigger={
          <Button variant="outline">
            <Layers3 aria-hidden="true" className="size-4" />
            Bulk Add
          </Button>
        }
      >
        <Textarea
          className="min-h-64 font-mono text-xs"
          onChange={(event) => setValue(event.target.value)}
          spellCheck={false}
          value={value}
        />
        <p className="text-xs text-muted-foreground">
          Kinds: measurement, loose, attribute. Category ID may be blank; Type
          ID is required.
        </p>
      </SetupFormDialog>
    </>
  );
}

function buildDefinition(input: {
  kind?: string;
  value?: string;
  measurementUnit?: string;
  container?: string;
  attribute?: string;
}) {
  if (input.kind === "loose") {
    return {
      kind: "loose" as const,
      measurementUnit: required(input.measurementUnit, "measurementUnit"),
    };
  }
  if (input.kind === "attribute") {
    return {
      kind: "attribute" as const,
      attribute: required(input.attribute, "attribute"),
      value: required(input.value, "value"),
    };
  }
  if (input.kind === "measurement") {
    return {
      kind: "measurement" as const,
      value: required(input.value, "value"),
      measurementUnit: required(input.measurementUnit, "measurementUnit"),
      container: required(input.container, "container"),
    };
  }
  throw new Error(`Unsupported variant kind: ${input.kind || "blank"}`);
}

function required(value: string | undefined, field: string) {
  if (!value) throw new Error(`${field} is required for this variant kind`);
  return value;
}

function parseCsv(value: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '"' && quoted && value[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && value[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += character;
  }
  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
