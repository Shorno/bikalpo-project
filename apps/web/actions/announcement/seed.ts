import { createAnnouncement } from "./create-announcement";

export async function seedAnnouncements() {
  const dummyData = [
    {
      title: "Delivery delayed tomorrow",
      type: "warning",
      description:
        "Due to heavy rain, deliveries might be delayed by 2-3 hours.",
    },
    {
      title: "New Product Added: Pran Mustard Oil 1L",
      type: "success",
      description: "Fresh stock available now at best wholesale rates.",
    },
    {
      title: "Offer: 2% off above $10,000 orders",
      type: "info",
      description: "Limited time offer valid till next Friday.",
    },
  ];

  for (const item of dummyData) {
    await createAnnouncement(item);
  }

  console.log("Seeded dummy announcements");
}
