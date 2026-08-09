"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { safeExternalUrl, text, type PortalRow } from "@/components/merchant/portal-utils";

type Props = {
  ads: PortalRow[];
  locale: "ar" | "en";
  fit?: "cover" | "contain";
  openLinks?: boolean;
  className?: string;
};

export function PortalAdCarousel({ ads, locale, fit = "cover", openLinks = true, className = "" }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [ads.length]);

  useEffect(() => {
    if (ads.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % ads.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [ads.length]);

  if (!ads.length) return null;

  const safeIndex = Math.min(index, Math.max(ads.length - 1, 0));
  const ad = ads[safeIndex];
  const href = openLinks ? safeExternalUrl(ad.target_url) : "";
  const image = (
    <img
      src={text(ad.image_url)}
      alt={locale === "ar" ? "إعلان سعرلي" : "Saarly ad"}
      style={{ objectFit: fit }}
    />
  );

  const content = href ? (
    <a className="portal-ad-carousel-media" href={href} target="_blank" rel="noopener noreferrer">
      {image}
    </a>
  ) : (
    <div className="portal-ad-carousel-media">{image}</div>
  );

  return (
    <section className={`portal-ad-carousel ${className}`.trim()} aria-label={locale === "ar" ? "إعلانات سعرلي" : "Saarly ads"}>
      {content}
      {ads.length > 1 ? (
        <>
          <button className="portal-ad-carousel-arrow previous" type="button" onClick={() => setIndex((current) => (current - 1 + ads.length) % ads.length)} aria-label={locale === "ar" ? "الإعلان السابق" : "Previous ad"}>
            <Icon name="chevron" size={18}/>
          </button>
          <button className="portal-ad-carousel-arrow next" type="button" onClick={() => setIndex((current) => (current + 1) % ads.length)} aria-label={locale === "ar" ? "الإعلان التالي" : "Next ad"}>
            <Icon name="chevron" size={18}/>
          </button>
          <div className="portal-ad-carousel-dots">
            {ads.map((item, dotIndex) => <button type="button" className={dotIndex === safeIndex ? "active" : ""} aria-label={locale === "ar" ? `عرض الإعلان ${dotIndex + 1}` : `Show ad ${dotIndex + 1}`} aria-current={dotIndex === safeIndex ? "true" : undefined} onClick={() => setIndex(dotIndex)} key={text(item.id, String(dotIndex))}/>) }
          </div>
        </>
      ) : null}
    </section>
  );
}
