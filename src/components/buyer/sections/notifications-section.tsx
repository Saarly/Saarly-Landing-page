"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { buyerPost } from "@/components/buyer/portal-client";
import { EmptyState, PortalPanel } from "@/components/merchant/portal-ui";
import { bool, buyerNotificationTarget, dateLabel, rows, text, type PortalRow } from "@/components/merchant/portal-utils";
import type { BuyerSectionProps } from "@/components/buyer/section-props";

type Category = "all" | "orders" | "offers" | "support" | "priceAlerts" | "general";
const categoryTypes: Record<Exclude<Category,"all"|"general">,Set<string>> = {
  orders: new Set(["merchant_confirmed_order","confirmation_deadline_approaching","buyer_accepted_offer"]),
  offers: new Set(["offer_ready","rfq_response_new","rfq_response_rejected","rfq_rejected","rfq_accepted"]),
  support: new Set(["buyer_merchant_message_new","support_message_new"]),
  priceAlerts: new Set(["price_drop","price_alert"]),
};
function categoryOf(item: PortalRow): Category {
  const type=text(item.type);
  for(const [key,set] of Object.entries(categoryTypes) as [Exclude<Category,"all"|"general">,Set<string>][]) if(set.has(type)) return key;
  return "general";
}
const labels:Record<Category,{ar:string;en:string}>={all:{ar:"الكل",en:"All"},orders:{ar:"الطلبات",en:"Orders"},offers:{ar:"العروض والتسعير",en:"Offers & quotes"},support:{ar:"الشكاوى والمحادثات",en:"Support & messages"},priceAlerts:{ar:"تنبيهات الأسعار",en:"Price alerts"},general:{ar:"عام",en:"General"}};

export function BuyerNotificationsSection({ payload, locale, refresh, notify }: BuyerSectionProps) {
  const notifications = rows(payload.data.notifications);
  const [category,setCategory]=useState<Category>("all");
  const [busy, setBusy] = useState(false);
  const visible=useMemo(()=>category==="all"?notifications:notifications.filter(item=>categoryOf(item)===category),[notifications,category]);
  const categories=(Object.keys(labels) as Category[]).map(key=>({key,label:labels[key][locale],unread:(key==="all"?notifications:notifications.filter(item=>categoryOf(item)===key)).filter(item=>!bool(item.is_read)).length}));
  async function mark(id: string) { try { await buyerPost("mark_notification", { id }); await refresh(); } catch (error) { notify(error instanceof Error ? error.message : "notification_update_failed", "error"); } }
  async function markAll() { setBusy(true); try { await buyerPost("mark_all_notifications"); notify(locale === "ar" ? "تم تحديد كل الإشعارات كمقروءة." : "All notifications marked as read.", "success"); await refresh(); } catch (error) { notify(error instanceof Error ? error.message : "notification_update_failed", "error"); } finally { setBusy(false); } }
  return <PortalPanel title={locale === "ar" ? `الإشعارات (${notifications.length})` : `Notifications (${notifications.length})`} subtitle={locale === "ar" ? "نفس تقسيم سجل الإشعارات في التطبيق، وكل إشعار يفتح الصفحة والسجل المقصود." : "The same notification categories as the app; every item opens its intended record."} action={<button className="button secondary compact" disabled={busy||notifications.every(item=>bool(item.is_read))} onClick={() => void markAll()}><Icon name="check" size={17}/>{locale === "ar" ? "قراءة الكل" : "Mark all read"}</button>}>
    <div className="notification-category-tabs">{categories.map(item=><button type="button" key={item.key} className={category===item.key?"active":""} onClick={()=>setCategory(item.key)}>{item.label}{item.unread>0?<span>{item.unread>99?"99+":item.unread}</span>:null}</button>)}</div>
    {visible.length ? <div className="notification-list">{visible.map((item) => <article className={`notification-row ${bool(item.is_read) ? "" : "unread"}`} key={text(item.id)} data-record-id={text(item.id)}><span className="notification-icon"><Icon name={categoryOf(item)==="orders"?"box":categoryOf(item)==="offers"?"compare":categoryOf(item)==="support"?"quote":categoryOf(item)==="priceAlerts"?"money":"bell"}/></span><div><header><strong>{text(locale === "ar" ? item.title_ar : item.title_en,locale==="ar"?"إشعار":"Notification")}</strong><small>{dateLabel(item.created_at, locale)}</small></header><p>{text(locale === "ar" ? item.body_ar : item.body_en)}</p><small className="notification-category-label">{labels[categoryOf(item)][locale]}</small></div><div className="inline-actions"><Link className="button secondary compact" href={buyerNotificationTarget(item.deep_link, item.payload)} onClick={() => void mark(text(item.id))}>{locale === "ar" ? "فتح التفاصيل" : "Open details"}</Link>{!bool(item.is_read) ? <button className="icon-button" onClick={() => void mark(text(item.id))} aria-label={locale === "ar" ? "تحديد كمقروء" : "Mark as read"}><Icon name="check"/></button> : null}</div></article>)}</div> : <EmptyState icon="bell" title={category==="all"?(locale === "ar" ? "لا توجد إشعارات" : "No notifications"):(locale==="ar"?"لا توجد إشعارات في هذا القسم":"No notifications in this category")} body={locale === "ar" ? "التحديثات الجديدة هتظهر هنا تلقائيًا." : "New updates will appear here automatically."}/>} 
  </PortalPanel>;
}
