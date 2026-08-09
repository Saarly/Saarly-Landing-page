"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { EmptyState, MetricCard, PortalPanel } from "@/components/merchant/portal-ui";
import { dateLabel, money, numberValue, row, rows, text } from "@/components/merchant/portal-utils";
import type { SectionProps } from "@/components/merchant/section-props";

export function ReportsSection({ payload, locale }: SectionProps) {
  const data = payload.data;
  const summary = row(data.summary);
  const growth = row(data.growth);
  const branches = rows(data.branches);
  const reviews = rows(data.reviews);
  const currency = text(data.currencyCode, payload.account.currencyCode || "EGP");
  const [reviewFilter, setReviewFilter] = useState("all");
  const maxBranchSales = Math.max(1, ...branches.map((branch) => numberValue(branch.total_sales)));
  const visibleReviews = useMemo(() => reviewFilter === "all" ? reviews : reviews.filter((review) => Math.round(numberValue(review.stars)) === Number(reviewFilter)), [reviews, reviewFilter]);
  const avgRating = numberValue(summary.average_rating, reviews.length ? reviews.reduce((sum, review) => sum + numberValue(review.stars), 0) / reviews.length : 0);

  return <div className="portal-section-stack">
    <div className="metrics-grid">
      <MetricCard icon="money" label={locale === "ar" ? "إجمالي المبيعات" : "Total sales"} value={money(summary.total_sales, currency, locale)} note={locale === "ar" ? "من الطلبات المؤكدة" : "From confirmed orders"}/>
      <MetricCard icon="receipt" label={locale === "ar" ? "الطلبات المؤكدة" : "Confirmed orders"} value={numberValue(summary.confirmed_orders_count)} tone="blue"/>
      <MetricCard icon="check" label={locale === "ar" ? "متوسط التقييم" : "Average rating"} value={avgRating ? avgRating.toFixed(1) : "—"} tone="gold" note={locale === "ar" ? `${numberValue(summary.reviews_count, reviews.length)} تقييم` : `${numberValue(summary.reviews_count, reviews.length)} reviews`}/>
      <MetricCard icon="card" label={locale === "ar" ? "الرصيد المستحق" : "Balance due"} value={money(summary.balance_due, currency, locale)} tone={numberValue(summary.balance_due) > 0 ? "gold" : "green"}/>
    </div>

    <div className="portal-two-columns reports-hero-grid">
      <PortalPanel title={locale === "ar" ? "ملخص الأداء" : "Performance summary"} subtitle={locale === "ar" ? "نفس مؤشرات التقارير المحسوبة من بيانات المتجر الحقيقية." : "The same report indicators calculated from real store data."}>
        <div className="report-highlight-grid">
          <article><span><Icon name="money" size={18}/></span><div><small>{locale === "ar" ? "مبيعات الفترة" : "Period sales"}</small><strong>{money(growth.total_sales || summary.total_sales, currency, locale)}</strong></div></article>
          <article><span><Icon name="receipt" size={18}/></span><div><small>{locale === "ar" ? "الطلبات في الفترة" : "Period orders"}</small><strong>{numberValue(growth.confirmed_orders_count || summary.confirmed_orders_count)}</strong></div></article>
          <article><span><Icon name="clock" size={18}/></span><div><small>{locale === "ar" ? "نهاية الفترة الحالية" : "Current period end"}</small><strong>{dateLabel(summary.current_period_end || growth.period_end, locale)}</strong></div></article>
          <article><span><Icon name="shield" size={18}/></span><div><small>{locale === "ar" ? "الخطة الحالية" : "Current plan"}</small><strong>{text(locale === "ar" ? summary.plan_name_ar : summary.plan_name_en, locale === "ar" ? "غير محددة" : "Not set")}</strong></div></article>
        </div>
      </PortalPanel>
      <PortalPanel title={locale === "ar" ? "مؤشر رضا العملاء" : "Buyer satisfaction"} subtitle={locale === "ar" ? "يعتمد على تقييمات الطلبات الفعلية." : "Based on verified order reviews."}>
        <div className="report-rating-hero"><strong>{avgRating ? avgRating.toFixed(1) : "—"}</strong><span>{"★".repeat(Math.max(0, Math.min(5, Math.round(avgRating))))}</span><p>{locale === "ar" ? `${reviews.length} تقييم مرتبط بطلبات المتجر` : `${reviews.length} reviews linked to store orders`}</p></div>
      </PortalPanel>
    </div>

    <PortalPanel title={locale === "ar" ? "أداء الفروع" : "Branch performance"} subtitle={locale === "ar" ? "قارن المبيعات والطلبات بين الفروع التي يحق للحساب الوصول إليها." : "Compare sales and confirmed orders across branches available to this account."}>
      {branches.length ? <div className="branch-performance-list">{branches.map((branch) => {
        const sales = numberValue(branch.total_sales);
        const pct = Math.max(3, Math.min(100, sales / maxBranchSales * 100));
        return <article key={text(branch.branch_id || branch.id)} data-record-id={text(branch.branch_id || branch.id)}>
          <header><div><strong>{text(branch.branch_name || branch.name, locale === "ar" ? "فرع" : "Branch")}</strong><small>{locale === "ar" ? `${numberValue(branch.confirmed_orders_count)} طلب مؤكد` : `${numberValue(branch.confirmed_orders_count)} confirmed orders`}</small></div><strong>{money(sales, currency, locale)}</strong></header>
          <div className="branch-sales-track"><span style={{ width: `${pct}%` }}/></div>
          <footer><span>{locale === "ar" ? "متوسط التقييم" : "Average rating"}: {numberValue(branch.average_rating).toFixed(1)}</span>{branch.scoped_to_assigned_branches ? <span><Icon name="shield" size={13}/>{locale === "ar" ? "حسب صلاحيات الموظف" : "Scoped by staff access"}</span> : null}</footer>
        </article>;
      })}</div> : <EmptyState icon="branch" title={locale === "ar" ? "لا توجد بيانات فروع" : "No branch data"} body={locale === "ar" ? "ستظهر مقارنة الفروع بعد وجود طلبات مؤكدة مرتبطة بها." : "Branch comparisons appear after confirmed orders are linked to branches."}/>} 
    </PortalPanel>

    <PortalPanel title={locale === "ar" ? "آخر تقييمات العملاء" : "Latest buyer reviews"} subtitle={locale === "ar" ? "راجع التعليقات والتقييمات المرتبطة بالطلبات الحقيقية." : "Review comments and ratings linked to real orders."} action={<div className="report-filter-row">{["all","5","4","3","2","1"].map((value) => <button type="button" className={reviewFilter === value ? "active" : ""} key={value} onClick={() => setReviewFilter(value)}>{value === "all" ? (locale === "ar" ? "الكل" : "All") : `${value}★`}</button>)}</div>}>
      {visibleReviews.length ? <div className="report-review-list">{visibleReviews.slice(0, 20).map((review) => <article key={text(review.id)}><span className="review-score">{numberValue(review.stars).toFixed(1)} ★</span><div><p>{text(review.comment, locale === "ar" ? "بدون تعليق مكتوب" : "No written comment")}</p><small>{dateLabel(review.created_at, locale)}</small></div></article>)}</div> : <EmptyState icon="check" title={locale === "ar" ? "لا توجد تقييمات مطابقة" : "No matching reviews"} body={locale === "ar" ? "غيّر الفلتر أو انتظر تقييمات جديدة من العملاء." : "Change the filter or wait for new buyer reviews."}/>} 
    </PortalPanel>
  </div>;
}
