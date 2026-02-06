import "dotenv/config";
import { db } from "../db/config";
import { category } from "../db/schema/category";
import { product } from "../db/schema/product";

// ─────────────────────────────────────────────────────────────────
// Environment Guard: Development Only
// ─────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  console.error("❌ Seed script cannot run in production environment");
  process.exit(1);
}

console.log("🌱 Starting seed script...");
console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);

// ─────────────────────────────────────────────────────────────────
// Helper: Generate Date N Days Ago
// ─────────────────────────────────────────────────────────────────
const daysAgo = (days: number) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000);

// ─────────────────────────────────────────────────────────────────
// Categories Data
// ─────────────────────────────────────────────────────────────────
const categories = [
  {
    name: "Electronics",
    slug: "electronics",
    image: "https://placehold.co/400x400/3b82f6/white?text=Electronics",
    displayOrder: 1,
  },
  {
    name: "Grocery",
    slug: "grocery",
    image: "https://placehold.co/400x400/22c55e/white?text=Grocery",
    displayOrder: 2,
  },
  {
    name: "Fashion",
    slug: "fashion",
    image: "https://placehold.co/400x400/ec4899/white?text=Fashion",
    displayOrder: 3,
  },
  {
    name: "Home & Kitchen",
    slug: "home-kitchen",
    image: "https://placehold.co/400x400/f59e0b/white?text=Home",
    displayOrder: 4,
  },
  {
    name: "Beauty",
    slug: "beauty",
    image: "https://placehold.co/400x400/8b5cf6/white?text=Beauty",
    displayOrder: 5,
  },
];

