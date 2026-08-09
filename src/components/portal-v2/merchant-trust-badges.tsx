"use client";

import { Icon } from "@/components/icons";

export function MerchantTrustBadges({
  founderEnabled,
  trustedEnabled,
  founderNumber,
  locale,
  compact = false,
}: {
  founderEnabled?: boolean;
  trustedEnabled?: boolean;
  founderNumber?: unknown;
  locale: "ar" | "en";
  compact?: boolean;
}) {
  if (!founderEnabled && !trustedEnabled) return null;
  const number = Number(founderNumber);
  const hasNumber = Number.isFinite(number) && number > 0;
  return <span className={`merchant-trust-badges ${compact ? "compact" : ""}`}>
    {founderEnabled ? <span className="merchant-trust-badge founder" title={locale === "ar" ? "متجر مؤسس" : "Founding store"}><Icon name="star" size={compact ? 13 : 15}/><span>{locale === "ar" ? "متجر مؤسس" : "Founding store"}{hasNumber ? ` #${Math.trunc(number)}` : ""}</span></span> : null}
    {trustedEnabled ? <span className="merchant-trust-badge trusted" title={locale === "ar" ? "متجر موثوق" : "Trusted store"}><Icon name="shield" size={compact ? 13 : 15}/><span>{locale === "ar" ? "متجر موثوق" : "Trusted store"}</span></span> : null}
  </span>;
}
