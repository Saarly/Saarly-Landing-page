import type { Metadata } from "next";
import { MerchantRegistrationForm } from "@/components/merchant-registration-form";

export const metadata: Metadata = {
  title: "تسجيل متجر جديد",
  description: "أنشئ حساب متجر سعرلي وأرسل بيانات المتجر والفروع والمستندات للمراجعة.",
  robots: { index: false, follow: false },
};

export default function Page() { return <MerchantRegistrationForm />; }
