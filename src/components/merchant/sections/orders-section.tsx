"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { portalPost } from "@/components/merchant/portal-client";
import { EmptyState, PortalPanel, StatusBadge } from "@/components/merchant/portal-ui";
import { dateLabel, money, numberValue, row, rows, statusLabel, text, type PortalRow } from "@/components/merchant/portal-utils";
import type { SectionProps } from "@/components/merchant/section-props";

export function OrdersSection({ payload, locale, refresh, notify }: SectionProps) {
  const orders = rows(payload.data.orders);
  const buyers = rows(payload.data.buyers);
  const buyerMap = useMemo(() => new Map(buyers.map((buyer) => [text(buyer.order_id), buyer])), [buyers]);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<PortalRow | null>(null);
  const [cancelMode, setCancelMode] = useState(false);
  const [reason, setReason] = useState("unavailable_items");
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);
  const [chat, setChat] = useState<{ conversationId: string; messages: PortalRow[] } | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const currency = text(payload.data.currencyCode || payload.account.currencyCode, "EGP");
  const visible = useMemo(() => orders.filter((order) => filter === "all" || text(order.status) === filter), [orders, filter]);

  async function update(status: "confirmed" | "cancelled_by_merchant") {
    if (!selected) return;
    if (status === "cancelled_by_merchant" && details.trim().length < 3) { notify(locale === "ar" ? "اكتب تفاصيل سبب الإلغاء." : "Enter cancellation details.", "error"); return; }
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
    <div className="portal-toolbar"><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">{locale === "ar" ? "كل الحالات" : "All statuses"}</option><option value="pending_merchant_confirmation">{locale === "ar" ? "بانتظار تأكيد المتجر" : "Awaiting store confirmation"}</option><option value="confirmed">{locale === "ar" ? "مؤكد" : "Confirmed"}</option><option value="cancelled_by_merchant">{locale === "ar" ? "ملغي من المتجر" : "Cancelled by store"}</option></select><span className="toolbar-count">{visible.length}</span></div>
    {visible.length === 0 ? <EmptyState icon="receipt" title={locale === "ar" ? "لا توجد طلبات" : "No orders"} body={locale === "ar" ? "تظهر الطلبات هنا بعد قبول عرض مرتبط بالمتجر." : "Orders appear here after an offer linked to the store is accepted."}/> : <div className="portal-table-wrap"><table className="portal-table"><thead><tr><th>{locale === "ar" ? "رقم الطلب" : "Order"}</th><th>{locale === "ar" ? "الحالة" : "Status"}</th><th>{locale === "ar" ? "القيمة" : "Amount"}</th><th>{locale === "ar" ? "موعد التأكيد" : "Confirmation deadline"}</th><th>{locale === "ar" ? "قرار المشتري" : "Buyer decision"}</th><th/></tr></thead><tbody>{visible.map((order) => <tr key={text(order.id)} data-record-id={text(order.id)} data-order-id={text(order.order_id)}><td><strong>#{text(order.order_id).slice(0, 8)}</strong><small>{dateLabel(order.created_at, locale)}</small></td><td><StatusBadge value={order.status} locale={locale}/></td><td>{money(order.subtotal_snapshot, currency, locale)}</td><td>{dateLabel(order.confirmation_deadline, locale)}</td><td>{statusLabel(order.buyer_decision || "undecided", locale)}</td><td><button className="button secondary compact" type="button" onClick={() => { setSelected(order); setCancelMode(false); }}>{locale === "ar" ? "التفاصيل" : "Details"}</button></td></tr>)}</tbody></table></div>}
  </PortalPanel>

  {selected ? <div className="portal-modal-backdrop" role="presentation"><section className="portal-modal wide" role="dialog" aria-modal="true"><header><div><span className="eyebrow"><Icon name="receipt" size={17}/>{locale === "ar" ? "تفاصيل الطلب" : "Order details"}</span><h2>#{text(selected.order_id).slice(0, 12)}</h2></div><button className="icon-button" type="button" onClick={() => setSelected(null)}><Icon name="close"/></button></header><div className="portal-two-columns order-detail-grid"><div><div className="detail-list"><div><span>{locale === "ar" ? "الحالة" : "Status"}</span><StatusBadge value={selected.status} locale={locale}/></div><div><span>{locale === "ar" ? "الإجمالي" : "Total"}</span><strong>{money(selected.subtotal_snapshot, currency, locale)}</strong></div><div><span>{locale === "ar" ? "موعد التأكيد" : "Confirmation deadline"}</span><strong>{dateLabel(selected.confirmation_deadline, locale)}</strong></div><div><span>{locale === "ar" ? "وقت التأكيد" : "Confirmed at"}</span><strong>{dateLabel(selected.confirmed_at, locale)}</strong></div></div>{(() => { const buyer = buyerMap.get(text(selected.order_id)); return buyer ? <div className="buyer-card"><span><Icon name="users"/></span><div><strong>{text(buyer.full_name || buyer.buyer_name, locale === "ar" ? "المشتري" : "Buyer")}</strong><p>{text(buyer.mobile || buyer.phone)}</p></div></div> : null; })()}</div><div><h3>{locale === "ar" ? "بنود الطلب" : "Order items"}</h3><div className="order-items">{rows(selected.items).map((item) => <article key={text(item.id)}><div><strong>{text(item.matched_name_snapshot || item.requested_name_snapshot)}</strong><small>{numberValue(item.quantity_snapshot)} {text(item.unit_snapshot)}</small></div><span>{money(item.line_total_snapshot || (numberValue(item.unit_price_snapshot) * numberValue(item.quantity_snapshot)), currency, locale)}</span></article>)}</div></div></div>{chat ? <section className="order-chat-box"><header><div><strong>{locale === "ar" ? "محادثة العميل" : "Buyer chat"}</strong><small>{locale === "ar" ? "متزامنة مع تطبيق سعرلي" : "Synced with the Saarly app"}</small></div><button className="button text-button" type="button" onClick={() => setChat(null)}>{locale === "ar" ? "إخفاء" : "Hide"}</button></header><div className="chat-messages">{chat.messages.length ? chat.messages.map((message) => { const mine = text(message.sender_user_id) === payload.account.userId; return <article className={mine ? "mine" : "theirs"} key={text(message.id)}><p>{text(message.body)}</p><small>{dateLabel(message.created_at, locale)}</small></article>; }) : <p className="muted-copy">{locale === "ar" ? "ابدأ المحادثة برسالة واضحة للعميل." : "Start with a clear message to the buyer."}</p>}</div><div className="chat-composer"><textarea rows={2} value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} placeholder={locale === "ar" ? "اكتب رسالتك..." : "Write your message..."}/><button className="button primary compact" type="button" disabled={saving || !chatMessage.trim()} onClick={() => void sendChat()}><Icon name="arrow" size={17}/>{locale === "ar" ? "إرسال" : "Send"}</button></div></section> : null}{cancelMode ? <div className="cancel-box"><label>{locale === "ar" ? "سبب الإلغاء" : "Cancellation reason"}<select value={reason} onChange={(event) => setReason(event.target.value)}><option value="unavailable_items">{locale === "ar" ? "بعض البنود غير متاحة" : "Items unavailable"}</option><option value="pricing_error">{locale === "ar" ? "خطأ في التسعير" : "Pricing error"}</option><option value="capacity">{locale === "ar" ? "تعذر التنفيذ حاليًا" : "Cannot fulfil now"}</option><option value="other">{locale === "ar" ? "سبب آخر" : "Other"}</option></select></label><label>{locale === "ar" ? "التفاصيل" : "Details"}<textarea rows={3} minLength={3} value={details} onChange={(event) => setDetails(event.target.value)}/></label></div> : null}<footer className="modal-actions">{["pending_merchant_confirmation", "pending"].includes(text(selected.status)) ? <>{cancelMode ? <button className="button secondary" type="button" onClick={() => setCancelMode(false)}>{locale === "ar" ? "رجوع" : "Back"}</button> : <button className="button danger-button" type="button" onClick={() => setCancelMode(true)}>{locale === "ar" ? "إلغاء الطلب" : "Cancel order"}</button>}<button className="button primary" type="button" disabled={saving} onClick={() => void update(cancelMode ? "cancelled_by_merchant" : "confirmed")}>{saving ? (locale === "ar" ? "جارٍ الحفظ" : "Saving") : cancelMode ? (locale === "ar" ? "تأكيد الإلغاء" : "Confirm cancellation") : (locale === "ar" ? "تأكيد الطلب" : "Confirm order")}</button></> : <><button className="button secondary" type="button" onClick={() => setSelected(null)}>{locale === "ar" ? "إغلاق" : "Close"}</button>{["confirmed", "completed"].includes(text(selected.status)) || text(selected.buyer_decision) === "accepted" ? <button className="button primary" type="button" disabled={saving} onClick={() => void openChat()}><Icon name="quote" size={18}/>{locale === "ar" ? "محادثة العميل" : "Buyer chat"}</button> : null}</>}</footer></section></div> : null}
  </div>;
}
