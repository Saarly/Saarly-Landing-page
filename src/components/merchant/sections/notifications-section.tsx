"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { portalPost } from "@/components/merchant/portal-client";
import { EmptyState, PortalPanel } from "@/components/merchant/portal-ui";
import { bool, dateLabel, notificationTarget, rows, text } from "@/components/merchant/portal-utils";
import type { SectionProps } from "@/components/merchant/section-props";

export function NotificationsSection({ payload, locale, refresh, notify }: SectionProps) {
  const router = useRouter();
  const notifications = rows(payload.data.notifications);
  const [filter, setFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const visible = useMemo(() => notifications.filter((item) => filter === "all" || (filter === "unread" ? !bool(item.is_read) : text(item.type).includes(filter))), [notifications, filter]);

  async function mark(id?: string) {
    setSaving(true);
    try {
      await portalPost(id ? "mark_notification" : "mark_all_notifications", id ? { id } : {});
      if (!id) notify(locale === "ar" ? "تم تحديد كل الإشعارات كمقروءة." : "All notifications marked as read.", "success");
      await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "notification_update_failed", "error"); }
    finally { setSaving(false); }
  }

  async function open(item: Record<string, unknown>) {
    if (!bool(item.is_read)) {
      try { await portalPost("mark_notification", { id: text(item.id) }); } catch { /* navigation remains available */ }
    }
    router.push(notificationTarget(item.deep_link, item.payload));
  }

  return <div className="portal-section-stack"><PortalPanel title={locale === "ar" ? "الإشعارات" : "Notifications"} subtitle={locale === "ar" ? "كل إشعار بيفتح الصفحة والطلب أو المنتج المقصود مباشرة." : "Every notification opens its intended page, order, or product directly."} action={<button className="button secondary compact" type="button" disabled={saving || notifications.every((item) => bool(item.is_read))} onClick={() => void mark()}><Icon name="check" size={18}/>{locale === "ar" ? "تحديد الكل كمقروء" : "Mark all read"}</button>}>
    <div className="portal-toolbar"><button className={`filter-chip ${filter === "all" ? "active" : ""}`} type="button" onClick={() => setFilter("all")}>{locale === "ar" ? "الكل" : "All"}</button><button className={`filter-chip ${filter === "unread" ? "active" : ""}`} type="button" onClick={() => setFilter("unread")}>{locale === "ar" ? "غير المقروء" : "Unread"}</button><button className={`filter-chip ${filter === "order" ? "active" : ""}`} type="button" onClick={() => setFilter("order")}>{locale === "ar" ? "الطلبات" : "Orders"}</button><button className={`filter-chip ${filter === "billing" ? "active" : ""}`} type="button" onClick={() => setFilter("billing")}>{locale === "ar" ? "الحساب" : "Billing"}</button></div>
    {visible.length === 0 ? <EmptyState icon="bell" title={locale === "ar" ? "لا توجد إشعارات" : "No notifications"} body={locale === "ar" ? "لا توجد عناصر مطابقة للفلاتر الحالية." : "No items match the current filters."}/> : <div className="notification-list">{visible.map((item) => <article className={bool(item.is_read) ? "notification-row" : "notification-row unread"} key={text(item.id)}><button className="notification-open" type="button" onClick={() => void open(item)}><span className="notification-icon"><Icon name={text(item.type).includes("billing") || text(item.type).includes("subscription") ? "receipt" : text(item.type).includes("order") ? "box" : "bell"}/></span><div><header><strong>{text(locale === "ar" ? item.title_ar : item.title_en, locale === "ar" ? "إشعار" : "Notification")}</strong><small>{dateLabel(item.created_at, locale)}</small></header><p>{text(locale === "ar" ? item.body_ar : item.body_en)}</p><small className="deep-link-label"><Icon name="arrow" size={14}/>{locale === "ar" ? "فتح التفاصيل" : "Open details"}</small></div></button>{!bool(item.is_read) ? <button className="notification-read" type="button" onClick={() => void mark(text(item.id))} disabled={saving} title={locale === "ar" ? "تحديد كمقروء" : "Mark read"}><Icon name="check" size={18}/></button> : null}</article>)}</div>}
  </PortalPanel></div>;
}
