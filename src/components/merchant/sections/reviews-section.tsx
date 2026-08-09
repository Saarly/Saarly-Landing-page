"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { EmptyState, MetricCard, PortalPanel } from "@/components/merchant/portal-ui";
import { dateLabel, numberValue, rows, text } from "@/components/merchant/portal-utils";
import type { SectionProps } from "@/components/merchant/section-props";

export function ReviewsSection({ payload, locale }: SectionProps) {
  const reviews = rows(payload.data.reviews);
  const [filter, setFilter] = useState<"all" | "5" | "4" | "3" | "low">("all");
  const average = reviews.length ? reviews.reduce((sum, review) => sum + numberValue(review.stars), 0) / reviews.length : 0;
  const positive = reviews.filter((review) => numberValue(review.stars) >= 4).length;
  const comments = reviews.filter((review) => text(review.comment)).length;
  const counts = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: reviews.filter((review) => Math.round(numberValue(review.stars)) === stars).length }));
  const visible = useMemo(() => reviews.filter((review) => {
    const stars = Math.round(numberValue(review.stars));
    if (filter === "all") return true;
    if (filter === "low") return stars <= 2;
    return stars === Number(filter);
  }), [reviews, filter]);

  return <div className="portal-section-stack">
    <div className="metrics-grid">
      <MetricCard icon="check" label={locale === "ar" ? "متوسط التقييم" : "Average rating"} value={reviews.length ? average.toFixed(1) : "—"} note={locale === "ar" ? `من ${reviews.length} تقييم` : `from ${reviews.length} reviews`}/>
      <MetricCard icon="users" label={locale === "ar" ? "تقييمات 4 و5 نجوم" : "4–5 star reviews"} value={positive} tone="green"/>
      <MetricCard icon="quote" label={locale === "ar" ? "تقييمات بتعليق" : "Reviews with comments"} value={comments} tone="blue"/>
      <MetricCard icon="history" label={locale === "ar" ? "إجمالي التقييمات" : "Total reviews"} value={reviews.length} tone="gray"/>
    </div>

    <div className="portal-two-columns review-summary-layout">
      <PortalPanel title={locale === "ar" ? "توزيع التقييمات" : "Rating distribution"} subtitle={locale === "ar" ? "النسب محسوبة من التقييمات الفعلية المرتبطة بالطلبات." : "Distribution is calculated from real order-linked reviews."}>
        <div className="rating-distribution">
          <div className="rating-score"><strong>{reviews.length ? average.toFixed(1) : "—"}</strong><span>{"★".repeat(Math.max(0, Math.min(5, Math.round(average))))}</span><small>{locale === "ar" ? `${reviews.length} تقييم` : `${reviews.length} reviews`}</small></div>
          <div className="rating-bars">{counts.map((item) => <div key={item.stars}><span>{item.stars} ★</span><progress max={Math.max(1, reviews.length)} value={item.count}/><strong>{item.count}</strong></div>)}</div>
        </div>
      </PortalPanel>
      <PortalPanel title={locale === "ar" ? "فلترة سريعة" : "Quick filters"} subtitle={locale === "ar" ? "اختار مستوى التقييم اللي عاوز تراجعه." : "Choose the rating level you want to review."}>
        <div className="review-filter-grid">
          {([
            ["all", locale === "ar" ? "كل التقييمات" : "All reviews", reviews.length],
            ["5", locale === "ar" ? "5 نجوم" : "5 stars", counts[0].count],
            ["4", locale === "ar" ? "4 نجوم" : "4 stars", counts[1].count],
            ["3", locale === "ar" ? "3 نجوم" : "3 stars", counts[2].count],
            ["low", locale === "ar" ? "نجمتين أو أقل" : "2 stars or less", counts[3].count + counts[4].count],
          ] as const).map(([key, label, count]) => <button type="button" className={filter === key ? "active" : ""} key={key} onClick={() => setFilter(key)}><span>{label}</span><strong>{count}</strong></button>)}
        </div>
      </PortalPanel>
    </div>

    <PortalPanel title={locale === "ar" ? `تقييمات العملاء (${visible.length})` : `Buyer reviews (${visible.length})`} subtitle={locale === "ar" ? "كل تقييم مرتبط بطلب حقيقي مكتمل. لا يتم إنشاء تقييمات وهمية داخل البوابة." : "Every review is tied to a real completed order. No synthetic reviews are generated in the portal."}>
      {visible.length ? <div className="review-grid expanded">{visible.map((review) => {
        const stars = Math.max(1, Math.min(5, Math.round(numberValue(review.stars))));
        return <article className="review-card premium" key={text(review.id)} data-record-id={text(review.id)}>
          <header><div className="review-stars"><strong>{numberValue(review.stars).toFixed(1)}</strong><span>{"★".repeat(stars)}{"☆".repeat(5 - stars)}</span></div><span className="review-verified"><Icon name="check" size={14}/>{locale === "ar" ? "طلب مؤكد" : "Verified order"}</span></header>
          <p>{text(review.comment, locale === "ar" ? "لم يكتب العميل تعليقًا نصيًا." : "The buyer did not leave a written comment.")}</p>
          <footer><small>{dateLabel(review.created_at, locale)}</small>{text(review.order_id) ? <small>{locale === "ar" ? `طلب #${text(review.order_id).slice(0, 8)}` : `Order #${text(review.order_id).slice(0, 8)}`}</small> : null}</footer>
        </article>;
      })}</div> : <EmptyState icon="check" title={locale === "ar" ? "لا توجد تقييمات في الفلتر ده" : "No reviews in this filter"} body={locale === "ar" ? "هتظهر التقييمات هنا بعد اكتمال الطلبات وإضافة تقييم من المشتري." : "Reviews appear after completed orders receive buyer feedback."}/>} 
    </PortalPanel>
  </div>;
}
