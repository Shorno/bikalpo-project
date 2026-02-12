import { AnnouncementBoardCard } from "@/components/features/home/sidebar/announcement-board-card";
import { BrandUpdatesCard } from "@/components/features/home/sidebar/brand-updates-card";
import { TopBrandsCard } from "@/components/features/home/sidebar/top-brands-card";
import { client } from "@/utils/orpc";

export async function CustomerSidebar() {
  const [brandsResult, announcementsResult, brandUpdatesResult] = await Promise.all([
    client.customer.getActiveBrands(),
    client.customer.getAnnouncements(),
    client.customer.getBrandUpdates(),
  ]);

  const brands = brandsResult.brands ?? [];
  const announcements = announcementsResult.announcements ?? [];
  const brandUpdates = brandUpdatesResult.updates ?? [];

  return (
    <aside className="space-y-4">
      <TopBrandsCard brands={brands} />
      <BrandUpdatesCard updates={brandUpdates} />
      <AnnouncementBoardCard announcements={announcements} />
    </aside>
  );
}
