import type { Metadata } from "next";
import { SupportPage } from "@/components/public-site";

export const metadata: Metadata = {
  title: "الدعم والمساعدة",
  description: "أرسل طلب دعم إلى فريق سعرلي وتابع المشكلة من حسابك.",
  alternates: { canonical: "/support" },
  
};

export default function Page() { return <SupportPage />; }
