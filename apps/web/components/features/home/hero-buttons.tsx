import Link from "next/link";
import { Button } from "@/components/ui/button";

export function HeroButtons() {
  return (
    <div className="flex items-center justify-center gap-4 flex-wrap">
      <Button size="lg" asChild>
        <Link href="/products">Browse Products</Link>
      </Button>
      <Button size="lg" variant="outline" asChild>
        <Link href="/login">Login to Order</Link>
      </Button>
    </div>
  );
}
