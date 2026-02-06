import { db } from "@/db/config";
import { brand } from "@/db/schema";

export async function seedBrands() {
  const dummyBrands = [
    {
      name: "Walton",
      slug: "walton",
      // High-fidelity text placeholder mimicking a logo
      logo: "https://placehold.co/200x80/ffffff/333333/png?text=WALTON&font=montserrat",
      isActive: true,
      displayOrder: 1,
    },
    {
      name: "Akij",
      slug: "akij",
      logo: "https://placehold.co/200x80/ffffff/333333/png?text=AKIJ&font=roboto",
      isActive: true,
      displayOrder: 2,
    },
    {
      name: "Meghna",
      slug: "meghna",
      logo: "https://placehold.co/200x80/ffffff/333333/png?text=Meghna&font=playfair",
      isActive: true,
      displayOrder: 3,
    },
    {
      name: "Bera",
      slug: "bera",
      logo: "https://placehold.co/200x80/ffffff/333333/png?text=BERA&font=lato",
      isActive: true,
      displayOrder: 4,
    },
    {
      name: "Pran",
      slug: "pran",
      logo: "https://placehold.co/200x80/ffffff/333333/png?text=PRAN&font=oswald",
      isActive: true,
      displayOrder: 5,
    },
    {
      name: "RFL",
      slug: "rfl",
      logo: "https://placehold.co/200x80/ffffff/333333/png?text=RFL&font=roboto",
      isActive: true,
      displayOrder: 6,
    },
    {
      name: "ACI",
      slug: "aci",
      logo: "https://placehold.co/200x80/ffffff/333333/png?text=ACI&font=montserrat",
      isActive: true,
      displayOrder: 7,
    },
  ];

  // Optional: Clear existing brands to ensure clean state
  await db.delete(brand);

  for (const item of dummyBrands) {
    await db.insert(brand).values(item);
  }

  console.log("Seeded dummy brands");
}
