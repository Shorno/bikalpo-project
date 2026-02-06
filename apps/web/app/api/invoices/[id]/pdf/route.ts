import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { db } from "@/db/config";
import { invoice } from "@/db/schema/invoice";
import { auth } from "@/lib/auth";

function formatPrice(price: string | number): string {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 0,
  }).format(Number(price));
}

function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-BD", {
    dateStyle: "medium",
  }).format(new Date(date));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Use request.headers for API routes
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized - Please log in to download invoices" },
        { status: 401 },
      );
    }

    const { id } = await params;
    const invoiceId = Number.parseInt(id, 10);

    if (Number.isNaN(invoiceId)) {
      return NextResponse.json(
        { error: "Invalid invoice ID" },
        { status: 400 },
      );
    }

    // Build query conditions based on user role
    const conditions = [eq(invoice.id, invoiceId)];

    // If not admin, only allow access to own invoices
    if (session.user.role !== "admin") {
      conditions.push(eq(invoice.customerId, session.user.id));
    }

    // Get invoice with related data
    const invoiceData = await db.query.invoice.findFirst({
      where: and(...conditions),
      with: {
        items: true,
        order: {
          columns: {
            id: true,
            orderNumber: true,
            shippingName: true,
            shippingPhone: true,
            shippingAddress: true,
            shippingCity: true,
            shippingArea: true,
          },
        },
        customer: {
          columns: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
            shopName: true,
            ownerName: true,
          },
        },
      },
    });

    if (!invoiceData) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 size
    const { width, height } = page.getSize();

    // Embed fonts
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let y = height - 50;
    const leftMargin = 50;
    const rightMargin = width - 50;

    // Header - INVOICE title
    page.drawText("INVOICE", {
      x: width / 2 - 40,
      y,
      size: 24,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    });
    y -= 40;

    // Invoice details (right side)
    const detailsX = rightMargin - 150;
    page.drawText(`Invoice: ${invoiceData.invoiceNumber}`, {
      x: detailsX,
      y,
      size: 10,
      font: helvetica,
    });
    y -= 15;
    page.drawText(`Date: ${formatDate(invoiceData.createdAt)}`, {
      x: detailsX,
      y,
      size: 10,
      font: helvetica,
    });
    y -= 15;
    page.drawText(`Order: ${invoiceData.order?.orderNumber || "-"}`, {
      x: detailsX,
      y,
      size: 10,
      font: helvetica,
    });
    y -= 30;

    // Divider line
    page.drawLine({
      start: { x: leftMargin, y },
      end: { x: rightMargin, y },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 25;

    // Bill To section
    page.drawText("Bill To:", {
      x: leftMargin,
      y,
      size: 12,
      font: helveticaBold,
    });
    y -= 18;

    const customerName =
      invoiceData.customer?.shopName || invoiceData.customer?.name || "-";
    page.drawText(customerName, {
      x: leftMargin,
      y,
      size: 10,
      font: helvetica,
    });
    y -= 14;

    if (invoiceData.customer?.ownerName) {
      page.drawText(`Owner: ${invoiceData.customer.ownerName}`, {
        x: leftMargin,
        y,
        size: 10,
        font: helvetica,
      });
      y -= 14;
    }

    if (invoiceData.customer?.phoneNumber) {
      page.drawText(`Phone: ${invoiceData.customer.phoneNumber}`, {
        x: leftMargin,
        y,
        size: 10,
        font: helvetica,
      });
      y -= 14;
    }

    if (invoiceData.order?.shippingAddress) {
      page.drawText(`Address: ${invoiceData.order.shippingAddress}`, {
        x: leftMargin,
        y,
        size: 10,
        font: helvetica,
      });
      y -= 14;
      page.drawText(
        `${invoiceData.order.shippingArea || ""}, ${invoiceData.order.shippingCity || ""}`,
        {
          x: leftMargin,
          y,
          size: 10,
          font: helvetica,
        },
      );
      y -= 14;
    }

    y -= 20;

    // Table header
    const col1 = leftMargin;
    const col2 = 320;
    const col3 = 380;
    const col4 = 460;

    page.drawText("Product", { x: col1, y, size: 10, font: helveticaBold });
    page.drawText("Qty", { x: col2, y, size: 10, font: helveticaBold });
    page.drawText("Price", { x: col3, y, size: 10, font: helveticaBold });
    page.drawText("Total", { x: col4, y, size: 10, font: helveticaBold });
    y -= 5;

    // Table header line
    page.drawLine({
      start: { x: leftMargin, y },
      end: { x: rightMargin, y },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 18;

    // Items
    for (const item of invoiceData.items || []) {
      // Truncate long product names
      const productName =
        item.productName.length > 40
          ? `${item.productName.substring(0, 40)}...`
          : item.productName;

      page.drawText(productName, {
        x: col1,
        y,
        size: 9,
        font: helvetica,
      });
      page.drawText(item.quantity.toString(), {
        x: col2,
        y,
        size: 9,
        font: helvetica,
      });
      page.drawText(formatPrice(item.unitPrice), {
        x: col3,
        y,
        size: 9,
        font: helvetica,
      });
      page.drawText(formatPrice(item.lineTotal), {
        x: col4,
        y,
        size: 9,
        font: helvetica,
      });

      y -= 18;

      // Check if we need a new page
      if (y < 150) {
        const _newPage = pdfDoc.addPage([595, 842]);
        y = height - 50;
      }
    }

    y -= 10;

    // Divider line
    page.drawLine({
      start: { x: leftMargin, y },
      end: { x: rightMargin, y },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 25;

    // Summary section (right aligned)
    const summaryLabelX = 350;
    const summaryValueX = 480;

    page.drawText("Subtotal:", {
      x: summaryLabelX,
      y,
      size: 10,
      font: helvetica,
    });
    page.drawText(formatPrice(invoiceData.subtotal), {
      x: summaryValueX,
      y,
      size: 10,
      font: helvetica,
    });
    y -= 16;

    if (Number(invoiceData.discountAmount) > 0) {
      page.drawText("Discount:", {
        x: summaryLabelX,
        y,
        size: 10,
        font: helvetica,
      });
      page.drawText(`-${formatPrice(invoiceData.discountAmount)}`, {
        x: summaryValueX,
        y,
        size: 10,
        font: helvetica,
        color: rgb(0, 0.5, 0),
      });
      y -= 16;
    }

    if (Number(invoiceData.deliveryCharge) > 0) {
      page.drawText("Delivery:", {
        x: summaryLabelX,
        y,
        size: 10,
        font: helvetica,
      });
      page.drawText(formatPrice(invoiceData.deliveryCharge), {
        x: summaryValueX,
        y,
        size: 10,
        font: helvetica,
      });
      y -= 16;
    }

    if (Number(invoiceData.taxAmount) > 0) {
      page.drawText("Tax/VAT:", {
        x: summaryLabelX,
        y,
        size: 10,
        font: helvetica,
      });
      page.drawText(formatPrice(invoiceData.taxAmount), {
        x: summaryValueX,
        y,
        size: 10,
        font: helvetica,
      });
      y -= 16;
    }

    y -= 5;

    // Grand Total
    page.drawText("Grand Total:", {
      x: summaryLabelX,
      y,
      size: 12,
      font: helveticaBold,
    });
    page.drawText(formatPrice(invoiceData.grandTotal), {
      x: summaryValueX,
      y,
      size: 12,
      font: helveticaBold,
    });
    y -= 40;

    // Footer
    page.drawText("Thank you for your business!", {
      x: width / 2 - 70,
      y,
      size: 10,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });
    y -= 15;

    page.drawText(
      `Payment: ${invoiceData.paymentStatus} | Delivery: ${invoiceData.deliveryStatus}`,
      {
        x: width / 2 - 90,
        y,
        size: 8,
        font: helvetica,
        color: rgb(0.5, 0.5, 0.5),
      },
    );

    // Serialize PDF
    const pdfBytes = await pdfDoc.save();

    // Return PDF - cast ArrayBuffer for Response compatibility
    return new Response(pdfBytes.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoiceData.invoiceNumber}.pdf"`,
        "Content-Length": pdfBytes.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error generating invoice PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 },
    );
  }
}
