"use client";

import { Store } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import styles from "./seller-card.module.css";

export interface DirectorySeller {
  id: string;
  name: string | null;
  slug: string | null;
  role: "shop_owner" | "warehouse";
  nature: string | null;
  address: string;
  district: string;
  division: string;
  area?: string | null;
  category?: string | null;
  logo?: string | null;
  images?: string[];
}

export function SellerCard({ seller }: { seller: DirectorySeller }) {
  const [activeImage, setActiveImage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [logoFailed, setLogoFailed] = useState(false);
  const images = useMemo(
    () =>
      [...new Set(seller.images ?? [])].filter(
        (image) => image && !failedImages.includes(image),
      ),
    [seller.images, failedImages],
  );
  const name = seller.name || "Registered business";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word[0])
    .join("");
  const location =
    [seller.area, seller.district].filter(Boolean).join(", ") || seller.address;
  const category =
    seller.category ||
    seller.nature?.replaceAll("_", " ") ||
    (seller.role === "warehouse" ? "Warehouse" : "Seller");
  const href = seller.slug
    ? `${seller.role === "warehouse" ? "/w" : "/stores"}/${encodeURIComponent(seller.slug)}`
    : null;

  useEffect(() => {
    if (images.length < 2 || paused) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setInterval> | undefined;
    const syncPlayback = () => {
      clearInterval(timer);
      if (!reducedMotion.matches) {
        timer = setInterval(
          () => setActiveImage((index) => (index + 1) % images.length),
          2400,
        );
      }
    };
    syncPlayback();
    reducedMotion.addEventListener("change", syncPlayback);
    return () => {
      clearInterval(timer);
      reducedMotion.removeEventListener("change", syncPlayback);
    };
  }, [images.length, paused]);

  const content = (
    <>
      <div className={styles.images}>
        {images.length ? (
          images.map((image, index) => (
            <Image
              key={image}
              src={image}
              alt={index === activeImage % images.length ? name : ""}
              fill
              sizes="(max-width: 800px) 50vw, 20vw"
              className={styles.photo}
              data-active={index === activeImage % images.length}
              onError={() => setFailedImages((failed) => [...failed, image])}
            />
          ))
        ) : (
          <span className={styles.emptyImage}>
            <Store className="size-10" aria-hidden="true" />
            <span className="sr-only">No business photo available</span>
          </span>
        )}
        {images.length > 1 ? (
          <div className={styles.dots} aria-hidden="true">
            {images.map((image, index) => (
              <span
                key={image}
                data-active={index === activeImage % images.length}
              />
            ))}
          </div>
        ) : null}
      </div>
      <div className={styles.body}>
        <div className={styles.nameRow}>
          <span className={styles.logo} aria-hidden="true">
            {seller.logo && !logoFailed ? (
              <Image
                src={seller.logo}
                alt=""
                fill
                sizes="28px"
                className="object-contain"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              initials
            )}
          </span>
          <h2 className={styles.name}>{name}</h2>
        </div>
        <p className={styles.location}>{location}</p>
        <p className={styles.category}>{category}</p>
      </div>
    </>
  );

  return (
    <Card
      className={`gap-0 py-0 ring-0 ${styles.card}`}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      {href ? (
        <Link
          href={href}
          className={styles.link}
          aria-label={name}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          {content}
        </Link>
      ) : (
        content
      )}
    </Card>
  );
}
