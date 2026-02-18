"use client";

import { AnnouncementBoardCard } from "@/components/features/home/sidebar/announcement-board-card";
import { BrandUpdatesCard } from "@/components/features/home/sidebar/brand-updates-card";
import { TopBrandsCard } from "@/components/features/home/sidebar/top-brands-card";
import {
  useActiveBrands,
  useAnnouncements,
  useBrandUpdates,
} from "@/hooks/use-customer-api";

export function CustomerSidebar() {
  const { data: brandsData } = useActiveBrands();
  const { data: announcementsData } = useAnnouncements();
  const { data: brandUpdatesData } = useBrandUpdates();

  const brands = brandsData?.brands ?? [];
  const announcements = announcementsData?.announcements ?? [];
  const brandUpdates = brandUpdatesData?.updates ?? [];

  return (
    <aside className="space-y-4">
      <TopBrandsCard brands={brands} />
      <BrandUpdatesCard updates={brandUpdates} />
      <AnnouncementBoardCard announcements={announcements} />
    </aside>
  );
}

