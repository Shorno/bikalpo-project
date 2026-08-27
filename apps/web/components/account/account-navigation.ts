import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Building2,
  FileQuestion,
  FileText,
  Headphones,
  Home,
  Lock,
  MapPin,
  Megaphone,
  Package,
  ReceiptText,
  User,
} from "lucide-react";

export type AccountAudience = "consumer" | "shop";

export type AccountNavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
  quick?: boolean;
};

export type AccountNavigationSection = {
  id: "account" | "orders" | "activity" | "rentals" | "help";
  label: string;
  items: AccountNavigationItem[];
};

const sharedSections: AccountNavigationSection[] = [
  {
    id: "account",
    label: "Manage My Account",
    items: [
      {
        label: "Overview",
        href: "/account",
        icon: Home,
        exact: true,
        quick: true,
      },
      { label: "Personal Profile", href: "/account/profile", icon: User },
      {
        label: "Address Book",
        href: "/account/addresses",
        icon: MapPin,
        quick: true,
      },
      { label: "Security", href: "/account/security", icon: Lock },
    ],
  },
  {
    id: "orders",
    label: "My Orders",
    items: [
      {
        label: "All Orders",
        href: "/account/orders",
        icon: Package,
        quick: true,
      },
      { label: "Open Orders", href: "/account/open-orders", icon: ReceiptText },
    ],
  },
  {
    id: "activity",
    label: "My Activity",
    items: [
      {
        label: "Estimates",
        href: "/account/estimates",
        icon: FileText,
        quick: true,
      },
      {
        label: "Requested Items",
        href: "/account/requests",
        icon: FileQuestion,
      },
    ],
  },
  {
    id: "help",
    label: "Help",
    items: [
      { label: "Customer Support", href: "/account/support", icon: Headphones },
    ],
  },
];

const consumerOnlySections: AccountNavigationSection[] = [
  {
    id: "rentals",
    label: "Rentals",
    items: [
      {
        label: "My Bookings",
        href: "/account/to-let",
        icon: Building2,
        exact: true,
      },
    ],
  },
];

const consumerHelpItems: AccountNavigationItem[] = [
  { label: "Complaints", href: "/account/complaints", icon: AlertTriangle },
];

export function getAccountNavigation(
  audience: AccountAudience,
): AccountNavigationSection[] {
  const sections = sharedSections.map((section) => ({
    ...section,
    items: section.items.map((item) => ({ ...item })),
  }));

  if (audience === "consumer") {
    const activityIndex = sections.findIndex(
      (section) => section.id === "activity",
    );
    if (activityIndex >= 0) sections.splice(activityIndex, 1);

    sections
      .find((section) => section.id === "help")
      ?.items.unshift(...consumerHelpItems);
    const helpIndex = sections.findIndex((section) => section.id === "help");
    sections.splice(
      helpIndex >= 0 ? helpIndex : sections.length,
      0,
      ...consumerOnlySections.map((section) => ({
        ...section,
        items: section.items.map((item) => ({ ...item })),
      })),
    );
  }

  if (audience === "shop") {
    const profileItem = sections
      .find((section) => section.id === "account")
      ?.items.find((item) => item.href === "/account/profile");
    if (profileItem) profileItem.label = "Business Profile";
  }

  return sections;
}

export function getQuickAccountLinks(audience: AccountAudience) {
  return getAccountNavigation(audience)
    .flatMap((section) => section.items)
    .filter((item) => item.quick)
    .slice(0, 3);
}

export function createPropertyNavigationItems(input: {
  href: string;
  label: string;
  hasPropertyAccount: boolean;
}): AccountNavigationItem[] {
  return [
    { label: input.label, href: input.href, icon: Building2 },
    ...(input.hasPropertyAccount
      ? [{ label: "My Posts", href: "/account/to-let/posts", icon: Megaphone }]
      : []),
  ];
}
