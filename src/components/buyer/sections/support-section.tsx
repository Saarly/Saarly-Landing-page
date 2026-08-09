"use client";
import { buyerPost } from "@/components/buyer/portal-client";
import { SupportWorkspace } from "@/components/portal-v2/support-workspace";
import type { BuyerSectionProps } from "@/components/buyer/section-props";
export function BuyerSupportSection({payload,locale,notify}:BuyerSectionProps){return <SupportWorkspace data={payload.data} locale={locale} post={buyerPost} notify={notify}/>;}
