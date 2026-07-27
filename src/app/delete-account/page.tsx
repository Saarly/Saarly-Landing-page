import type { Metadata } from "next";
import { SupportPage } from "@/components/public-site";

export const metadata: Metadata = {
  title: "حذف الحساب",
  description: "تعرف على آلية حذف حساب سعرلي وأرسل طلب الحذف من البريد المرتبط بالحساب.",
  alternates: { canonical: "/delete-account" },
};

export default function Page() { return <SupportPage deletion />; }
