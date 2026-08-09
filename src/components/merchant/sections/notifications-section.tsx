"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { portalPost } from "@/components/merchant/portal-client";
import { EmptyState, PortalPanel } from "@/components/merchant/portal-ui";
import { bool, dateLabel, notificationTarget, rows, text, type PortalRow } from "@/components/merchant/portal-utils";
import type { SectionProps } from "@/components/merchant/section-props";

type Category="all"|"orders"|"offers"|"support"|"account"|"reminders"|"general";
const categoryTypes:Record<Exclude<Category,"all"|"general">,Set<string>>={
  orders:new Set(["buyer_accepted_offer","catalog_order_new","merchant_confirmed_order","confirmation_deadline_approaching"]),
  offers:new Set(["rfq_request_new","rfq_accepted","rfq_response_rejected","rfq_rejected"]),
  support:new Set(["buyer_merchant_message_new","support_message_new"]),
  account:new Set(["merchant_approved","merchant_rejected","branch_approved","branch_rejected","subscription_approved","subscription_rejected","renewal_approved","renewal_rejected","merchant_referral_credit_redeemed"]),
  reminders:new Set(["weekly_price_update","shipping_price_reminder","product_low_stock","product_out_of_stock"]),
};
function categoryOf(item:PortalRow):Category{const type=text(item.type);for(const [key,set] of Object.entries(categoryTypes) as [Exclude<Category,"all"|"general">,Set<string>][]) if(set.has(type))return key;return "general";}
const labels:Record<Category,{ar:string;en:string}>={all:{ar:"الكل",en:"All"},orders:{ar:"الطلبات",en:"Orders"},offers:{ar:"طلبات التسعير",en:"Quote requests"},support:{ar:"الشكاوى والمحادثات",en:"Support & messages"},account:{ar:"الفروع والحساب",en:"Account & branches"},reminders:{ar:"التذكيرات",en:"Reminders"},general:{ar:"عام",en:"General"}};

export function NotificationsSection({ payload, locale, refresh, notify }: SectionProps) {
  const router = useRouter();
  const notifications = rows(payload.data.notifications);
  const [category, setCategory] = useState<Category>("all");
  const [saving, setSaving] = useState(false);
  const visible = useMemo(() => category === "all" ? notifications : notifications.filter((item) => categoryOf(item) === category), [notifications, category]);
  const categories=(Object.keys(labels) as Category[]).map(key=>({key,label:labels[key][locale],unread:(key==="all"?notifications:notifications.filter(item=>categoryOf(item)===key)).filter(item=>!bool(item.is_read)).length}));

  async function mark(id?: string) {
    setSaving(true);
    try { await portalPost(id ? "mark_notification" : "mark_all_notifications", id ? { id } : {}); if (!id) notify(locale === "ar" ? "تم تحديد كل الإشعارات كمقروءة." : "All notifications marked as read.", "success"); await refresh(); }
    catch (error) { notify(error instanceof Error ? error.message : "notification_update_failed", "error"); }
    finally { setSaving(false); }
  }
  async function open(item: PortalRow) { if (!bool(item.is_read)) { try { await portalPost("mark_notification", { id: text(item.id) }); } catch {} } router.push(notificationTarget(item.deep_link, item.payload)); }

  return <PortalPanel title={locale === "ar" ? "الإشعارات" : "Notifications"} subtitle={locale === "ar" ? "نفس تقسيم التطبيق للطلبات والتسعير والدعم والحساب والتذكيرات." : "The same app categories for orders, quotes, support, account, and reminders."} action={<button className="button secondary compact" type="button" disabled={saving || notifications.every((item) => bool(item.is_read))} onClick={() => void mark()}><Icon name="check" size={18}/>{locale === "ar" ? "تحديد الكل كمقروء" : "Mark all read"}</button>}>
    <div className="notification-category-tabs">{categories.map(item=><button type="button" key={item.key} className={category===item.key?"active":""} onClick={()=>setCategory(item.key)}>{item.label}{item.unread>0?<span>{item.unread>99?"99+":item.unread}</span>:null}</button>)}</div>
    {visible.length === 0 ? <EmptyState icon="bell" title={category==="all"?(locale === "ar" ? "لا توجد إشعارات" : "No notifications"):(locale==="ar"?"لا توجد إشعارات في هذا القسم":"No notifications in this category")} body={locale === "ar" ? "التحديثات الجديدة هتظهر هنا تلقائيًا." : "New updates will appear here automatically."}/> : <div className="notification-list">{visible.map((item) => <article className={bool(item.is_read) ? "notification-row" : "notification-row unread"} key={text(item.id)}><button className="notification-open" type="button" onClick={() => void open(item)}><span className="notification-icon"><Icon name={categoryOf(item)==="orders"?"box":categoryOf(item)==="offers"?"quote":categoryOf(item)==="support"?"users":categoryOf(item)==="account"?"shield":categoryOf(item)==="reminders"?"clock":"bell"}/></span><div><header><strong>{text(locale === "ar" ? item.title_ar : item.title_en, locale === "ar" ? "إشعار" : "Notification")}</strong><small>{dateLabel(item.created_at, locale)}</small></header><p>{text(locale === "ar" ? item.body_ar : item.body_en)}</p><small className="notification-category-label">{labels[categoryOf(item)][locale]} · {locale === "ar" ? "فتح التفاصيل" : "Open details"}</small></div></button>{!bool(item.is_read) ? <button className="notification-read" type="button" onClick={() => void mark(text(item.id))} disabled={saving} title={locale === "ar" ? "تحديد كمقروء" : "Mark read"}><Icon name="check" size={18}/></button> : null}</article>)}</div>}
  </PortalPanel>;
}
