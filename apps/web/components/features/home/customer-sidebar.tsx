import { getAnnouncements } from "@/actions/announcement/get-announcements";
import { getActiveBrands } from "@/actions/brand/get-brands";
import { getBrandUpdates } from "@/actions/brand-update/get-brand-updates";
import { AnnouncementBoardCard } from "@/components/features/home/sidebar/announcement-board-card";
import { BrandUpdatesCard } from "@/components/features/home/sidebar/brand-updates-card";
import { TopBrandsCard } from "@/components/features/home/sidebar/top-brands-card";

export async function CustomerSidebar() {
  const [brands, announcementsResult, brandUpdatesResult] = await Promise.all([
    getActiveBrands(),
    getAnnouncements(),
    getBrandUpdates(),
  ]);

  const announcements = announcementsResult.data || [];
  const brandUpdates = brandUpdatesResult.data || [];

  return (
    <aside className="space-y-4">
      <TopBrandsCard brands={brands} />
      <BrandUpdatesCard updates={brandUpdates} />
      <AnnouncementBoardCard announcements={announcements} />
    </aside>
  );
}
