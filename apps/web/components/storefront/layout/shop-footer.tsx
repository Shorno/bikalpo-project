"use client";

import {
  IconBrandAndroid,
  IconBrandApple,
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandTiktok,
  IconBrandX,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Clock3, Globe2, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  isCustomerStorefrontPreview,
  withCustomerStorefrontPreview,
} from "@/lib/customer-storefront-preview";
import { publicSocialUrl, storeFooterAnchor } from "@/lib/shop-footer-links";
import { formatStoreTime } from "@/lib/store-hours";
import { storePolicyHref, storePolicyLinks } from "@/lib/store-policy-links";
import { orpc } from "@/utils/orpc";
import { StoreReportDialog } from "../store-report-dialog";
import styles from "./shop-footer.module.css";

const platformLinks = [
  { label: "Home", href: "/" },
  { label: "All Stores", href: "/stores" },
  { label: "Help Center", href: "/help-center" },
  { label: "Contact Us", href: "/contact" },
];

export function ShopFooter({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const previewMode = isCustomerStorefrontPreview(searchParams.get("preview"));
  const { data, isPending } = useQuery(
    orpc.customer.getShopNavigation.queryOptions({ input: { slug } }),
  );
  const shop = data?.shop;
  const name = shop?.shopName || shop?.name;
  const storePath = withCustomerStorefrontPreview(
    `/stores/${encodeURIComponent(slug)}`,
    previewMode,
  );
  const socialLinks = [
    {
      label: "Facebook",
      url: publicSocialUrl(shop?.facebookUrl),
      Icon: IconBrandFacebook,
    },
    {
      label: "Instagram",
      url: publicSocialUrl(shop?.instagramUrl),
      Icon: IconBrandInstagram,
    },
    {
      label: "TikTok",
      url: publicSocialUrl(shop?.tiktokUrl),
      Icon: IconBrandTiktok,
    },
    { label: "X", url: publicSocialUrl(shop?.twitterUrl), Icon: IconBrandX },
  ].filter((social) => social.url);

  return (
    <footer className={styles.footer}>
      <div className={styles.content}>
        <div className={styles.columns}>
          <div>
            <nav aria-labelledby="shop-footer-about">
              <h2 id="shop-footer-about">About store</h2>
              <ul className={styles.links}>
                <li>
                  <a
                    href={storeFooterAnchor(
                      slug,
                      "store-information",
                      previewMode,
                    )}
                  >
                    About Store
                  </a>
                </li>
                <li>
                  <a
                    href={storeFooterAnchor(
                      slug,
                      "store-products",
                      previewMode,
                    )}
                  >
                    Our Products
                  </a>
                </li>
                {!!data?.availableBrands?.length && (
                  <li>
                    <a
                      href={storeFooterAnchor(
                        slug,
                        "available-brands",
                        previewMode,
                      )}
                    >
                      Available Brands
                    </a>
                  </li>
                )}
              </ul>
            </nav>
            {socialLinks.length > 0 && (
              <section
                className={styles.secondary}
                aria-labelledby="shop-footer-social"
              >
                <h2 id="shop-footer-social">Follow us</h2>
                <div className={styles.socials}>
                  {socialLinks.map(({ label, url, Icon }) => (
                    <a
                      key={label}
                      href={url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${name || "Store"} on ${label} (opens in a new tab)`}
                    >
                      <Icon size={21} aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </section>
            )}
          </div>
          <div>
            <nav aria-labelledby="shop-footer-support">
              <h2 id="shop-footer-support">Customer support</h2>
              <ul className={styles.links}>
                {shop && name && (
                  <li>
                    <StoreReportDialog
                      key={shop.id}
                      shopId={shop.id}
                      name={name}
                    />
                  </li>
                )}
                <li>
                  <Link href="/account/support">Support tickets</Link>
                </li>
                <li>
                  <Link
                    href={withCustomerStorefrontPreview(
                      `/stores/${encodeURIComponent(slug)}/track`,
                      previewMode,
                    )}
                    scroll={false}
                    onNavigate={() => {
                      window.scrollTo({
                        top: 0,
                        behavior: window.matchMedia(
                          "(prefers-reduced-motion: reduce)",
                        ).matches
                          ? "instant"
                          : "smooth",
                      });
                    }}
                  >
                    Track order
                  </Link>
                </li>
                <li>
                  <Link
                    href={withCustomerStorefrontPreview(
                      `/stores/${encodeURIComponent(slug)}/requests?request=new`,
                      previewMode,
                    )}
                  >
                    Request an item
                  </Link>
                </li>
                <li>
                  <Link
                    href={withCustomerStorefrontPreview(
                      `/stores/${encodeURIComponent(slug)}/requests`,
                      previewMode,
                    )}
                  >
                    My item requests
                  </Link>
                </li>
              </ul>
            </nav>
            <section
              className={styles.secondary}
              aria-labelledby="shop-footer-app"
            >
              <h2 id="shop-footer-app">Get the Bikalpo app</h2>
              <div className={styles.apps}>
                {[
                  { label: "Android", Icon: IconBrandAndroid },
                  { label: "iOS", Icon: IconBrandApple },
                ].map(({ label, Icon }) => (
                  <span key={label} className={styles.app}>
                    <Icon size={25} aria-hidden="true" />
                    <span>
                      {label}
                      <small>Coming soon</small>
                    </span>
                  </span>
                ))}
              </div>
            </section>
          </div>
          <div>
            <nav aria-labelledby="shop-footer-policies">
              <h2 id="shop-footer-policies">Policies</h2>
              <ul className={styles.links}>
                {storePolicyLinks.map((policy) => (
                  <li key={policy.id}>
                    <Link href={storePolicyHref(slug, policy.id, previewMode)}>
                      {policy.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/terms">Terms &amp; Conditions</Link>
                </li>
                <li>
                  <Link href="/privacy">Privacy Policy</Link>
                </li>
              </ul>
            </nav>
            <section
              className={styles.secondary}
              aria-labelledby="shop-footer-contact"
              aria-busy={isPending}
            >
              <h2 id="shop-footer-contact">Contact store</h2>
              {isPending ? (
                <p className={styles.pending}>Loading store details…</p>
              ) : shop ? (
                <address className={styles.contact}>
                  {shop.phoneNumber && (
                    <a href={`tel:${shop.phoneNumber}`}>
                      <Phone size={16} aria-hidden="true" />
                      <span>{shop.phoneNumber}</span>
                    </a>
                  )}
                  {shop.businessEmail && (
                    <a href={`mailto:${shop.businessEmail}`}>
                      <Mail size={16} aria-hidden="true" />
                      <span>{shop.businessEmail}</span>
                    </a>
                  )}
                  <Link href={storePath}>
                    <Globe2 size={16} aria-hidden="true" />
                    <span>{name} store page</span>
                  </Link>
                  {shop.shopOpeningTime && shop.shopClosingTime && (
                    <p>
                      <Clock3 size={16} aria-hidden="true" />
                      <span>
                        {formatStoreTime(shop.shopOpeningTime)} –{" "}
                        {formatStoreTime(shop.shopClosingTime)}
                      </span>
                    </p>
                  )}
                </address>
              ) : (
                <p className={styles.pending}>
                  Store contact details are unavailable.
                </p>
              )}
            </section>
          </div>
        </div>
        <div className={styles.platform}>
          <p>Verified Multi-Vendor Digital Commerce Platform</p>
          <nav aria-label="Bikalpo platform">
            <ul>
              {platformLinks.map(({ label, href }) => (
                <li key={href}>
                  <Link href={href}>{label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
      <div className={styles.bottom}>
        <div className={styles.copyright}>
          <p>
            © {new Date().getFullYear()}
            {name ? ` ${name}` : ""}
          </p>
          <p>
            Powered by <Link href="/">Bikalpo</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
