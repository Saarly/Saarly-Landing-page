"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { Notice, PortalPanel } from "@/components/merchant/portal-ui";
import { PortalAdCarousel } from "@/components/portal-v2/ad-carousel";
import { numberValue, statusLabel, text, type PortalRow } from "@/components/merchant/portal-utils";

type Props = {
  dashboard: PortalRow;
  ads: PortalRow[];
  locale: "ar" | "en";
  audience: "buyer" | "merchant";
  notify: (message: string, tone?: "success" | "error" | "info") => void;
};

function rewardStatus(value: unknown, locale: "ar" | "en") {
  const key = text(value).toLowerCase();
  const labels: Record<string, [string, string]> = {
    pending: ["قيد المراجعة", "Pending review"],
    approved: ["تم الاعتماد", "Approved"],
    delivered: ["تم التسليم", "Delivered"],
    rejected: ["مرفوضة", "Rejected"],
  };
  return (labels[key] ?? [statusLabel(value, "ar"), statusLabel(value, "en")])[locale === "ar" ? 0 : 1];
}

export function ReferralWorkspace({ dashboard, ads, locale, audience, notify }: Props) {
  const target = Math.max(1, numberValue(dashboard.target_confirmed_registrations, 10));
  const progressCount = Math.max(0, numberValue(dashboard.confirmed_registrations));
  const total = Math.max(progressCount, numberValue(dashboard.total_confirmed_registrations, progressCount));
  const qualified = numberValue(dashboard.qualified_rewards_count);
  const remaining = Math.max(0, numberValue(dashboard.next_target_remaining, Math.max(target - progressCount, 0)));
  const reward = text(
    locale === "ar" ? dashboard.reward_options_label_ar || dashboard.reward_label_ar : dashboard.reward_options_label_en || dashboard.reward_label_en,
    statusLabel(dashboard.reward_type, locale),
  );
  const url = text(dashboard.referral_url, `https://saarly.app/invite?code=${text(dashboard.referral_code)}`);
  const code = text(dashboard.referral_code);
  const [copied, setCopied] = useState(false);
  const isAvailable = dashboard.enabled === true || code.trim().length > 0 || text(dashboard.referral_url).trim().length > 0;

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    notify(locale === "ar" ? "تم نسخ رابط الدعوة." : "Referral link copied.", "success");
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function share() {
    const shareText = locale === "ar"
      ? `جرّب سعرلي عبر هذا الرابط: ${url}\nرمز الدعوة: ${code}`
      : `Try Saarly using this link: ${url}\nInvite code: ${code}`;
    if (navigator.share) {
      try { await navigator.share({ title: "Saarly", text: shareText, url }); return; } catch { /* user cancelled or browser refused */ }
    }
    await copy();
  }

  const title = audience === "merchant"
    ? (locale === "ar" ? "دعوات المتجر" : "Store referrals")
    : (locale === "ar" ? "دعوات ومكافآت سعرلي" : "Saarly referrals & rewards");
  const intro = audience === "merchant"
    ? (locale === "ar" ? `بعد الوصول للعدد المطلوب من الإحالات المقبولة تحصل على إحدى المكافآت المتاحة: ${reward}.` : `Reach the required accepted referrals to earn one of the available rewards: ${reward}.`)
    : (locale === "ar" ? "شارك سعرلي مع أصحابك واحصل على مكافآت خاصة بعد اكتمال العدد المطلوب من الإحالات المقبولة." : "Share Saarly with friends and earn special rewards after completing the required accepted referrals.");

  return <div className="portal-section-stack">
    {!isAvailable ? <Notice tone="info">{locale === "ar" ? "نظام الدعوات غير متاح لهذا الحساب حاليًا." : "Referrals are not available for this account right now."}</Notice> : null}
    {text(dashboard.banner_image_url) ? <div className="referral-program-banner"><img src={text(dashboard.banner_image_url)} alt={locale === "ar" ? "برنامج دعوات سعرلي" : "Saarly referral program"}/></div> : null}
    {ads.length ? <PortalAdCarousel ads={ads} locale={locale} fit={audience === "merchant" ? "contain" : "cover"} openLinks={audience === "merchant"}/> : null}

    <PortalPanel title={title} subtitle={intro}>
      <div className="referral-web-card">
        <div className="referral-share-block">
          <span className="referral-icon"><Icon name="users"/></span>
          <div><strong>{locale === "ar" ? "شارك رابطك الشخصي" : "Share your personal link"}</strong><small>{locale === "ar" ? `رمز الدعوة: ${code || "—"}` : `Invite code: ${code || "—"}`}</small></div>
          <div className="referral-link"><input aria-label={locale === "ar" ? "رابط الدعوة" : "Invite link"} readOnly value={url}/><button className="button primary compact" type="button" onClick={() => void share()}><Icon name="arrow" size={17}/>{locale === "ar" ? "مشاركة" : "Share"}</button><button className="button secondary compact" type="button" onClick={() => void copy()}><Icon name="receipt" size={17}/>{copied ? (locale === "ar" ? "تم النسخ" : "Copied") : (locale === "ar" ? "نسخ الرابط" : "Copy link")}</button></div>
        </div>

        <div className="referral-metrics-grid">
          <article><span>{locale === "ar" ? "إحالات مقبولة" : "Accepted referrals"}</span><strong>{total}</strong></article>
          <article><span>{locale === "ar" ? "المكافأة القادمة" : "Next reward"}</span><strong>{reward || "—"}</strong></article>
          <article><span>{locale === "ar" ? "مكافآت مستحقة" : "Qualified rewards"}</span><strong>{qualified}</strong></article>
        </div>

        <div className="referral-progress-block">
          <div><strong>{dashboard.achieved === true ? (locale === "ar" ? "اكتمل هدف المكافأة الحالية" : "Current reward target reached") : (locale === "ar" ? `مكافأتك القادمة: ${reward}` : `Your next reward: ${reward}`)}</strong><span>{progressCount} / {target}</span></div>
          <progress value={Math.min(progressCount, target)} max={target}/>
          <small>{locale === "ar" ? `${progressCount} من ${target} إحالة مقبولة نحو المكافأة القادمة · متبقي ${remaining}` : `${progressCount} of ${target} accepted referrals toward the next reward · ${remaining} remaining`}</small>
        </div>

        {dashboard.first_target_discount_applied === true && qualified === 0 ? <Notice tone="info">{locale === "ar" ? `لأنك سجلت من خلال دعوة، هدف المكافأة الأولى ${numberValue(dashboard.first_milestone_target_confirmed_registrations, target)} فقط بدلًا من ${numberValue(dashboard.standard_target_confirmed_registrations, target)}. بعد المكافأة الأولى يعود الهدف المعتاد.` : `Because you joined through an invite, your first reward needs only ${numberValue(dashboard.first_milestone_target_confirmed_registrations, target)} accepted referrals instead of ${numberValue(dashboard.standard_target_confirmed_registrations, target)}. The regular target applies after the first reward.`}</Notice> : null}
        {text(dashboard.reward_status) ? <Notice tone={text(dashboard.reward_status) === "rejected" ? "danger" : "info"}>{locale === "ar" ? `آخر مكافأة مستحقة: ${reward}. الحالة: ${rewardStatus(dashboard.reward_status, locale)}.` : `Latest qualified reward: ${reward}. Status: ${rewardStatus(dashboard.reward_status, locale)}.`}</Notice> : null}
      </div>
    </PortalPanel>
  </div>;
}
