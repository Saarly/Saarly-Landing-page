import type { Metadata } from "next";
import { PolicyPage } from "@/components/public-site";

export const metadata: Metadata = {
  title: "سياسة الخصوصية",
  description: "تعرف على البيانات التي يعالجها سعرلي وكيفية حمايتها واستخدامها.",
  alternates: { canonical: "/privacy" },
  
};

export default function Page() { return <PolicyPage kind="privacy" />; }
