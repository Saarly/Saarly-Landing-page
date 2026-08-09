import type { Metadata } from "next";
import { InvitePage } from "@/components/invite-page";

export const metadata: Metadata = {
  title: "دعوة سعرلي",
  description: "افتح تطبيق سعرلي أو سجّل متجرًا جديدًا من رابط دعوة محفوظ.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <InvitePage />;
}
