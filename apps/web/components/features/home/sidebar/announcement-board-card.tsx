import { Megaphone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Announcement {
  id: number;
  title: string;
  description: string | null;
  type: string | null;
}

interface AnnouncementBoardCardProps {
  announcements: Announcement[];
}

const typeColors: Record<string, string> = {
  warning: "bg-amber-500",
  success: "bg-emerald-500",
  alert: "bg-red-500",
  info: "bg-blue-500",
};

export function AnnouncementBoardCard({
  announcements,
}: AnnouncementBoardCardProps) {
  if (!announcements || announcements.length === 0) return null;

  return (
    <Card className="py-4 bg-rose-50/50 border-rose-100">
      <CardHeader className="pb-2 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-rose-600" />
          Announcements
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <div className="space-y-3">
          {announcements.slice(0, 5).map((item) => (
            <div key={item.id} className="flex gap-2.5 items-start">
              <div
                className={cn(
                  "mt-1.5 w-1.5 h-1.5 rounded-full shrink-0",
                  typeColors[item.type || "info"] || typeColors.info,
                )}
              />
              <div className="space-y-0.5 min-w-0">
                <p className="text-sm font-medium text-foreground leading-snug">
                  {item.title}
                </p>
                {item.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
