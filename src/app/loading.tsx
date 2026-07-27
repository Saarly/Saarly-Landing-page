import { Brand } from "@/components/brand";

export default function Loading() {
  return (
    <main className="portal-state">
      <Brand locale="ar" />
      <section className="portal-state-card">
        <span className="spinner" />
        <h1>جارٍ تحميل سعرلي</h1>
        <p>لحظات ونجهز الصفحة.</p>
      </section>
    </main>
  );
}
