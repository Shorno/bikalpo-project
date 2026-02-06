import { MapPin, Trophy } from "lucide-react";
import type { VerifiedUser } from "@/actions/users/get-verified-users";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface TopBuyersProps {
  buyers: VerifiedUser[];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function TopBuyers({ buyers }: TopBuyersProps) {
  if (buyers.length === 0) return null;

  return (
    <div className="mb-12">
      {/* Section Title */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <Trophy className="w-6 h-6 text-yellow-500" />
        <h2 className="text-2xl font-bold text-gray-900">Top Buyers</h2>
      </div>

      {/* Top Buyers Cards - Same style as verified customers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {buyers.slice(0, 3).map((buyer, index) => (
          <Card
            key={buyer.id}
            className="border-2 border-gray-100 hover:border-blue-200 hover:shadow-lg transition-all duration-300"
          >
            <CardContent className="p-5">
              {/* Header: Avatar + Info */}
              <div className="flex items-center gap-4 mb-4">
                {/* Avatar */}
                <Avatar className="w-14 h-14 shrink-0">
                  <AvatarImage
                    src={buyer.image || undefined}
                    alt={buyer.name}
                  />
                  <AvatarFallback className="text-lg bg-gray-200 text-gray-600">
                    {getInitials(buyer.shopName || buyer.name)}
                  </AvatarFallback>
                </Avatar>

                {/* Shop Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900 text-base truncate">
                      {buyer.shopName || buyer.name}
                    </h3>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      #{index + 1}
                    </Badge>
                  </div>
                  {buyer.area && (
                    <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="truncate">{buyer.area}, Dhaka</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Total Orders Section */}
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">
                  Total Orders
                </p>
                <p className="text-lg font-bold text-gray-900">
                  {buyer.totalOrders} Orders
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
