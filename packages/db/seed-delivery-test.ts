/**
 * Seed script: Creates test orders + invoices for delivery flow testing.
 * 
 * Run with: pnpm -F @bikalpo-project/db exec drizzle-kit push && node --import=tsx packages/db/seed-delivery-test.ts
 * Or: bun packages/db/seed-delivery-test.ts
 * Or: npx -y tsx@latest packages/db/seed-delivery-test.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: "./apps/server/.env" });

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
const { Pool } = pg;

import { user } from "./packages/db/src/schema/auth-schema";
import { order, orderItem } from "./packages/db/src/schema/order";
import { invoice, invoiceItem } from "./packages/db/src/schema/invoice";
import { product } from "./packages/db/src/schema/product";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  connectionTimeoutMillis: 15000,
});

const db = drizzle({ client: pool });

async function seed() {
  console.log("🌱 Seeding delivery test data...\n");

  // 1. Find existing users
  const users = await db.select({
    id: user.id,
    name: user.name,
    role: user.role,
    phoneNumber: user.phoneNumber,
    shopName: user.shopName,
    warehouseName: user.warehouseName,
    warehouseSlug: user.warehouseSlug,
  }).from(user).limit(50);

  console.log("📋 Found users:");
  users.forEach((u: any) => {
    console.log(`  - ${u.name} (${u.role}) ${u.shopName ? `[shop: ${u.shopName}]` : ''} ${u.warehouseName ? `[wh: ${u.warehouseName}]` : ''} phone: ${u.phoneNumber}`);
  });

  // Find key roles
  const warehouseUser = users.find((u: any) => u.role === "warehouse");
  const shopUser = users.find((u: any) => u.role === "seller" || u.role === "shop_owner");
  const adminUser = users.find((u: any) => u.role === "admin");
  const deliverymanUser = users.find((u: any) => u.role === "deliveryman");
  const consumerUser = users.find((u: any) => u.role === "consumer");

  // Pick a buyer
  const buyer = shopUser || consumerUser || users.find((u: any) => u.id !== warehouseUser?.id && u.id !== adminUser?.id);

  if (!buyer) {
    console.error("❌ No buyer user found! You need at least 2 users in the database.");
    process.exit(1);
  }

  console.log(`\n🔑 Using buyer: ${buyer.name} (${buyer.role}, id: ${buyer.id})`);
  if (warehouseUser) console.log(`🏭 Warehouse: ${warehouseUser.warehouseName || warehouseUser.name} (id: ${warehouseUser.id})`);
  if (deliverymanUser) console.log(`🚚 Deliveryman: ${deliverymanUser.name} (id: ${deliverymanUser.id})`);

  // 2. Find some products
  const products = await db.select({
    id: product.id,
    name: product.name,
    image: product.image,
  }).from(product).limit(5);

  if (products.length === 0) {
    console.error("❌ No products found! Create some products first.");
    process.exit(1);
  }

  console.log(`\n📦 Found ${products.length} products:`, products.map((p: any) => p.name).join(", "));

  // 3. Create 3 test orders with invoices
  const testOrders = [
    { name: "Test Delivery Order A", total: 2500, items: 2 },
    { name: "Test Delivery Order B", total: 1800, items: 1 },
    { name: "Test Delivery Order C", total: 3200, items: 3 },
  ];

  for (let i = 0; i < testOrders.length; i++) {
    const testOrder = testOrders[i]!;
    const orderNum = `TEST-DEL-${Date.now()}-${i + 1}`;
    const invoiceNum = `INV-DEL-${Date.now()}-${i + 1}`;

    // Create order
    const [newOrder] = await db.insert(order).values({
      orderNumber: orderNum,
      userId: buyer.id,
      orderType: warehouseUser ? "b2b" : "b2c",
      warehouseId: warehouseUser?.id || null,
      shopId: shopUser?.id || null,
      subtotal: testOrder.total.toString(),
      shippingCost: "0",
      discount: "0",
      total: testOrder.total.toString(),
      status: "confirmed",
      paymentStatus: "pending",
      paymentMethod: "cash_on_delivery",
      shippingName: buyer.shopName || buyer.name,
      shippingPhone: buyer.phoneNumber || "01700000000",
      shippingAddress: `Test Address ${i + 1}, Mohammadpur`,
      shippingCity: "Dhaka",
      shippingArea: "Mohammadpur",
      customerNote: `Test delivery order ${i + 1}`,
      confirmedAt: new Date(),
    }).returning();

    console.log(`\n✅ Order created: ${orderNum} (id: ${newOrder!.id})`);

    // Create order items
    for (let j = 0; j < Math.min(testOrder.items, products.length); j++) {
      const prod = products[j % products.length]!;
      const qty = j + 1;
      const unitPrice = Math.round(testOrder.total / testOrder.items / qty);

      await db.insert(orderItem).values({
        orderId: newOrder!.id,
        productId: prod.id,
        productName: prod.name,
        productImage: prod.image || "",
        productSize: "Standard",
        quantity: qty,
        unitPrice: unitPrice.toString(),
        totalPrice: (unitPrice * qty).toString(),
      });
    }

    // Create invoice (this is what "Dispatch Orders → Unassigned" looks for)
    const [newInvoice] = await db.insert(invoice).values({
      invoiceNumber: invoiceNum,
      orderId: newOrder!.id,
      customerId: buyer.id,
      invoiceType: "main",
      paymentStatus: "unpaid",
      deliveryStatus: "not_assigned",
      subtotal: testOrder.total.toString(),
      discountAmount: "0",
      deliveryCharge: "0",
      taxAmount: "0",
      grandTotal: testOrder.total.toString(),
    }).returning();

    console.log(`  📄 Invoice created: ${invoiceNum} (id: ${newInvoice!.id}) — status: not_assigned ✓`);

    // Create invoice items
    for (let j = 0; j < Math.min(testOrder.items, products.length); j++) {
      const prod = products[j % products.length]!;
      const qty = j + 1;
      const unitPrice = Math.round(testOrder.total / testOrder.items / qty);

      await db.insert(invoiceItem).values({
        invoiceId: newInvoice!.id,
        productId: prod.id,
        productName: prod.name,
        quantity: qty,
        unitPrice: unitPrice.toString(),
        lineTotal: (unitPrice * qty).toString(),
      });
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("🎉 Done! 3 orders + 3 invoices created.");
  console.log("\n📍 Next steps:");
  console.log("  1. Login as warehouse user");
  console.log("  2. Go to: Dispatch Orders page");
  console.log("  3. You'll see 3 unassigned invoices");
  console.log("  4. Select → Create Group → Assign deliveryman");
  if (deliverymanUser) {
    console.log(`\n  🚚 Deliveryman: ${deliverymanUser.name} (${deliverymanUser.phoneNumber})`);
  } else {
    console.log("\n  ⚠️  No deliveryman found! Create one first.");
  }
  console.log("=".repeat(60));

  await pool.end();
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
