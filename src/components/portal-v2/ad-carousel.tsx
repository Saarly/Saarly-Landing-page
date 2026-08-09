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
  const [pausedByUser, setPausedByUser] = useState(false);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    setIndex(0);
  }, [ads.length]);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);

  useEffect(() => {
    if (ads.length <= 1 || pausedByUser || interactionPaused || reduceMotion) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setIndex((current) => (current + 1) % ads.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [ads.length, interactionPaused, pausedByUser, reduceMotion]);

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
    <section className={`portal-ad-carousel ${className}`.trim()} aria-label={locale === "ar" ? "إعلانات سعرلي" : "Saarly ads"} onMouseEnter={() => setInteractionPaused(true)} onMouseLeave={() => setInteractionPaused(false)} onFocusCapture={() => setInteractionPaused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInteractionPaused(false); }}>
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
          <button className="portal-ad-carousel-pause" type="button" aria-pressed={pausedByUser || reduceMotion} onClick={() => setPausedByUser((value) => !value)} aria-label={pausedByUser ? (locale === "ar" ? "تشغيل تغيير الإعلانات" : "Resume ad rotation") : (locale === "ar" ? "إيقاف تغيير الإعلانات" : "Pause ad rotation")} title={pausedByUser ? (locale === "ar" ? "تشغيل تلقائي" : "Resume autoplay") : (locale === "ar" ? "إيقاف مؤقت" : "Pause autoplay")}>
            <Icon name={pausedByUser || reduceMotion ? "arrow" : "stop"} size={16}/>
          </button>
        </>
      ) : null}
    </section>
  );
}
