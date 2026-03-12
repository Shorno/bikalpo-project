import { Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400">
      {/* Main footer content */}
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {/* About */}
          <div className="col-span-2 md:col-span-1">
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">
              About Us
            </h3>
            <p className="text-sm leading-relaxed mb-4">
              Your trusted online marketplace for quality products delivered
              fast to your door.
            </p>
            <div className="space-y-2 text-sm">
              <a
                href="mailto:info@bikalpo.com"
                className="flex items-center gap-2 hover:text-white transition-colors"
              >
                <Mail className="size-3.5 text-primary" />
                info@bikalpo.com
              </a>
              <a
                href="tel:+8801234567890"
                className="flex items-center gap-2 hover:text-white transition-colors"
              >
                <Phone className="size-3.5 text-primary" />
                +880 123 456 7890
              </a>
              <div className="flex items-center gap-2">
                <MapPin className="size-3.5 text-primary" />
                <span>Dhaka, Bangladesh</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2 text-sm">
              {[
                { href: "/about", label: "About Us" },
                { href: "/products", label: "Products" },
                { href: "/store", label: "Our Outlets" },
                { href: "/contact", label: "Contact Us" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="hover:text-white hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">
              Customer Service
            </h3>
            <ul className="space-y-2 text-sm">
              {[
                { href: "/faqs", label: "FAQs" },
                { href: "/terms", label: "Terms & Conditions" },
                { href: "/privacy", label: "Privacy Policy" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* My Account */}
          <div>
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">
              My Account
            </h3>
            <ul className="space-y-2 text-sm">
              {[
                { href: "/login", label: "Login / Register" },
                { href: "/account/orders", label: "My Orders" },
                { href: "/account/addresses", label: "My Addresses" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="bg-gray-800 mb-6" />

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-sm">
          <p>© {new Date().getFullYear()} Bikalpo. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
            <Link
              href="/privacy"
              className="hover:text-white transition-colors"
            >
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
