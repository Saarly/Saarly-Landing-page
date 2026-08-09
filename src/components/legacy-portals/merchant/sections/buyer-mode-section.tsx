"use client";

import { BuyerStoresSection } from "@/components/buyer/sections/stores-section";
import type { SectionProps } from "@/components/merchant/section-props";

export function BuyerModeSection(props: SectionProps) {
  return <BuyerStoresSection {...props} />;
}
