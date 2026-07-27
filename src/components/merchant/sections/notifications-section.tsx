"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { portalPost } from "@/components/merchant/portal-client";
import { EmptyState, PortalPanel } from "@/components/merchant/portal-ui";
import { bool, dateLabel, rows, text } from "@/components/merchant/portal-utils";
import type { SectionProps } from "@/components/merchant/section-props";

export function NotificationsSection({ payload, locale, refresh, notify }: SectionProps) {
  const notifications = rows(payload.data.notifications);
  const [filter, setFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const visible = useMemo(() => notifications.filter((item) => filter === "all" || (filter === "unread" ? !bool(item.is_read) : text(item.type).includes(filter))), [notifications, filter]);

  async function mark(id?: string) {
    setSaving(true);
    try {
      await portalPost(id ? "mark_notification" : "mark_all_notifications", id ? { id } : {});
      notify(locale === "ar" ? "تم تحديث الإشعارات." : "Notifications updated.", "success");
      await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "notification_update_failed", "error"); }
    finally { setSaving(false); }
  }

  return <div className="portal-section-stack"><PortalPanel title={locale === "ar" ? "الإشعارات" : "Notifications"} subtitle={locale === "ar" ? "تحديثات الطلبات والحساب والأسعار والتنبيهات المهمة." : "Important order, account, pricing, and alert updates."} action={<button className="button secondary compact" type="button" disabled={saving || notifications.every((item) => bool(item.is_read))} onClick={() => void mark()}><Icon name="check" size={18}/>{locale === "ar" ? "تحديد الكل كمقروء" : "Mark all read"}</button>}>
    <div className="portal-toolbar"><button className={`filter-chip ${filter === "all" ? "active" : ""}`} type="button" onClick={() => setFilter("all")}>{locale === "ar" ? "الكل" : "All"}</button><button className={`filter-chip ${filter === "unread" ? "active" : ""}`} type="button" onClick={() => setFilter("unread")}>{locale === "ar" ? "غير المقروء" : "Unread"}</button><button className={`filter-chip ${filter === "order" ? "active" : ""}`} type="button" onClick={() => setFilter("order")}>{locale === "ar" ? "الطلبات" : "Orders"}</button><button className={`filter-chip ${filter === "billing" ? "active" : ""}`} type="button" onClick={() => setFilter("billing")}>{locale === "ar" ? "الحساب" : "Billing"}</button></div>
    {visible.length === 0 ? <EmptyState icon="bell" title={locale === "ar" ? "لا توجد إشعارات" : "No notifications"} body={locale === "ar" ? "لا توجد عناصر مطابقة للفلاتر الحالية." : "No items match the current filters."}/> : <div className="notification-list">{visible.map((item) => <article className={bool(item.is_read) ? "" : "unread"} key={text(item.id)}><span className="notification-icon"><Icon name={text(item.type).includes("billing") || text(item.type).includes("subscription") ? "receipt" : text(item.type).includes("order") ? "box" : "bell"}/></span><div><header><strong>{text(locale === "ar" ? item.title_ar : item.title_en, text(item.type))}</strong><small>{dateLabel(item.created_at, locale)}</small></header><p>{text(locale === "ar" ? item.body_ar : item.body_en)}</p>{text(item.deep_link) ? <small className="deep-link-label">{locale === "ar" ? "مرتبط بمسار داخل التطبيق" : "Linked to an in-app route"}</small> : null}</div>{!bool(item.is_read) ? <button type="button" onClick={() => void mark(text(item.id))} disabled={saving} title={locale === "ar" ? "تحديد كمقروء" : "Mark read"}><Icon name="check" size={18}/></button> : null}</article>)}</div>}
  </PortalPanel></div>;
}
