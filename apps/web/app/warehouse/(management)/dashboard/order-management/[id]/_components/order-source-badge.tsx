import { Badge } from "@/components/ui/badge";

const sourceConfig: Record<string, { label: string; className: string }> = {
  direct: {
    label: "Direct",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  salesman: {
    label: "Salesman",
    className: "border-indigo-200 bg-indigo-50 text-indigo-700",
  },
  estimate: {
    label: "Estimate",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  pre_order: {
    label: "Pre-Order",
    className: "border-orange-200 bg-orange-50 text-orange-700",
  },
};

export function OrderSourceBadge({ source }: { source: string }) {
  const config = sourceConfig[source] ?? {
    label: source,
    className: "border-gray-200 bg-gray-50 text-gray-700",
  };
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}