// ─────────────────────────────────────────────────────────────────
// Products Data (50 products)
// ─────────────────────────────────────────────────────────────────
const products = [
  // Electronics (12 products) - Price range: 250-12000
  {
    name: "USB-C Cable 1m",
    slug: "usb-c-cable-1m",
    categorySlug: "electronics",
    price: "250.00",
    size: "1m",
    daysAgo: 1,
  },
  {
    name: "Phone Stand",
    slug: "phone-stand",
    categorySlug: "electronics",
    price: "350.00",
    size: "Standard",
    daysAgo: 2,
  },
  {
    name: "Wireless Mouse",
    slug: "wireless-mouse",
    categorySlug: "electronics",
    price: "850.00",
    size: "Compact",
    daysAgo: 3,
  },
  {
    name: "USB Hub 4-Port",
    slug: "usb-hub-4port",
    categorySlug: "electronics",
    price: "650.00",
    size: "Portable",
    daysAgo: 5,
  },
  {
    name: "Bluetooth Speaker",
    slug: "bluetooth-speaker",
    categorySlug: "electronics",
    price: "2500.00",
    size: "Medium",
    daysAgo: 7,
  },
  {
    name: "Wireless Earbuds",
    slug: "wireless-earbuds",
    categorySlug: "electronics",
    price: "3500.00",
    size: "Compact",
    daysAgo: 8,
  },
  {
    name: "Power Bank 10000mAh",
    slug: "power-bank-10000",
    categorySlug: "electronics",
    price: "1800.00",
    size: "10000mAh",
    daysAgo: 10,
  },
  {
    name: "Mechanical Keyboard",
    slug: "mechanical-keyboard",
    categorySlug: "electronics",
    price: "4500.00",
    size: "Full",
    daysAgo: 12,
  },
  {
    name: "Webcam HD",
    slug: "webcam-hd",
    categorySlug: "electronics",
    price: "2800.00",
    size: "1080p",
    daysAgo: 15,
  },
  {
    name: "Smart Watch",
    slug: "smart-watch",
    categorySlug: "electronics",
    price: "8500.00",
    size: "44mm",
    daysAgo: 18,
  },
  {
    name: "Tablet Stand",
    slug: "tablet-stand",
    categorySlug: "electronics",
    price: "450.00",
    size: "Adjustable",
    daysAgo: 20,
  },
  {
    name: "Wireless Charger",
    slug: "wireless-charger",
    categorySlug: "electronics",
    price: "1200.00",
    size: "15W",
    daysAgo: 25,
  },

  // Grocery (10 products) - Price range: 80-800
  {
    name: "Basmati Rice 1kg",
    slug: "basmati-rice-1kg",
    categorySlug: "grocery",
    price: "180.00",
    size: "1kg",
    daysAgo: 1,
  },
  {
    name: "Olive Oil 500ml",
    slug: "olive-oil-500ml",
    categorySlug: "grocery",
    price: "650.00",
    size: "500ml",
    daysAgo: 2,
  },
  {
    name: "Honey Pure 250g",
    slug: "honey-pure-250g",
    categorySlug: "grocery",
    price: "350.00",
    size: "250g",
    daysAgo: 4,
  },
  {
    name: "Green Tea 100 Bags",
    slug: "green-tea-100bags",
    categorySlug: "grocery",
    price: "280.00",
    size: "100 bags",
    daysAgo: 6,
  },
  {
    name: "Almonds 200g",
    slug: "almonds-200g",
    categorySlug: "grocery",
    price: "450.00",
    size: "200g",
    daysAgo: 9,
  },
  {
    name: "Pasta 500g",
    slug: "pasta-500g",
    categorySlug: "grocery",
    price: "120.00",
    size: "500g",
    daysAgo: 11,
  },
  {
    name: "Coffee Beans 250g",
    slug: "coffee-beans-250g",
    categorySlug: "grocery",
    price: "550.00",
    size: "250g",
    daysAgo: 14,
  },
  {
    name: "Coconut Oil 500ml",
    slug: "coconut-oil-500ml",
    categorySlug: "grocery",
    price: "320.00",
    size: "500ml",
    daysAgo: 17,
  },
  {
    name: "Oats 1kg",
    slug: "oats-1kg",
    categorySlug: "grocery",
    price: "280.00",
    size: "1kg",
    daysAgo: 22,
  },
  {
    name: "Dark Chocolate 100g",
    slug: "dark-chocolate-100g",
    categorySlug: "grocery",
    price: "180.00",
    size: "100g",
    daysAgo: 28,
  },

  // Fashion (10 products) - Price range: 350-5000
  {
    name: "Cotton T-Shirt",
    slug: "cotton-tshirt",
    categorySlug: "fashion",
    price: "450.00",
    size: "M",
    daysAgo: 1,
  },
  {
    name: "Denim Jeans",
    slug: "denim-jeans",
    categorySlug: "fashion",
    price: "1800.00",
    size: "32",
    daysAgo: 3,
  },
  {
    name: "Casual Sneakers",
    slug: "casual-sneakers",
    categorySlug: "fashion",
    price: "2500.00",
    size: "42",
    daysAgo: 5,
  },
  {
    name: "Leather Belt",
    slug: "leather-belt",
    categorySlug: "fashion",
    price: "650.00",
    size: "Free",
    daysAgo: 7,
  },
  {
    name: "Summer Dress",
    slug: "summer-dress",
    categorySlug: "fashion",
    price: "1200.00",
    size: "S",
    daysAgo: 10,
  },
  {
    name: "Running Shoes",
    slug: "running-shoes",
    categorySlug: "fashion",
    price: "3500.00",
    size: "40",
    daysAgo: 13,
  },
  {
    name: "Polo Shirt",
    slug: "polo-shirt",
    categorySlug: "fashion",
    price: "850.00",
    size: "L",
    daysAgo: 16,
  },
  {
    name: "Formal Trousers",
    slug: "formal-trousers",
    categorySlug: "fashion",
    price: "1500.00",
    size: "34",
    daysAgo: 19,
  },
  {
    name: "Canvas Backpack",
    slug: "canvas-backpack",
    categorySlug: "fashion",
    price: "1800.00",
    size: "25L",
    daysAgo: 23,
  },
  {
    name: "Wool Scarf",
    slug: "wool-scarf",
    categorySlug: "fashion",
    price: "550.00",
    size: "Standard",
    daysAgo: 27,
  },

  // Home & Kitchen (10 products) - Price range: 200-6000
  {
    name: "Stainless Steel Bottle",
    slug: "steel-bottle",
    categorySlug: "home-kitchen",
    price: "450.00",
    size: "750ml",
    daysAgo: 2,
  },
  {
    name: "Non-Stick Pan",
    slug: "nonstick-pan",
    categorySlug: "home-kitchen",
    price: "1200.00",
    size: "26cm",
    daysAgo: 4,
  },
  {
    name: "Ceramic Mug Set",
    slug: "ceramic-mug-set",
    categorySlug: "home-kitchen",
    price: "650.00",
    size: "4 pcs",
    daysAgo: 6,
  },
  {
    name: "Food Container Set",
    slug: "food-container-set",
    categorySlug: "home-kitchen",
    price: "850.00",
    size: "5 pcs",
    daysAgo: 8,
  },
  {
    name: "Knife Set",
    slug: "knife-set",
    categorySlug: "home-kitchen",
    price: "2200.00",
    size: "6 pcs",
    daysAgo: 11,
  },
  {
    name: "Blender 500W",
    slug: "blender-500w",
    categorySlug: "home-kitchen",
    price: "3500.00",
    size: "1.5L",
    daysAgo: 14,
  },
  {
    name: "Cutting Board",
    slug: "cutting-board",
    categorySlug: "home-kitchen",
    price: "380.00",
    size: "Large",
    daysAgo: 18,
  },
  {
    name: "Electric Kettle",
    slug: "electric-kettle",
    categorySlug: "home-kitchen",
    price: "1800.00",
    size: "1.8L",
    daysAgo: 21,
  },
  {
    name: "Lunch Box 3-Tier",
    slug: "lunch-box-3tier",
    categorySlug: "home-kitchen",
    price: "550.00",
    size: "3 tier",
    daysAgo: 24,
  },
  {
    name: "Pressure Cooker 5L",
    slug: "pressure-cooker-5l",
    categorySlug: "home-kitchen",
    price: "4500.00",
    size: "5L",
    daysAgo: 29,
  },

  // Beauty (8 products) - Price range: 150-3500
  {
    name: "Face Wash 100ml",
    slug: "face-wash-100ml",
    categorySlug: "beauty",
    price: "280.00",
    size: "100ml",
    daysAgo: 1,
  },
  {
    name: "Moisturizer 50ml",
    slug: "moisturizer-50ml",
    categorySlug: "beauty",
    price: "650.00",
    size: "50ml",
    daysAgo: 3,
  },
  {
    name: "Sunscreen SPF50",
    slug: "sunscreen-spf50",
    categorySlug: "beauty",
    price: "450.00",
    size: "50ml",
    daysAgo: 6,
  },
  {
    name: "Hair Serum",
    slug: "hair-serum",
    categorySlug: "beauty",
    price: "550.00",
    size: "100ml",
    daysAgo: 9,
  },
  {
    name: "Lip Balm Set",
    slug: "lip-balm-set",
    categorySlug: "beauty",
    price: "320.00",
    size: "3 pcs",
    daysAgo: 12,
  },
  {
    name: "Perfume 50ml",
    slug: "perfume-50ml",
    categorySlug: "beauty",
    price: "2500.00",
    size: "50ml",
    daysAgo: 16,
  },
  {
    name: "Vitamin C Serum",
    slug: "vitamin-c-serum",
    categorySlug: "beauty",
    price: "1200.00",
    size: "30ml",
    daysAgo: 20,
  },
  {
    name: "Makeup Kit",
    slug: "makeup-kit",
    categorySlug: "beauty",
    price: "3500.00",
    size: "Complete",
    daysAgo: 26,
  },
];

