"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { buyerPost } from "@/components/buyer/portal-client";
import { EmptyState, PortalPanel } from "@/components/merchant/portal-ui";
import { buyerNotificationTarget, dateLabel, rows, text } from "@/components/merchant/portal-utils";
import type { BuyerSectionProps } from "@/components/buyer/section-props";

export function BuyerNotificationsSection({ payload, locale, refresh, notify }: BuyerSectionProps) {
  const notifications = rows(payload.data.notifications);
  const [busy, setBusy] = useState(false);
  async function mark(id: string) { try { await buyerPost("mark_notification", { id }); await refresh(); } catch (error) { notify(error instanceof Error ? error.message : "notification_update_failed", "error"); } }
  async function markAll() { setBusy(true); try { await buyerPost("mark_all_notifications"); notify(locale === "ar" ? "تم تحديد كل الإشعارات كمقروءة." : "All notifications marked as read.", "success"); await refresh(); } catch (error) { notify(error instanceof Error ? error.message : "notification_update_failed", "error"); } finally { setBusy(false); } }
  return <PortalPanel title={locale === "ar" ? `الإشعارات (${notifications.length})` : `Notifications (${notifications.length})`} subtitle={locale === "ar" ? "إشعارات المشتري فقط؛ كل إشعار يفتح الصفحة والسجل المقصود." : "Buyer notifications only; every item opens its intended page and record."} action={<button className="button secondary compact" disabled={busy} onClick={() => void markAll()}>{locale === "ar" ? "قراءة الكل" : "Mark all read"}</button>}>
    {notifications.length ? <div className="notification-list">{notifications.map((item) => <article className={`notification-row ${item.is_read === true ? "" : "unread"}`} key={text(item.id)} data-record-id={text(item.id)}><span className="notification-icon"><Icon name="bell"/></span><div><strong>{locale === "ar" ? text(item.title_ar) : text(item.title_en)}</strong><p>{locale === "ar" ? text(item.body_ar) : text(item.body_en)}</p><small>{dateLabel(item.created_at, locale)}</small></div><div className="inline-actions"><Link className="button secondary compact" href={buyerNotificationTarget(item.deep_link, item.payload)} onClick={() => void mark(text(item.id))}>{locale === "ar" ? "فتح" : "Open"}</Link>{item.is_read !== true ? <button className="icon-button" onClick={() => void mark(text(item.id))} aria-label={locale === "ar" ? "تحديد كمقروء" : "Mark as read"}><Icon name="check"/></button> : null}</div></article>)}</div> : <EmptyState icon="bell" title={locale === "ar" ? "مفيش إشعارات" : "No notifications"} body={locale === "ar" ? "التحديثات المهمة عن العروض والطلبات والأسعار هتظهر هنا." : "Important offer, order, and price updates will appear here."}/>} 
  </PortalPanel>;
}
