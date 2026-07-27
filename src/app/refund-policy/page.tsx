import type { Metadata } from "next";
import { PolicyPage } from "@/components/public-site";

export const metadata: Metadata = {
  title: "سياسة الاسترداد",
  description: "سياسة مراجعة استرداد اشتراكات المتاجر والخلافات المتعلقة بالمنتجات.",
  alternates: { canonical: "/refund-policy" },
  
};

export default function Page() { return <PolicyPage kind="refund" />; }
