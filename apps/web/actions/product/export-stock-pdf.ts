"use server";

import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import {
  type GetProductsForStockParams,
  getProductsForStock,
} from "@/actions/product/get-products-for-stock";

function formatPrice(price: string | number | null | undefined): string {
  if (price == null) return "—";
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 0,
  }).format(Number(price));
}

function truncate(s: string, max: number): string {
  if (!s) return "—";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export async function exportStockPDF(
  params: Omit<GetProductsForStockParams, "page" | "limit"> = {},
): Promise<
  { success: true; pdfBase64: string } | { success: false; error: string }
> {
  try {
    const { products } = await getProductsForStock({
      ...params,
      page: 1,
      limit: 100_000,
    });

    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const { width, height } = page.getSize();

    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const leftMargin = 40;
    const rightMargin = width - 40;

    // Column X positions (approximate, 8 columns)
    const col = {
      id: leftMargin,
      name: leftMargin + 38,
      sku: leftMargin + 118,
      category: leftMargin + 178,
      stock: leftMargin + 268,
      reorder: leftMargin + 303,
      price: leftMargin + 348,
      inStock: leftMargin + 418,
    };

    let y = height - 50;
    let currentPage = page;
    const rowHeight = 16;
    const headerFontSize = 9;
    const cellFontSize = 8;

    // Title and date
    currentPage.drawText("Stock Inventory", {
      x: width / 2 - 55,
      y,
      size: 18,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    });
    y -= 22;

    currentPage.drawText(
      `Generated: ${new Date().toLocaleDateString("en-BD", { dateStyle: "medium" })}`,
      { x: leftMargin, y, size: 9, font: helvetica, color: rgb(0.4, 0.4, 0.4) },
    );
    y -= 24;

    // Table header
    currentPage.drawText("ID", {
      x: col.id,
      y,
      size: headerFontSize,
      font: helveticaBold,
    });
    currentPage.drawText("Product", {
      x: col.name,
      y,
      size: headerFontSize,
      font: helveticaBold,
    });
    currentPage.drawText("SKU", {
      x: col.sku,
      y,
      size: headerFontSize,
      font: helveticaBold,
    });
    currentPage.drawText("Category", {
      x: col.category,
      y,
      size: headerFontSize,
      font: helveticaBold,
    });
    currentPage.drawText("Stock", {
      x: col.stock,
      y,
      size: headerFontSize,
      font: helveticaBold,
    });
    currentPage.drawText("Reorder", {
      x: col.reorder,
      y,
      size: headerFontSize,
      font: helveticaBold,
    });
    currentPage.drawText("Price", {
      x: col.price,
      y,
      size: headerFontSize,
      font: helveticaBold,
    });
    currentPage.drawText("In", {
      x: col.inStock,
      y,
      size: headerFontSize,
      font: helveticaBold,
    });
    y -= 6;

    currentPage.drawLine({
      start: { x: leftMargin, y },
      end: { x: rightMargin, y },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 14;

    for (const p of products) {
      if (y < 60) {
        currentPage = pdfDoc.addPage([595, 842]);
        y = height - 50;
        // Repeat header on new page
        currentPage.drawText("ID", {
          x: col.id,
          y,
          size: headerFontSize,
          font: helveticaBold,
        });
        currentPage.drawText("Product", {
          x: col.name,
          y,
          size: headerFontSize,
          font: helveticaBold,
        });
        currentPage.drawText("SKU", {
          x: col.sku,
          y,
          size: headerFontSize,
          font: helveticaBold,
        });
        currentPage.drawText("Category", {
          x: col.category,
          y,
          size: headerFontSize,
          font: helveticaBold,
        });
        currentPage.drawText("Stock", {
          x: col.stock,
          y,
          size: headerFontSize,
          font: helveticaBold,
        });
        currentPage.drawText("Reorder", {
          x: col.reorder,
          y,
          size: headerFontSize,
          font: helveticaBold,
        });
        currentPage.drawText("Price", {
          x: col.price,
          y,
          size: headerFontSize,
          font: helveticaBold,
        });
        currentPage.drawText("In", {
          x: col.inStock,
          y,
          size: headerFontSize,
          font: helveticaBold,
        });
        y -= 6;
        currentPage.drawLine({
          start: { x: leftMargin, y },
          end: { x: rightMargin, y },
          thickness: 0.5,
          color: rgb(0.7, 0.7, 0.7),
        });
        y -= 14;
      }

      const cat = p.category?.name ?? "";
      const sub = p.subCategory?.name ? ` / ${p.subCategory.name}` : "";

      currentPage.drawText(`PRD-${p.id}`, {
        x: col.id,
        y,
        size: cellFontSize,
        font: helvetica,
      });
      currentPage.drawText(truncate(p.name, 18), {
        x: col.name,
        y,
        size: cellFontSize,
        font: helvetica,
      });
      currentPage.drawText(truncate(p.sku ?? p.slug ?? "", 12), {
        x: col.sku,
        y,
        size: cellFontSize,
        font: helvetica,
      });
      currentPage.drawText(truncate(cat + sub, 14), {
        x: col.category,
        y,
        size: cellFontSize,
        font: helvetica,
      });
      currentPage.drawText(String(p.stockQuantity), {
        x: col.stock,
        y,
        size: cellFontSize,
        font: helvetica,
      });
      currentPage.drawText(String(p.reorderLevel), {
        x: col.reorder,
        y,
        size: cellFontSize,
        font: helvetica,
      });
      currentPage.drawText(formatPrice(p.price), {
        x: col.price,
        y,
        size: cellFontSize,
        font: helvetica,
      });
      currentPage.drawText(p.inStock ? "Yes" : "No", {
        x: col.inStock,
        y,
        size: cellFontSize,
        font: helvetica,
      });

      y -= rowHeight;
    }

    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = Buffer.from(pdfBytes).toString("base64");

    return { success: true, pdfBase64 };
  } catch (e) {
    console.error("exportStockPDF:", e);
    return { success: false, error: "Failed to export PDF" };
  }
}
