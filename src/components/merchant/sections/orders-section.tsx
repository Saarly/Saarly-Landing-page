"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { portalPost } from "@/components/merchant/portal-client";
import { EmptyState, PortalPanel, StatusBadge } from "@/components/merchant/portal-ui";
import { dateLabel, money, numberValue, row, rows, statusLabel, text, unitLabel, type PortalRow } from "@/components/merchant/portal-utils";
import type { SectionProps } from "@/components/merchant/section-props";

const awaitingConfirmationStatuses = ["pending_merchant_confirmation", "pending", "awaiting_confirmation"];

function deliveryCost(order: PortalRow) {
  const table = row(order.delivery_pricing_table_snapshot);
  if (table.free_delivery_applied === true) return 0;
  for (const key of ["delivery_cost", "delivery_fee", "delivery_price", "flat_fee", "fixed_price"]) {
    if (table[key] !== null && table[key] !== undefined && text(table[key]) !== "") return numberValue(table[key]);
  }
  return null;
}

function remainingLabel(deadline: unknown, locale: "ar" | "en") {
  const time = new Date(text(deadline)).getTime() - Date.now();
  if (!Number.isFinite(time) || time <= 0) return locale === "ar" ? "انتهت المهلة" : "Deadline reached";
  const totalMinutes = Math.floor(time / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return locale === "ar" ? `${days} يوم و${hours} ساعة` : `${days}d ${hours}h`;
  return locale === "ar" ? `${hours} ساعة و${minutes} دقيقة` : `${hours}h ${minutes}m`;
}

export function OrdersSection({ payload, locale, refresh, notify }: SectionProps) {
  const orders = rows(payload.data.orders);
  const buyers = rows(payload.data.buyers);
  const buyerMap = useMemo(() => new Map(buyers.map((buyer) => [text(buyer.order_id), buyer])), [buyers]);
  const [filter, setFilter] = useState<"all" | "direct" | "broadcast">("all");
  const [selected, setSelected] = useState<PortalRow | null>(null);
  const [cancelMode, setCancelMode] = useState(false);
  const [reason, setReason] = useState("out_of_stock");
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);
  const [chat, setChat] = useState<{ conversationId: string; messages: PortalRow[] } | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const currency = text(payload.data.currencyCode || payload.account.currencyCode, "EGP");
  const visible = useMemo(() => orders.filter((order) => {
    if (filter === "all") return true;
    return text(order.delivery_type) === filter;
  }), [orders, filter]);
  const directCount = orders.filter((order) => text(order.delivery_type) === "direct").length;
  const broadcastCount = orders.filter((order) => text(order.delivery_type) === "broadcast").length;

  async function update(status: "confirmed" | "cancelled_by_merchant") {
    if (!selected) return;
    setSaving(true);
    try {
      await portalPost("update_order", { id: text(selected.id), status, reason, details });
      notify(status === "confirmed" ? (locale === "ar" ? "تم تأكيد الطلب." : "Order confirmed.") : (locale === "ar" ? "تم إلغاء الطلب من المتجر." : "Order cancelled by the store."), "success");
      setSelected(null); setCancelMode(false); setDetails("");
      await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "order_update_failed", "error"); }
    finally { setSaving(false); }
  }

  async function openChat() {
    if (!selected) return;
    setSaving(true);
    try {
      const result = await portalPost("open_order_chat", { orderId: text(selected.order_id) }) as { conversationId?: string; messages?: PortalRow[] };
      setChat({ conversationId: text(result.conversationId), messages: Array.isArray(result.messages) ? result.messages : [] });
    } catch (error) { notify(error instanceof Error ? error.message : "chat_load_failed", "error"); }
    finally { setSaving(false); }
  }

  async function sendChat() {
    if (!chat || !chatMessage.trim()) return;
    setSaving(true);
    try {
      await portalPost("send_order_chat_message", { conversationId: chat.conversationId, message: chatMessage.trim() });
      setChatMessage("");
      const result = await portalPost("open_order_chat", { orderId: text(selected?.order_id) }) as { conversationId?: string; messages?: PortalRow[] };
      setChat({ conversationId: text(result.conversationId), messages: Array.isArray(result.messages) ? result.messages : [] });
    } catch (error) { notify(error instanceof Error ? error.message : "message_send_failed", "error"); }
    finally { setSaving(false); }
  }

  return <div className="portal-section-stack"><PortalPanel title={locale === "ar" ? "الطلبات" : "Orders"} subtitle={locale === "ar" ? "تابع الطلبات المقبولة وتأكيد المتجر وقرار المشتري." : "Track accepted orders, store confirmation, and buyer decisions."}>
    <div className="portal-filter-row" role="group" aria-label={locale === "ar" ? "نوع الطلب" : "Order type"}><button type="button" className={`filter-chip ${filter === "all" ? "active" : ""}`} onClick={() => setFilter("all")}>{locale === "ar" ? `الكل (${orders.length})` : `All (${orders.length})`}</button><button type="button" className={`filter-chip ${filter === "direct" ? "active" : ""}`} onClick={() => setFilter("direct")}>{locale === "ar" ? `مخصوص (${directCount})` : `Direct (${directCount})`}</button><button type="button" className={`filter-chip ${filter === "broadcast" ? "active" : ""}`} onClick={() => setFilter("broadcast")}>{locale === "ar" ? `عام (${broadcastCount})` : `Broadcast (${broadcastCount})`}</button></div>
    {visible.length === 0 ? <EmptyState icon="receipt" title={locale === "ar" ? "لا توجد طلبات" : "No orders"} body={locale === "ar" ? "تظهر الطلبات هنا بعد قبول عرض مرتبط بالمتجر." : "Orders appear here after an offer linked to the store is accepted."}/> : <div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>{locale === "ar" ? "رقم الطلب" : "Order"}</th><th>{locale === "ar" ? "الحالة" : "Status"}</th><th>{locale === "ar" ? "القيمة" : "Amount"}</th><th>{locale === "ar" ? "موعد التأكيد" : "Confirmation deadline"}</th><th>{locale === "ar" ? "قرار المشتري" : "Buyer decision"}</th><th/></tr></thead><tbody>{visible.map((order) => <tr key={text(order.id)} data-record-id={text(order.id)} data-order-id={text(order.order_id)}><td><strong>#{text(order.order_id).slice(0, 8)}</strong><small>{text(order.delivery_type) === "direct" ? (locale === "ar" ? "طلب مخصوص" : "Direct") : (locale === "ar" ? "طلب عام" : "General")}</small></td><td><StatusBadge value={order.status} locale={locale}/></td><td>{money(numberValue(order.subtotal_snapshot) + (deliveryCost(order) ?? 0), currency, locale)}</td><td>{dateLabel(order.confirmation_deadline, locale)}<small>{awaitingConfirmationStatuses.includes(text(order.status)) ? remainingLabel(order.confirmation_deadline, locale) : ""}</small></td><td>{statusLabel(order.buyer_decision || "undecided", locale)}</td><td><button className="button secondary compact" type="button" onClick={() => { setSelected(order); setCancelMode(false); }}>{locale === "ar" ? "التفاصيل" : "Details"}</button></td></tr>)}</tbody></table></div>}
  </PortalPanel>

  {selected ? <div className="portal-modal-backdrop" role="presentation"><section className="portal-modal wide" role="dialog" aria-modal="true"><header><div><span className="eyebrow"><Icon name="receipt" size={17}/>{locale === "ar" ? "تفاصيل الطلب" : "Order details"}</span><h2>#{text(selected.order_id).slice(0, 12)}</h2></div><button className="icon-button" data-modal-close type="button" aria-label={locale === "ar" ? "إغلاق تفاصيل الطلب" : "Close order details"} title={locale === "ar" ? "إغلاق" : "Close"} onClick={() => setSelected(null)}><Icon name="close"/></button></header><div className="portal-two-columns order-detail-grid"><div><div className="detail-list"><div><span>{locale === "ar" ? "الحالة" : "Status"}</span><StatusBadge value={selected.status} locale={locale}/></div><div><span>{locale === "ar" ? "نوع الطلب" : "Request type"}</span><strong>{text(selected.delivery_type) === "direct" ? (locale === "ar" ? "طلب مخصوص" : "Direct request") : (locale === "ar" ? "طلب مقارنة عام" : "General request")}</strong></div><div><span>{locale === "ar" ? "قيمة المنتجات" : "Items subtotal"}</span><strong>{money(selected.subtotal_snapshot, currency, locale)}</strong></div><div><span>{locale === "ar" ? "التوصيل" : "Delivery"}</span><strong>{selected.delivery_available_snapshot === true ? (deliveryCost(selected) === 0 ? (locale === "ar" ? "مجاني" : "Free") : deliveryCost(selected) === null ? (locale === "ar" ? "حسب إعداد المتجر" : "Based on store settings") : money(deliveryCost(selected), currency, locale)) : (locale === "ar" ? "استلام / غير متاح" : "Pickup / unavailable")}</strong></div><div><span>{locale === "ar" ? "الإجمالي" : "Total"}</span><strong>{money(numberValue(selected.subtotal_snapshot) + (deliveryCost(selected) ?? 0), currency, locale)}</strong></div><div><span>{locale === "ar" ? "تاريخ قبول المشتري" : "Buyer accepted at"}</span><strong>{dateLabel(row(selected.order).accepted_at || selected.created_at, locale)}</strong></div><div><span>{locale === "ar" ? "موعد التأكيد" : "Confirmation deadline"}</span><strong>{dateLabel(selected.confirmation_deadline, locale)}</strong><small>{awaitingConfirmationStatuses.includes(text(selected.status)) ? remainingLabel(selected.confirmation_deadline, locale) : ""}</small></div><div><span>{locale === "ar" ? "وقت التأكيد" : "Confirmed at"}</span><strong>{dateLabel(selected.confirmed_at, locale)}</strong></div>{text(selected.merchant_cancel_reason) ? <div><span>{locale === "ar" ? "سبب الإلغاء" : "Cancellation reason"}</span><strong>{statusLabel(selected.merchant_cancel_reason, locale)}</strong><small>{text(selected.merchant_cancel_details)}</small></div> : null}</div>{(() => { const buyer = buyerMap.get(text(selected.order_id)); return buyer ? <div className="buyer-card"><span><Icon name="users"/></span><div><strong>{text(buyer.full_name || buyer.buyer_name, locale === "ar" ? "المشتري" : "Buyer")}</strong><p>{text(buyer.mobile || buyer.phone)}</p>{text(buyer.primary_email || buyer.email) ? <small>{text(buyer.primary_email || buyer.email)}</small> : null}</div></div> : null; })()}</div><div><h3>{locale === "ar" ? "بنود الطلب" : "Order items"}</h3><div className="order-items">{rows(selected.items).map((item) => <article key={text(item.id)}><div><strong>{text(item.matched_name_snapshot || item.requested_name_snapshot)}</strong><small>{numberValue(item.quantity_snapshot)} {unitLabel(item.unit_snapshot, locale)}</small></div><span>{money(item.line_total_snapshot || (numberValue(item.unit_price_snapshot) * numberValue(item.quantity_snapshot)), currency, locale)}</span></article>)}</div></div></div>{chat ? <section className="order-chat-box"><header><div><strong>{locale === "ar" ? "محادثة العميل" : "Buyer chat"}</strong><small>{locale === "ar" ? "متزامنة مع تطبيق سعرلي" : "Synced with the Saarly app"}</small></div><button className="button text-button" type="button" onClick={() => setChat(null)}>{locale === "ar" ? "إخفاء" : "Hide"}</button></header><div className="chat-messages">{chat.messages.length ? chat.messages.map((message) => { const mine = text(message.sender_user_id) === payload.account.userId; return <article className={mine ? "mine" : "theirs"} key={text(message.id)}><p>{text(message.body)}</p><small>{dateLabel(message.created_at, locale)}</small></article>; }) : <p className="muted-copy">{locale === "ar" ? "ابدأ المحادثة برسالة واضحة للعميل." : "Start with a clear message to the buyer."}</p>}</div><div className="chat-composer"><textarea rows={2} value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} placeholder={locale === "ar" ? "اكتب رسالتك..." : "Write your message..."}/><button className="button primary compact" type="button" disabled={saving || !chatMessage.trim()} onClick={() => void sendChat()}><Icon name="arrow" size={17}/>{locale === "ar" ? "إرسال" : "Send"}</button></div></section> : null}{cancelMode ? <div className="cancel-box"><label>{locale === "ar" ? "سبب الإلغاء" : "Cancellation reason"}<select value={reason} onChange={(event) => setReason(event.target.value)}><option value="out_of_stock">{locale === "ar" ? "غير متوفر بالمخزون" : "Out of stock"}</option><option value="price_changed">{locale === "ar" ? "السعر تغيّر" : "Price changed"}</option><option value="other">{locale === "ar" ? "سبب آخر" : "Other"}</option></select></label><label>{locale === "ar" ? "توضيح للعميل" : "Note for the buyer"}<textarea rows={3} minLength={3} value={details} onChange={(event) => setDetails(event.target.value)}/></label></div> : null}<footer className="modal-actions">{awaitingConfirmationStatuses.includes(text(selected.status)) ? <>{cancelMode ? <button className="button secondary" type="button" onClick={() => setCancelMode(false)}>{locale === "ar" ? "رجوع" : "Back"}</button> : <button className="button danger-button" type="button" onClick={() => setCancelMode(true)}>{locale === "ar" ? "إلغاء الطلب" : "Cancel order"}</button>}<button className="button primary" type="button" disabled={saving} onClick={() => void update(cancelMode ? "cancelled_by_merchant" : "confirmed")}>{saving ? (locale === "ar" ? "جارٍ الحفظ" : "Saving") : cancelMode ? (locale === "ar" ? "تأكيد الإلغاء" : "Confirm cancellation") : (locale === "ar" ? "تأكيد الطلب" : "Confirm order")}</button></> : <><button className="button secondary" type="button" onClick={() => setSelected(null)}>{locale === "ar" ? "إغلاق" : "Close"}</button>{["confirmed", "completed"].includes(text(selected.status)) || text(selected.buyer_decision) === "accepted" ? <button className="button primary" type="button" disabled={saving} onClick={() => void openChat()}><Icon name="quote" size={18}/>{locale === "ar" ? "محادثة العميل" : "Buyer chat"}</button> : null}</>}</footer></section></div> : null}
  </div>;
}
