import { Building2, KeyRound, LayoutGrid } from "lucide-react";

export const publicNavigationLinks = [
  { label: "Products", href: "/products", icon: LayoutGrid },
  { label: "Seller", href: "/b2b", icon: Building2 },
  { label: "To-Let", href: "/to-let", icon: KeyRound },
] as const;
