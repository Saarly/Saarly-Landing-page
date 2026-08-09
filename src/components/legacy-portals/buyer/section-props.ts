import type { PortalPayload } from "@/components/merchant/portal-utils";

export type BuyerSectionProps = {
  payload: PortalPayload;
  locale: "ar" | "en";
  refresh: () => Promise<void>;
  notify: (message: string, tone?: "success" | "error" | "info") => void;
};
