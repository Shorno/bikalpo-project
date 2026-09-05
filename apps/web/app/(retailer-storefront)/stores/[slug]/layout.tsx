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
      <ShopHeader key={slug} slug={slug} />
      <main>{children}</main>
      <ShopFooter key={slug} slug={slug} />
    </>
  );
}
