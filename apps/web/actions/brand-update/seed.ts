import { createBrandUpdate } from "./create-brand-update";

export async function seedBrandUpdates() {
  const dummyData = [
    {
      title: "Delivery delayed tomorrow",
      type: "warning",
      description: "Logistics partner notice: Heavy traffic expected.",
    },
    {
      title: "New Product Added: Pran Mustard Oil 1L",
      type: "new",
      description: "Check the 'Edible Oils' section for bulk discounts.",
    },
    {
      title: "Offer: 2% off above $10,000 orders",
      type: "offer",
      description: "Valid for all Akij and PRAN products this week.",
    },
  ];

  for (const item of dummyData) {
    await createBrandUpdate(item);
  }

  console.log("Seeded dummy brand updates");
}
