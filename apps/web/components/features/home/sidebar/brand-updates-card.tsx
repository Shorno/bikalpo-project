import { Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface BrandUpdate {
  id: number;
  title: string;
  description: string | null;
  type: string | null;
}

interface BrandUpdatesCardProps {
  updates: BrandUpdate[];
}

const typeColors: Record<string, string> = {
  warning: "bg-amber-500",
  new: "bg-emerald-500",
  default: "bg-orange-500",
};

export function BrandUpdatesCard({ updates }: BrandUpdatesCardProps) {
  if (!updates || updates.length === 0) return null;

  return (
    <Card className="py-4 bg-orange-50/50 border-orange-100">
      <CardHeader className="pb-2 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Tag className="h-4 w-4 text-orange-600" />
          Brand Updates
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        <div className="space-y-3">
          {updates.slice(0, 5).map((item) => (
            <div key={item.id} className="flex gap-2.5 items-start">
              <div
                className={cn(
                  "mt-1.5 w-1.5 h-1.5 rounded-full shrink-0",
                  typeColors[item.type || "default"] || typeColors.default,
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
