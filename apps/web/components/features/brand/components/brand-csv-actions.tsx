"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Download, LoaderCircle, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { BrandSetupRow } from "@/components/features/brand/components/brand-columns";
import { Button } from "@/components/ui/button";
import { orpc } from "@/utils/orpc";

const CSV_HEADERS = ["name", "slug", "logo", "isActive", "displayOrder"];

export default function BrandCsvActions({
  brands,
}: {
  brands: BrandSetupRow[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const queryClient = useQueryClient();

  const exportCsv = () => {
    const lines = [
      CSV_HEADERS.join(","),
      ...brands.map((brand) =>
        [
          brand.name,
          brand.slug,
          brand.logo ?? "",
          String(brand.isActive),
          String(brand.displayOrder),
        ]
          .map(escapeCsvValue)
          .join(","),
      ),
    ];
    const url = URL.createObjectURL(
      new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "brands.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const importCsv = async (file: File) => {
    setIsImporting(true);
    try {
      const rows = parseCsv(await file.text());
      if (rows.length < 2 || rows[0]?.join(",") !== CSV_HEADERS.join(",")) {
        throw new Error(`CSV headers must be: ${CSV_HEADERS.join(", ")}`);
      }
      let imported = 0;
      for (const row of rows.slice(1)) {
        if (!row.some(Boolean)) continue;
        const [name, slug, logo, isActive, displayOrder] = row;
        await orpc.brand.create.call({
          name: name?.trim() ?? "",
          slug: slug?.trim() ?? "",
          logo: logo?.trim() || undefined,
          isActive: isActive?.trim().toLowerCase() !== "false",
          displayOrder: Number(displayOrder || 0),
        });
        imported += 1;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orpc.brand.getAll.key() }),
        queryClient.invalidateQueries({
          queryKey: orpc.brand.getAdminAll.key(),
        }),
      ]);
      toast.success(`${imported} brand${imported === 1 ? "" : "s"} imported`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Brand import failed",
      );
    } finally {
      setIsImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void importCsv(file);
        }}
        ref={inputRef}
        type="file"
      />
      <Button
        disabled={isImporting}
        onClick={() => inputRef.current?.click()}
        variant="outline"
      >
        {isImporting ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <Upload aria-hidden="true" className="size-4" />
        )}
        Import
      </Button>
      <Button onClick={exportCsv} variant="outline">
        <Download aria-hidden="true" className="size-4" />
        Export
      </Button>
    </>
  );
}

function escapeCsvValue(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
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
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && value[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (cell || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
