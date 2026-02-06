import { UserPlus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function VerifiedCustomersCta() {
  return (
    <div className="relative">
      {/* Background Image with Overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=2000&q=80')",
        }}
      >
        <div className="absolute inset-0 bg-black/50" />
      </div>

      {/* Content */}
      <div className="relative py-16 md:py-24">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-4xl font-semibold text-white mb-6">
            Want your shop to become verified?
          </h2>
          <Button asChild size="lg" className="px-8">
            <Link href="/sign-up">
              <UserPlus className="w-5 h-5 mr-2" />
              Apply for Verification
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
