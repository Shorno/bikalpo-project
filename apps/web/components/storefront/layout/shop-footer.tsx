"use client";

import {
  IconBrandAndroid,
  IconBrandApple,
  IconBrandFacebook,
  IconBrandInstagram,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Globe2, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  isCustomerStorefrontPreview,
  withCustomerStorefrontPreview,
} from "@/lib/customer-storefront-preview";
import { platformSocialLinks } from "@/lib/platform-social-links";
import { storeFooterAnchor } from "@/lib/shop-footer-links";
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

const socialIcons = {
  Facebook: IconBrandFacebook,
  Instagram: IconBrandInstagram,
} as const;

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

  return (
    <footer className={styles.footer}>
      <div className={styles.content}>
        {/* Desktop: three columns. Mobile: the six sections pair up two per row. */}
        <div className={styles.columns}>
          <div>
            <nav aria-labelledby="shop-footer-about" className={styles.about}>
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
            <section
              className={`${styles.secondary} ${styles.social}`}
              aria-labelledby="shop-footer-social"
            >
              <h2 id="shop-footer-social">Follow us</h2>
              <div className={styles.socials}>
                {platformSocialLinks.map(({ label, url }) => {
                  const Icon = socialIcons[label];
                  return url ? (
                    <a
                      key={label}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Bikalpo on ${label} (opens in a new tab)`}
                    >
                      <Icon size={21} aria-hidden="true" />
                    </a>
                  ) : (
                    <span
                      key={label}
                      role="img"
                      aria-label={`${label} — link coming soon`}
                      title={`${label} — link coming soon`}
                    >
                      <Icon size={21} aria-hidden="true" />
                    </span>
                  );
                })}
              </div>
            </section>
          </div>
          <div>
            <nav
              aria-labelledby="shop-footer-support"
              className={styles.support}
            >
              <h2 id="shop-footer-support">Customer support</h2>
              <ul className={styles.links}>
                {shop && name && (
                  <li>
                    <StoreReportDialog
                      key={shop.id}
                      shopId={shop.id}
                      name={name}
                      openFromUrl={false}
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
              className={`${styles.secondary} ${styles.getApp}`}
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
            <nav
              aria-labelledby="shop-footer-policies"
              className={styles.policies}
            >
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
              className={`${styles.secondary} ${styles.contactUs}`}
              aria-labelledby="shop-footer-contact"
              aria-busy={isPending}
            >
              {/* The only store-specific details in the footer: phone, email, store link. */}
              <h2 id="shop-footer-contact">Contact us</h2>
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
                </address>
              ) : (
                <>
                  <p className={styles.demoNotice}>Demo contact details</p>
                  <address className={styles.contact}>
                    <p>
                      <Phone size={16} aria-hidden="true" />
                      <span>+880 1712-345678</span>
                    </p>
                    <p>
                      <Mail size={16} aria-hidden="true" />
                      <span>hello@retailer.example</span>
                    </p>
                    <Link href={storePath}>
                      <Globe2 size={16} aria-hidden="true" />
                      <span>Retailer store page</span>
                    </Link>
                  </address>
                </>
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
            Powered by <Link href="/">Bikalpo</Link>
          </p>
          <p>
            © {new Date().getFullYear()}
            {name ? ` ${name}` : ""}
          </p>
        </div>
      </div>
    </footer>
  );
}
