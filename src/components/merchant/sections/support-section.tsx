"use client";
import { portalPost } from "@/components/merchant/portal-client";
import { SupportWorkspace } from "@/components/portal-v2/support-workspace";
import type { SectionProps } from "@/components/merchant/section-props";
export function SupportSection({payload,locale,notify}:SectionProps){return <SupportWorkspace data={payload.data} locale={locale} post={portalPost} notify={notify}/>;}
