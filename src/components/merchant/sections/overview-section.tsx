import Link from "next/link";
import { Icon } from "@/components/icons";
import { EmptyState, MetricCard, Notice, PortalPanel, StatusBadge } from "@/components/merchant/portal-ui";
import { dateLabel, numberValue, row, rows, statusLabel, text, type PortalPayload } from "@/components/merchant/portal-utils";

export function OverviewSection({ payload, locale }: { payload: PortalPayload; locale: "ar" | "en" }) {
  const data = row(payload.data);
  const counts = row(data.counts);
  const status = row(data.status);
  const notifications = rows(data.recentNotifications);
  const staleProducts = rows(data.staleProducts);
  const approval = text(payload.account.merchant.approval_status, "pending");
  const access = text(status.access_status, approval === "approved" ? "pre_launch_access" : approval);
  const canReceive = Boolean(status.can_receive_orders);
  const stopReason = text(status.stop_reason || payload.account.merchant.rejection_reason);

  return (
    <div className="portal-section-stack">
      {approval !== "approved" ? (
        <Notice tone={approval === "rejected" ? "danger" : "warning"} title={locale === "ar" ? "حالة اعتماد المتجر" : "Store approval status"}>
          {approval === "rejected"
            ? (locale === "ar" ? `تم رفض المتجر${stopReason ? `: ${stopReason}` : ". يمكنك مراجعة البيانات والتواصل مع الدعم."}` : `The store was rejected${stopReason ? `: ${stopReason}` : ". Review the details and contact support."}`)
            : (locale === "ar" ? "المتجر ما زال قيد المراجعة. يمكنك مراجعة بياناته، لكن استقبال الطلبات يبدأ بعد الاعتماد." : "The store is still under review. You can review its data, but requests start after approval.")}
        </Notice>
      ) : null}
      {access === "grace_period" || access === "suspended" ? (
        <Notice tone={access === "suspended" ? "danger" : "warning"} title={statusLabel(access, locale)}>
          {locale === "ar" ? (stopReason || "راجع صفحة الحساب والمدفوعات لتسوية حالة المتجر.") : (stopReason || "Review Billing and Payments to resolve the store status.")}
        </Notice>
      ) : null}

      {Boolean(payload.account.merchant.founder_badge_enabled) || Boolean(payload.account.merchant.trusted_badge_enabled) ? (
        <div className="merchant-badge-strip">
          {Boolean(payload.account.merchant.founder_badge_enabled) ? <span className="merchant-badge-pill founder"><Icon name="store" size={16}/>{locale === "ar" ? "متجر مؤسس" : "Founding store"}</span> : null}
          {Boolean(payload.account.merchant.trusted_badge_enabled) ? <span className="merchant-badge-pill trusted"><Icon name="shield" size={16}/>{locale === "ar" ? "متجر موثوق" : "Trusted store"}</span> : null}
        </div>
      ) : null}

      <div className="metrics-grid">
        <MetricCard icon="box" label={locale === "ar" ? "المنتجات الفعالة" : "Active products"} value={numberValue(counts.products)} note={locale === "ar" ? "منتجات الكتالوج الحالية" : "Current catalog products"}/>
        <MetricCard icon="quote" label={locale === "ar" ? "طلبات التسعير" : "Quote requests"} value={numberValue(counts.requests)} tone="blue" note={locale === "ar" ? "طلبات مفتوحة تحتاج ردًا" : "Open requests awaiting a response"}/>
        <MetricCard icon="receipt" label={locale === "ar" ? "الطلبات" : "Orders"} value={numberValue(counts.orders)} tone="gold" note={locale === "ar" ? "الطلبات المرتبطة بالمتجر" : "Orders linked to the store"}/>
        <MetricCard icon="branch" label={locale === "ar" ? "الفروع" : "Branches"} value={numberValue(counts.branches)} tone="gray" note={locale === "ar" ? "الفروع المسجلة" : "Registered branches"}/>
        <MetricCard icon="bell" label={locale === "ar" ? "إشعارات غير مقروءة" : "Unread notifications"} value={numberValue(counts.notifications)} tone="blue"/>
        <MetricCard icon="shield" label={locale === "ar" ? "استقبال الطلبات" : "Receiving requests"} value={canReceive ? (locale === "ar" ? "مفعّل" : "Enabled") : (locale === "ar" ? "متوقف" : "Paused")} tone={canReceive ? "green" : "gold"} note={statusLabel(access, locale)}/>
      </div>

      <div className="portal-two-columns">
        <PortalPanel title={locale === "ar" ? "حالة المتجر والحساب" : "Store and account status"} subtitle={locale === "ar" ? "المصدر المباشر هو Supabase ونظام الوصول المركزي." : "Live status from Supabase and the central access system."}>
          <div className="detail-list">
            <div><span>{locale === "ar" ? "اعتماد المتجر" : "Store approval"}</span><StatusBadge value={approval} locale={locale}/></div>
            <div><span>{locale === "ar" ? "حالة الوصول" : "Access status"}</span><StatusBadge value={access} locale={locale}/></div>
            <div><span>{locale === "ar" ? "طريقة تشغيل المتجر" : "Store mode"}</span><strong>{statusLabel(status.pricing_mode || payload.account.merchant.pricing_mode, locale)}</strong></div>
            <div><span>{locale === "ar" ? "طريقة المحاسبة" : "Billing model"}</span><strong>{statusLabel(status.billing_preference || payload.account.merchant.billing_preference || "not_selected", locale)}</strong></div>
            <div><span>{locale === "ar" ? "نهاية الفترة أو الاشتراك" : "Trial or subscription end"}</span><strong>{dateLabel(status.access_ends_at || status.subscription_ends_at || status.free_trial_ends_at, locale)}</strong></div>
          </div>
          <div className="panel-footer-actions"><Link className="button secondary compact" href="/merchant/billing">{locale === "ar" ? "فتح الحساب والاشتراك" : "Open billing"}<Icon name="arrow" size={18}/></Link></div>
        </PortalPanel>

        <PortalPanel title={locale === "ar" ? "آخر الإشعارات" : "Latest notifications"} action={<Link href="/merchant/notifications">{locale === "ar" ? "عرض الكل" : "View all"}</Link>}>
          {notifications.length === 0 ? <EmptyState icon="bell" title={locale === "ar" ? "لا توجد إشعارات جديدة" : "No new notifications"} body={locale === "ar" ? "ستظهر هنا تحديثات الطلبات والحساب." : "Order and account updates will appear here."}/> : (
            <div className="notification-mini-list">{notifications.map((item) => <article key={text(item.id)} className={item.is_read ? "" : "unread"}><span><Icon name="bell" size={18}/></span><div><strong>{text(locale === "ar" ? item.title_ar : item.title_en, text(item.type))}</strong><p>{text(locale === "ar" ? item.body_ar : item.body_en)}</p><small>{dateLabel(item.created_at, locale)}</small></div></article>)}</div>
          )}
        </PortalPanel>
      </div>

      <PortalPanel title={locale === "ar" ? "منتجات تحتاج تحديثًا" : "Products that need an update"} subtitle={locale === "ar" ? "المنتجات التي لم تُحدّث أسعارها أو كمياتها خلال 30 يومًا." : "Products whose price or quantity has not been updated for 30 days."} action={<Link href="/merchant/products">{locale === "ar" ? "إدارة المنتجات" : "Manage products"}</Link>}>
        {staleProducts.length === 0 ? <EmptyState icon="check" title={locale === "ar" ? "المنتجات محدثة" : "Products are up to date"} body={locale === "ar" ? "لا توجد منتجات قديمة ضمن الفحص الحالي." : "No stale products were found in the current check."}/> : (
          <div className="compact-table-wrap"><table className="portal-table"><thead><tr><th>{locale === "ar" ? "المنتج" : "Product"}</th><th>{locale === "ar" ? "السعر" : "Price"}</th><th>{locale === "ar" ? "الكمية" : "Quantity"}</th><th>{locale === "ar" ? "آخر تحديث" : "Last update"}</th></tr></thead><tbody>{staleProducts.map((item) => <tr key={text(item.id)}><td>{text(item.free_name, locale === "ar" ? "منتج" : "Product")}</td><td>{numberValue(item.price)}</td><td>{numberValue(item.quantity)}</td><td>{dateLabel(item.price_quantity_updated_at, locale)}</td></tr>)}</tbody></table></div>
        )}
      </PortalPanel>
    </div>
  );
}
