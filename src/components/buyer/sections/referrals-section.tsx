"use client";
import { useState } from "react";
import { PortalPanel, Notice } from "@/components/merchant/portal-ui";
import { numberValue, row, rows, safeExternalUrl, statusLabel, text } from "@/components/merchant/portal-utils";
import type { BuyerSectionProps } from "@/components/buyer/section-props";

export function BuyerReferralsSection({ payload, locale, notify }: BuyerSectionProps) {
  const dashboard = row(payload.data.dashboard);
  const ads = rows(payload.data.ads);
  const target = Math.max(1, numberValue(dashboard.target_confirmed_registrations, 10));
  const done = numberValue(dashboard.confirmed_registrations);
  const url = text(dashboard.referral_url, `https://saarly.app/invite?code=${text(dashboard.referral_code)}`);
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    notify(locale === "ar" ? "تم نسخ رابط الدعوة." : "Referral link copied.", "success");
    window.setTimeout(() => setCopied(false), 1500);
  }
  return <div className="portal-section-stack">
    {dashboard.enabled === false ? <Notice tone="info">{locale === "ar" ? "نظام الدعوات غير مفعّل حاليًا." : "Referrals are currently disabled."}</Notice> : null}
    {ads.map((ad) => {
      const targetUrl = safeExternalUrl(ad.target_url);
      const image = <img src={text(ad.image_url)} alt={text(locale === "ar" ? ad.title_ar : ad.title_en)}/>;
      return targetUrl ? <a className="portal-ad" key={text(ad.id)} href={targetUrl} target="_blank" rel="noopener noreferrer">{image}</a> : <div className="portal-ad" key={text(ad.id)}>{image}</div>;
    })}
    <PortalPanel title={locale === "ar" ? "ادعُ أصحابك" : "Invite friends"} subtitle={locale === "ar" ? "شارك الرابط مع أصحابك، وكل تسجيل مؤكد يتحسب تلقائيًا." : "Share your link; every confirmed registration is counted automatically."}>
      <div className="referral-hero"><div><span>{locale === "ar" ? "التسجيلات المؤكدة" : "Confirmed registrations"}</span><strong>{done} / {target}</strong><progress value={Math.min(done, target)} max={target}/><small>{locale === "ar" ? `المكافأة: ${text(dashboard.reward_options_label_ar, statusLabel(dashboard.reward_type, locale))}` : `Reward: ${text(dashboard.reward_options_label_en, statusLabel(dashboard.reward_type, locale))}`}</small></div><div className="referral-link"><input readOnly value={url}/><button className="button primary" onClick={() => void copy()}>{copied ? (locale === "ar" ? "تم النسخ" : "Copied") : (locale === "ar" ? "نسخ الرابط" : "Copy link")}</button></div></div>
    </PortalPanel>
  </div>;
}
