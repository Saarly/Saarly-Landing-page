"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { Icon } from "@/components/icons";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="portal-state">
      <Brand locale="ar" />
      <section className="portal-state-card">
        <span className="page-icon"><Icon name="info" /></span>
        <h1>تعذر تحميل الصفحة</h1>
        <p>حدث خطأ غير متوقع. جرّب إعادة التحميل، وإذا استمر الخطأ ارجع للصفحة الرئيسية.</p>
        <div className="state-actions">
          <button className="button primary" type="button" onClick={reset}>إعادة المحاولة</button>
          <Link className="button secondary" href="/">الصفحة الرئيسية</Link>
        </div>
      </section>
    </main>
  );
}
