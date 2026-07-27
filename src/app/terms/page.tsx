import type { Metadata } from "next";
import { PolicyPage } from "@/components/public-site";

export const metadata: Metadata = {
  title: "شروط الاستخدام",
  description: "شروط استخدام تطبيق سعرلي وبوابة المتاجر ومسؤوليات المشتري والمتجر.",
  alternates: { canonical: "/terms" },
  
};

export default function Page() { return <PolicyPage kind="terms" />; }
