import {
  type ConsumerPriceUpdate,
  MAX_PRICE_IMPORT_ROWS,
  updateConsumerReferencePriceSchema,
} from "@bikalpo-project/api/consumer-price";
import ExcelJS from "exceljs";

type ExportPriceRow = {
  variantPriceId: number;
  productId: number;
  productName: string;
  productSku: string | null;
  coreProductName: string | null;
  typeName: string;
  categoryName: string;
  subCategoryName: string;
  brandDisplay: string;
  variantName: string;
  variantUnit: string;
  consumerPrice: string;
  isCylinderPricing: boolean;
  exchangePrice: string | null;
  updatedAt: Date | string | null;
  updatedByName: string | null;
};

export type PriceImportPreview = {
  rows: ConsumerPriceUpdate[];
  errors: string[];
};

export function createPriceWorkbook(items: ExportPriceRow[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Prices", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = [
    { header: "Variant Price ID", key: "variantPriceId", width: 18 },
    { header: "Product ID", key: "productId", width: 18 },
    { header: "Product", key: "productName", width: 35 },
    { header: "SKU", key: "productSku", width: 24 },
    { header: "Type", key: "typeName", width: 20 },
    { header: "Category", key: "categoryName", width: 24 },
    { header: "Sub-Category", key: "subCategoryName", width: 24 },
    { header: "Core Identity", key: "coreProductName", width: 30 },
    { header: "Brand", key: "brandDisplay", width: 20 },
    { header: "Variant", key: "variantName", width: 25 },
    { header: "Unit", key: "variantUnit", width: 12 },
    { header: "Price", key: "price", width: 18 },
    { header: "Exchange Price", key: "exchangePrice", width: 18 },
    { header: "New Cylinder Price", key: "newCylinderPrice", width: 22 },
    { header: "Last Update", key: "updatedAt", width: 25 },
    { header: "Updated By", key: "updatedByName", width: 25 },
  ];
  for (const item of items) {
    sheet.addRow({
      ...item,
      productId: `PRD-${String(item.productId).padStart(6, "0")}`,
      price: item.isCylinderPricing ? null : Number(item.consumerPrice),
      exchangePrice:
        item.exchangePrice == null ? null : Number(item.exchangePrice),
      newCylinderPrice: item.isCylinderPricing
        ? Number(item.consumerPrice)
        : null,
      updatedAt: item.updatedAt ? new Date(item.updatedAt).toISOString() : "",
    });
  }
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF166534" },
  };
  sheet.getRow(1).height = 24;
  sheet.autoFilter = "A1:P1";
  for (const key of ["price", "exchangePrice", "newCylinderPrice"]) {
    sheet.getColumn(key).numFmt = "#,##0.00";
  }
  const help = workbook.addWorksheet("Instructions");
  help.getColumn(1).width = 120;
  help.addRows([
    ["Consumer reference price update"],
    ["Edit the Prices sheet and keep each Variant Price ID unchanged."],
    [
      "For regular variants, edit Price. For cylinders, edit New Cylinder Price and Exchange Price.",
    ],
    [
      "Leave an unavailable Exchange Price blank to keep exchange disabled. Entering a price enables exchange.",
    ],
    [
      "Prices must be positive, at most 99,999,999.99 BDT, with up to two decimal places.",
    ],
    [
      "Exchange Price cannot exceed New Cylinder Price. Use numeric values, not formulas.",
    ],
    [
      `Upload at most ${MAX_PRICE_IMPORT_ROWS} rows at a time. All rows must be valid; updates are saved together.`,
    ],
    [
      "Product details are for identification only. Upload changes prices, not names, SKUs, brands or units.",
    ],
  ]);
  return workbook;
}

function cellValue(cell: ExcelJS.Cell): string {
  if (cell.value == null) return "";
  if (typeof cell.value === "string" || typeof cell.value === "number")
    return String(cell.value).trim();
  throw new Error(
    "Use plain text or numbers, not formulas, dates or links, in price and ID cells",
  );
}

export function parsePriceWorkbook(
  workbook: ExcelJS.Workbook,
): PriceImportPreview {
  const sheet = workbook.getWorksheet("Prices") ?? workbook.worksheets[0];
  if (!sheet) return { rows: [], errors: ["The workbook has no worksheet"] };
  const headers = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, column) => {
    headers.set(cell.text.trim().toLowerCase().replace(/\s+/g, " "), column);
  });
  if (
    !headers.has("variant price id") ||
    (!headers.has("price") && !headers.has("new cylinder price"))
  ) {
    return {
      rows: [],
      errors: [
        "Use an exported Price List with Variant Price ID and Price / New Cylinder Price columns",
      ],
    };
  }
  const rows: ConsumerPriceUpdate[] = [];
  const errors: string[] = [];
  const ids = new Set<number>();
  let count = 0;
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || !row.hasValues) return;
    count++;
    if (count > MAX_PRICE_IMPORT_ROWS) return;
    try {
      const read = (name: string) => {
        const column = headers.get(name);
        return column == null ? "" : cellValue(row.getCell(column));
      };
      const id = read("variant price id");
      const price = read("price");
      const newPrice = read("new cylinder price");
      const exchangePrice = read("exchange price");
      if (!/^\d+$/.test(id))
        throw new Error("Variant Price ID must be a positive integer");
      if (price && newPrice)
        throw new Error("Fill Price or New Cylinder Price, not both");
      if (exchangePrice && !newPrice)
        throw new Error("Exchange Price requires New Cylinder Price");
      const result = updateConsumerReferencePriceSchema.safeParse({
        variantPriceId: Number(id),
        consumerPrice: newPrice || price,
        exchangePrice: exchangePrice || undefined,
      });
      if (!result.success)
        throw new Error(result.error.issues[0]?.message ?? "Invalid price");
      if (ids.has(result.data.variantPriceId))
        throw new Error(`Duplicate Variant Price ID ${id}`);
      ids.add(result.data.variantPriceId);
      rows.push(result.data);
    } catch (error) {
      errors.push(
        `Row ${rowNumber}: ${error instanceof Error ? error.message : "Invalid row"}`,
      );
    }
  });
  if (count > MAX_PRICE_IMPORT_ROWS)
    errors.push(`Upload at most ${MAX_PRICE_IMPORT_ROWS} rows at a time`);
  if (count === 0) errors.push("The Prices sheet has no price rows");
  return { rows, errors };
}

export async function readPriceWorkbook(buffer: ArrayBuffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return parsePriceWorkbook(workbook);
}

export async function writePriceWorkbook(items: ExportPriceRow[]) {
  const buffer = await createPriceWorkbook(items).xlsx.writeBuffer();
  return new Blob([new Uint8Array(buffer)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
