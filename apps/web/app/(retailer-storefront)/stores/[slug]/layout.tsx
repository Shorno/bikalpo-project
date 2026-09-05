import type { ReactNode } from "react";
import { ShopFooter } from "@/components/storefront/layout/shop-footer";
import { ShopHeader } from "@/components/storefront/layout/shop-header";

export default async function RetailerStorefrontLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <>
      <ShopHeader key={`header-${slug}`} slug={slug} />
      <main>{children}</main>
      <ShopFooter key={`footer-${slug}`} slug={slug} />
    </>
  );
}
