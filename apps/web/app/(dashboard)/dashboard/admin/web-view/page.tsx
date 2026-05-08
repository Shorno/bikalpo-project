import type { Metadata } from "next";
import { WebViewMarketplace } from "@/components/web-view/web-view-marketplace";

export const metadata: Metadata = {
  title: "Web View | Admin",
  description: "Preview consumer reference products from the admin dashboard",
};

export default function AdminWebViewPage() {
  return <WebViewMarketplace />;
}
