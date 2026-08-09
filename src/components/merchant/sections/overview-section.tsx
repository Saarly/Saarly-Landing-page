import Link from "next/link";
import { Icon } from "@/components/icons";
import { EmptyState, MetricCard, Notice, PortalPanel, StatusBadge } from "@/components/merchant/portal-ui";
import { dateLabel, money, numberValue, row, rows, statusLabel, text, type PortalPayload, type PortalRow } from "@/components/merchant/portal-utils";

function growthName(item: PortalRow, locale: "ar" | "en") {
  return text(locale === "ar" ? item.name_ar : item.name_en, text(item.name || item.free_name, locale === "ar" ? "عنصر" : "Item"));
}

function GrowthSection({ title, items, currency, locale, moneyValue = true, empty }: { title: string; items: PortalRow[]; currency: string; locale: "ar" | "en"; moneyValue?: boolean; empty: string }) {
  return <PortalPanel title={title}>
    {items.length ? <div className="detail-list compact">{items.slice(0, 5).map((item, index) => {
      const quantity = item.sold_quantity ?? item.quantity;
      const value = moneyValue && item.sales_total != null
        ? money(item.sales_total, currency, locale)
        : quantity != null
          ? `${numberValue(quantity)}${text(item.unit) ? ` ${text(item.unit)}` : ""}`
          : item.orders_count != null ? String(numberValue(item.orders_count)) : "—";
      return <div key={`${growthName(item, locale)}-${index}`}><span>{growthName(item, locale)}</span><strong>{value}</strong></div>;
    })}</div> : <EmptyState icon="compare" title={empty} body={locale === "ar" ? "سيظهر المحتوى تلقائيًا عند توفر بيانات كافية." : "Content appears automatically when enough data is available."}/>} 
  </PortalPanel>;
}

