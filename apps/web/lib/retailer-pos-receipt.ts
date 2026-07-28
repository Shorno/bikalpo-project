import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

function value(input: string | number | null | undefined) {
  const parsed = Number(input ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(input: string | number | null | undefined) {
  return value(input).toFixed(2);
}

export async function downloadRetailerPosReceipt(detail: any) {
  const document = await PDFDocument.create();
  const receiptHeight = Math.max(420, 330 + detail.sale.items.length * 29);
  const page = document.addPage([260, receiptHeight]);
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();
  let y = height - 28;

  const printable = (text: string, fallback: string) =>
    text.replace(/[^\x20-\x7E]/g, "").trim() || fallback;
  const centered = (text: string, size: number, font = regular) => {
    const clean = printable(text, "Retailer Shop");
    const textWidth = font.widthOfTextAtSize(clean, size);
    page.drawText(clean, {
      x: Math.max(14, (width - textWidth) / 2),
      y,
      size,
      font,
      color: rgb(0.08, 0.14, 0.11),
    });
    y -= size + 5;
  };
  const line = (left: string, right = "", strong = false) => {
    const font = strong ? bold : regular;
    const size = strong ? 10 : 8.5;
    const cleanLeft = printable(left, "Item");
    const cleanRight = right.replace(/[^\x20-\x7E]/g, "");
    page.drawText(cleanLeft.slice(0, 34), {
      x: 16,
      y,
      size,
      font,
      color: rgb(0.08, 0.14, 0.11),
    });
    if (cleanRight) {
      const rightWidth = font.widthOfTextAtSize(cleanRight, size);
      page.drawText(cleanRight, {
        x: width - 16 - rightWidth,
        y,
        size,
        font,
        color: rgb(0.08, 0.14, 0.11),
      });
    }
    y -= size + 5;
  };
  const rule = () => {
    page.drawLine({
      start: { x: 16, y },
      end: { x: width - 16, y },
      thickness: 0.6,
      dashArray: [3, 3],
      color: rgb(0.55, 0.6, 0.57),
    });
    y -= 12;
  };

  centered(detail.shop.name || "Retailer Shop", 14, bold);
  if (detail.shop.address) centered(detail.shop.address, 7.5);
  if (detail.shop.phone) centered(detail.shop.phone, 7.5);
  rule();
  line(detail.sale.invoiceNo, "", true);
  line(new Date(detail.sale.createdAt).toLocaleString("en-BD"));
  line(detail.sale.customerName, detail.sale.customerPhone || "");
  rule();
  for (const item of detail.sale.items) {
    line(
      String(item.productName).slice(0, 30),
      `BDT ${money(item.lineTotal)}`,
      true,
    );
    line(`${item.quantity} ${item.unitLabel} x BDT ${money(item.unitPrice)}`);
  }
  rule();
  line("Subtotal", `BDT ${money(detail.sale.subtotal)}`);
  line("Discount", `- BDT ${money(detail.sale.discount)}`);
  line("VAT", `BDT ${money(detail.sale.tax)}`);
  line("Total", `BDT ${money(detail.sale.total)}`, true);
  line("Paid", `BDT ${money(detail.sale.paid)}`);
  line("Due", `BDT ${money(detail.sale.due)}`);
  if (value(detail.sale.changeAmount) > 0)
    line("Change", `BDT ${money(detail.sale.changeAmount)}`);
  rule();
  centered(
    `Served by ${detail.sale.soldBy?.name || detail.shop.ownerName || "Shop Owner"}`,
    7.5,
  );
  centered("Thank you", 8.5, bold);

  const bytes = await document.save();
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = `${detail.sale.invoiceNo}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
}
