import { Building2, MapPin, Package, Truck } from "lucide-react";

interface WarehouseInfoFooterProps {
  name: string;
  location: string;
  totalProducts: number;
  deliveryCoverage: string;
}

export function WarehouseInfoFooter({
  name,
  location,
  totalProducts,
  deliveryCoverage,
}: WarehouseInfoFooterProps) {
  return (
    <section className="bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <h3 className="text-lg font-bold mb-5 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-400" />
          Warehouse Information
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-white/5">
            <Building2 className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Warehouse Name</p>
              <p className="text-sm font-medium">{name}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg bg-white/5">
            <MapPin className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Location</p>
              <p className="text-sm font-medium">{location}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg bg-white/5">
            <Package className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Total Products</p>
              <p className="text-sm font-medium">{totalProducts}</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-lg bg-white/5">
            <Truck className="w-5 h-5 text-purple-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Delivery Coverage</p>
              <p className="text-sm font-medium">{deliveryCoverage}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
