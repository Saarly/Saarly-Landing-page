import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth-forms";

export const metadata: Metadata = {
  title: "الدخول بدون كلمة مرور",
  description: "سجّل الدخول إلى بوابة المتاجر باستخدام رمز مؤقت يصل إلى بريدك.",
  alternates: { canonical: "/forgot-password" },
  robots: { index: false, follow: false },
};

export default function Page() { return <ForgotPasswordForm />; }