export function OverviewSection({ payload, locale }: { payload: PortalPayload; locale: "ar" | "en" }) {
  const data = row(payload.data);
  const counts = row(data.counts);
  const status = row(data.status);
  const report = row(data.report);
  const growth = row(data.growth);
  const notifications = rows(data.recentNotifications);
  const approval = text(payload.account.merchant.approval_status, "pending");
  const access = text(status.access_status, approval === "approved" ? "pre_launch_access" : approval);
  const canReceive = Boolean(status.can_receive_orders ?? status.can_receive_new_work);
  const stopReason = text(status.stop_reason || payload.account.merchant.rejection_reason);
  const currency = text(data.currencyCode, payload.account.currencyCode || "EGP");
  const averageRating = numberValue(report.average_rating);

  return (
    <div className="portal-section-stack">
      {approval !== "approved" ? (
        <Notice tone={approval === "rejected" ? "danger" : "warning"} title={locale === "ar" ? "حالة اعتماد المتجر" : "Store approval status"}>
          {approval === "rejected"
            ? (locale === "ar" ? `تم رفض المتجر${stopReason ? `: ${stopReason}` : ". يمكنك مراجعة البيانات والتواصل مع الدعم."}` : `The store was rejected${stopReason ? `: ${stopReason}` : ". Review the details and contact support."}`)
            : (locale === "ar" ? "المتجر ما زال قيد المراجعة. يمكنك مراجعة بياناته، لكن استقبال الطلبات يبدأ بعد الاعتماد." : "The store is still under review. You can review its data, but requests start after approval.")}
        </Notice>
      ) : null}
      {access === "grace_period" || access === "suspended" || status.is_blocked_from_new_work === true ? (
        <Notice tone={access === "suspended" || status.is_blocked_from_new_work === true ? "danger" : "warning"} title={access === "grace_period" ? (locale === "ar" ? "فترة السماح" : "Grace period") : (locale === "ar" ? "استقبال الطلبات متوقف" : "New requests paused")}>
          {locale === "ar" ? (stopReason || "يمكنك متابعة حالة الحساب وتاريخ انتهاء فترة السماح من صفحة حالة الحساب.") : (stopReason || "Review the account status and grace-period dates from the Account Status page.")}
        </Notice>
      ) : null}

      {Boolean(payload.account.merchant.founder_badge_enabled) || Boolean(payload.account.merchant.trusted_badge_enabled) ? (
        <div className="merchant-badge-strip">
          {Boolean(payload.account.merchant.founder_badge_enabled) ? <span className="merchant-badge-pill founder"><Icon name="store" size={16}/>{locale === "ar" ? "متجر مؤسس" : "Founding store"}</span> : null}
          {Boolean(payload.account.merchant.trusted_badge_enabled) ? <span className="merchant-badge-pill trusted"><Icon name="shield" size={16}/>{locale === "ar" ? "متجر موثوق" : "Trusted store"}</span> : null}
        </div>
      ) : null}

      <div className="metrics-grid merchant-dashboard-metrics">
        <MetricCard icon="box" label={locale === "ar" ? "المنتجات" : "Products"} value={numberValue(counts.products)} note={locale === "ar" ? "المنتجات الفعالة" : "Active catalog products"}/>
        <MetricCard icon="quote" label={locale === "ar" ? "الطلبات الجديدة" : "New requests"} value={numberValue(counts.requests)} tone="blue" note={locale === "ar" ? "طلبات تسعير مفتوحة" : "Open quote requests"}/>
        <MetricCard icon="check" label={locale === "ar" ? "التقييم" : "Rating"} value={averageRating ? averageRating.toFixed(1) : "0"} tone="gold"/>
        <MetricCard icon="money" label={locale === "ar" ? "إجمالي المبيعات" : "Total sales"} value={money(report.total_sales, currency, locale)} tone="green"/>
        <MetricCard icon="receipt" label={locale === "ar" ? "الطلبات المؤكدة" : "Confirmed orders"} value={numberValue(report.confirmed_orders_count)} tone="blue"/>
        <MetricCard icon="check" label={locale === "ar" ? "عدد التقييمات" : "Reviews"} value={numberValue(report.reviews_count)} tone="gray"/>
      </div>

      <div className="portal-two-columns">
        <GrowthSection title={locale === "ar" ? "المنتجات الأكثر مبيعًا" : "Top selling products"} items={rows(growth.top_products)} currency={currency} locale={locale} empty={locale === "ar" ? "لا توجد مبيعات كافية حتى الآن" : "No sales data yet"}/>
        <GrowthSection title={locale === "ar" ? "الفئات الأكثر طلبًا" : "Strong categories"} items={rows(growth.category_sales)} currency={currency} locale={locale} empty={locale === "ar" ? "لا توجد بيانات أقسام بعد" : "No category data yet"}/>
        <GrowthSection title={locale === "ar" ? "منتجات منخفضة المخزون" : "Low stock products"} items={rows(growth.low_stock)} currency={currency} locale={locale} moneyValue={false} empty={locale === "ar" ? "المخزون متوفر حاليًا" : "Stock looks fine right now"}/>
        <GrowthSection title={locale === "ar" ? "منتجات تحتاج إلى تحديث السعر" : "Prices to review"} items={rows(growth.stale_products)} currency={currency} locale={locale} moneyValue={false} empty={locale === "ar" ? "تم تحديث جميع الأسعار مؤخرًا" : "All prices were updated recently"}/>
      </div>

      <div className="portal-two-columns">
        <PortalPanel title={locale === "ar" ? "حالة المتجر والحساب" : "Store and account status"} subtitle={locale === "ar" ? "الحالة نفسها التي يعتمد عليها التطبيق في إتاحة استقبال العمل." : "The same access state used by the app to allow new work."}>
          <div className="detail-list">
            <div><span>{locale === "ar" ? "اعتماد المتجر" : "Store approval"}</span><StatusBadge value={approval} locale={locale}/></div>
            <div><span>{locale === "ar" ? "حالة الوصول" : "Access status"}</span><StatusBadge value={access} locale={locale}/></div>
            <div><span>{locale === "ar" ? "طريقة تشغيل المتجر" : "Store mode"}</span><strong>{statusLabel(status.pricing_mode || payload.account.merchant.pricing_mode, locale)}</strong></div>
            <div><span>{locale === "ar" ? "استقبال طلبات جديدة" : "Receiving new work"}</span><strong>{canReceive ? (locale === "ar" ? "متاح" : "Available") : (locale === "ar" ? "متوقف" : "Paused")}</strong></div>
            <div><span>{locale === "ar" ? "نهاية الحالة الحالية" : "Current access end"}</span><strong>{dateLabel(status.access_ends_at || status.subscription_ends_at || status.free_trial_ends_at || status.grace_period_ends_at, locale)}</strong></div>
          </div>
          <div className="panel-footer-actions"><Link className="button secondary compact" href="/merchant/account-status">{locale === "ar" ? "فتح حالة الحساب" : "Open account status"}<Icon name="arrow" size={18}/></Link></div>
        </PortalPanel>

        <PortalPanel title={locale === "ar" ? "آخر الإشعارات" : "Latest notifications"} action={<Link href="/merchant/notifications">{locale === "ar" ? "عرض الكل" : "View all"}</Link>}>
          {notifications.length === 0 ? <EmptyState icon="bell" title={locale === "ar" ? "لا توجد إشعارات جديدة" : "No new notifications"} body={locale === "ar" ? "ستظهر هنا تحديثات الطلبات والحساب." : "Order and account updates will appear here."}/> : (
            <div className="notification-mini-list">{notifications.map((item) => <article key={text(item.id)} className={item.is_read ? "" : "unread"}><span><Icon name="bell" size={18}/></span><div><strong>{text(locale === "ar" ? item.title_ar : item.title_en, text(item.type))}</strong><p>{text(locale === "ar" ? item.body_ar : item.body_en)}</p><small>{dateLabel(item.created_at, locale)}</small></div></article>)}</div>
          )}
        </PortalPanel>
      </div>
    </div>
  );
}
