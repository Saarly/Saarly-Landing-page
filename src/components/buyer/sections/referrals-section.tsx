"use client";
import { ReferralWorkspace } from "@/components/portal-v2/referral-workspace";
import { row, rows } from "@/components/merchant/portal-utils";
import type { BuyerSectionProps } from "@/components/buyer/section-props";

export function BuyerReferralsSection({ payload, locale, notify }: BuyerSectionProps) {
  return <ReferralWorkspace dashboard={row(payload.data.dashboard)} ads={rows(payload.data.ads)} locale={locale} audience="buyer" notify={notify}/>;
}