// ─────────────────────────────────────────────────────────────────
// Main Seed Function
// ─────────────────────────────────────────────────────────────────
async function seed() {
  try {
    // 1. Seed Categories
    console.log("\n📁 Seeding categories...");
    for (const cat of categories) {
      await db
        .insert(category)
        .values({
          name: cat.name,
          slug: cat.slug,
          image: cat.image,
          displayOrder: cat.displayOrder,
          isActive: true,
        })
        .onConflictDoNothing({ target: category.slug });
    }
    console.log(`   ✅ ${categories.length} categories processed`);

    // 2. Fetch category IDs
    const categoryMap = new Map<string, number>();
    const existingCategories = await db.query.category.findMany({
      columns: { id: true, slug: true },
    });
    for (const c of existingCategories) {
      categoryMap.set(c.slug, c.id);
    }

    // 3. Seed Products
    console.log("\n📦 Seeding products...");
    let insertedCount = 0;
    for (const prod of products) {
      const categoryId = categoryMap.get(prod.categorySlug);
      if (!categoryId) {
        console.warn(`   ⚠️ Category not found: ${prod.categorySlug}`);
        continue;
      }

      await db
        .insert(product)
        .values({
          name: prod.name,
          slug: prod.slug,
          categoryId: categoryId,
          price: prod.price,
          size: prod.size,
          image: `https://placehold.co/400x400/e2e8f0/475569?text=${encodeURIComponent(prod.name.slice(0, 10))}`,
          inStock: true,
          isFeatured: insertedCount < 5, // First 5 are featured
          stockQuantity: Math.floor(Math.random() * 100) + 10,
          createdAt: daysAgo(prod.daysAgo),
          updatedAt: new Date(),
        })
        .onConflictDoNothing({ target: product.slug });

      insertedCount++;
    }
    console.log(`   ✅ ${insertedCount} products processed`);

    console.log("\n🎉 Seed completed successfully!\n");
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  }
}

// Run seed
seed().then(() => process.exit(0));
