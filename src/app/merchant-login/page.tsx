import type { Metadata } from "next";
import { MerchantLoginForm } from "@/components/auth-forms";

export const metadata: Metadata = {
  title: "دخول المتاجر",
  description: "تسجيل الدخول إلى بوابة متجر سعرلي بنفس حساب التطبيق.",
  alternates: { canonical: "/merchant-login" },
  robots: { index: false, follow: false },
};

export default function Page() { return <MerchantLoginForm />; }
