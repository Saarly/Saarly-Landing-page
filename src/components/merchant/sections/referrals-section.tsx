"use client";
import { ReferralWorkspace } from "@/components/portal-v2/referral-workspace";
import { row, rows } from "@/components/merchant/portal-utils";
import type { SectionProps } from "@/components/merchant/section-props";

export function ReferralsSection({ payload, locale, notify }: SectionProps) {
  return <ReferralWorkspace dashboard={row(payload.data.dashboard)} ads={rows(payload.data.ads)} locale={locale} audience="merchant" notify={notify}/>;
}
