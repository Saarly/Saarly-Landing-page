"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { buyerPost } from "@/components/buyer/portal-client";
import { EmptyState, Notice, PortalPanel, StatusBadge } from "@/components/merchant/portal-ui";
import { dateLabel, money, numberValue, row, rows, text, type PortalRow } from "@/components/merchant/portal-utils";
import type { BuyerSectionProps } from "@/components/buyer/section-props";

type OrderFilter = "active" | "history" | "all";

const historyStatuses = new Set(["cancelled", "completed", "expired"]);

export function BuyerOrdersSection({ payload, locale, refresh, notify }: BuyerSectionProps) {
  const orders = rows(payload.data.orders);
  const currency = payload.account.currencyCode || text(payload.data.currencyCode, "EGP");
  const [filter, setFilter] = useState<OrderFilter>("active");
  const [busyId, setBusyId] = useState("");
  const [chat, setChat] = useState<{ order: PortalRow; merchant: PortalRow; conversationId: string; messages: PortalRow[] } | null>(null);
  const [message, setMessage] = useState("");
  const [review, setReview] = useState<{ orderId: string; merchantId: string; storeName: string; stars: number; comment: string } | null>(null);
  const [payment, setPayment] = useState<PortalRow | null>(null);

  const visibleOrders = useMemo(() => orders.filter((order) => {
    const isHistory = historyStatuses.has(text(order.status));
    if (filter === "all") return true;
    return filter === "history" ? isHistory : !isHistory;
  }), [orders, filter]);

  async function orderAction(action: string, orderId: string) {
    setBusyId(`${action}:${orderId}`);
    try {
      await buyerPost(action, { orderId });
      notify(locale === "ar" ? "تم تحديث الطلب." : "The order was updated.", "success");
      await refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "order_action_failed", "error");
    } finally { setBusyId(""); }
  }

  async function openPayment(orderId: string) {
    setBusyId(`payment:${orderId}`);
    try {
      setPayment(row(await buyerPost("order_payment_dashboard", { orderId })));
    } catch (error) {
      notify(error instanceof Error ? error.message : "payment_dashboard_failed", "error");
    } finally { setBusyId(""); }
  }

  async function openChat(order: PortalRow, merchant: PortalRow) {
    const orderId = text(order.id);
    const merchantId = text(merchant.merchant_id || merchant.id);
    if (!orderId || !merchantId) return;
    setBusyId(`chat:${orderId}:${merchantId}`);
    try {
      const result = row(await buyerPost("open_order_chat", { orderId, merchantId }));
      setChat({ order, merchant, conversationId: text(result.conversationId), messages: rows(result.messages) });
    } catch (error) {
      notify(error instanceof Error ? error.message : "chat_available_after_acceptance", "error");
    } finally { setBusyId(""); }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!chat || !message.trim()) return;
    try {
      await buyerPost("send_order_chat_message", { conversationId: chat.conversationId, message });
      const result = row(await buyerPost("open_order_chat", {
        orderId: text(chat.order.id),
        merchantId: text(chat.merchant.merchant_id || chat.merchant.id),
      }));
      setChat({ ...chat, conversationId: text(result.conversationId), messages: rows(result.messages) });
      setMessage("");
    } catch (error) {
      notify(error instanceof Error ? error.message : "message_send_failed", "error");
    }
  }

  async function submitReview(event: FormEvent) {
    event.preventDefault();
    if (!review) return;
    setBusyId(`review:${review.orderId}:${review.merchantId}`);
    try {
      await buyerPost("submit_review", review);
      notify(locale === "ar" ? "تم حفظ تقييمك." : "Your review was saved.", "success");
      setReview(null);
      await refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "review_save_failed", "error");
    } finally { setBusyId(""); }
  }

  return <div className="portal-section-stack">
    <Notice tone="info" title={locale === "ar" ? "معلومات الطلب للقراءة فقط" : "Order information is read-only"}>
      {locale === "ar"
        ? "الموقع يعرض حالة الطلب والمستحقات والتواصل فقط. لا توجد وسيلة دفع أو دعوة للشراء داخل بوابة المشتري."
        : "The portal only shows order status, amounts, and contact details. There is no buyer payment or purchase prompt inside Saarly."}
    </Notice>

    <PortalPanel
      title={locale === "ar" ? `طلباتي المقبولة (${orders.length})` : `Accepted orders (${orders.length})`}
      subtitle={locale === "ar" ? "تابع تأكيد كل متجر والبنود والتواصل والمحادثة والتقييم." : "Track store confirmations, items, communication, chat, and reviews."}
      action={<div className="portal-subtabs compact-tabs"><button className={filter === "active" ? "active" : ""} onClick={() => setFilter("active")}>{locale === "ar" ? "الجارية" : "Active"}</button><button className={filter === "history" ? "active" : ""} onClick={() => setFilter("history")}>{locale === "ar" ? "السجل" : "History"}</button><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>{locale === "ar" ? "الكل" : "All"}</button></div>}
    >
      {visibleOrders.length ? <div className="buyer-order-list">{visibleOrders.map((order) => {
        const id = text(order.id);
        const fulfillments = rows(order.fulfillments);
        const merchants = rows(order.merchant_details);
        const orderReviews = rows(order.reviews);
        return <article className="buyer-order-card" key={id} data-record-id={id}>
          <header><div><strong>{locale === "ar" ? `طلب #${id.slice(0, 8)}` : `Order #${id.slice(0, 8)}`}</strong><small>{dateLabel(order.accepted_at || order.created_at, locale)}</small></div><div className="inline-actions"><StatusBadge value={order.status} locale={locale}/><StatusBadge value={order.confirmation_progress} locale={locale}/></div></header>
          {fulfillments.map((fulfillment) => {
            const merchantId = text(fulfillment.merchant_id);
            const merchant = merchants.find((item) => text(item.merchant_id) === merchantId) ?? {};
            const existingReview = orderReviews.find((item) => text(item.merchant_id) === merchantId) ?? {};
            const items = rows(fulfillment.order_fulfillment_items);
            return <section className="order-merchant-block" key={text(fulfillment.id)}>
              <div className="order-merchant-head"><div><strong>{text(merchant.store_name, locale === "ar" ? "المتجر" : "Store")}</strong><small>{text(merchant.branch_name || merchant.city_name || merchant.governorate_name)}</small></div><StatusBadge value={fulfillment.status} locale={locale}/></div>
              <div className="order-lines">{items.map((item) => <div key={text(item.id)}><span>{text(item.matched_name_snapshot || item.requested_name_snapshot)} × {numberValue(item.quantity_snapshot)} {text(item.unit_snapshot)}</span><strong>{money(item.line_total_snapshot, currency, locale)}</strong></div>)}</div>
              <div className="order-total"><span>{locale === "ar" ? "إجمالي المتجر" : "Store subtotal"}</span><strong>{money(fulfillment.subtotal_snapshot, currency, locale)}</strong></div>
              {text(merchant.contact_mobile || merchant.manager_mobile) ? <div className="contact-strip"><Icon name="phone"/><span dir="ltr">{text(merchant.contact_mobile || merchant.manager_mobile)}</span><a className="button secondary compact" href={`tel:${encodeURIComponent(text(merchant.contact_mobile || merchant.manager_mobile))}`}>{locale === "ar" ? "اتصال" : "Call"}</a></div> : null}
              <div className="inline-actions"><button className="button secondary compact" disabled={busyId.startsWith(`chat:${id}`)} onClick={() => void openChat(order, merchant)}><Icon name="quote"/>{locale === "ar" ? "المحادثة" : "Chat"}</button><button className="button secondary compact" onClick={() => setReview({ orderId: id, merchantId, storeName: text(merchant.store_name), stars: numberValue(existingReview.stars, 5), comment: text(existingReview.comment) })}><Icon name="check"/>{locale === "ar" ? (text(existingReview.id) ? "تعديل التقييم" : "تقييم المتجر") : (text(existingReview.id) ? "Edit review" : "Review store")}</button></div>
            </section>;
          })}
          <footer><button className="button secondary compact" disabled={busyId === `payment:${id}`} onClick={() => void openPayment(id)}><Icon name="info"/>{locale === "ar" ? "حالة المستحقات" : "Payment status"}</button>{["awaiting_confirmation", "pending_merchant_confirmation"].includes(text(order.status)) ? <button className="button danger-button compact" disabled={busyId === `cancel_order:${id}`} onClick={() => void orderAction("cancel_order", id)}>{locale === "ar" ? "إلغاء الطلب" : "Cancel order"}</button> : null}{historyStatuses.has(text(order.status)) ? <button className="button danger-button compact" disabled={busyId === `delete_order:${id}`} onClick={() => void orderAction("delete_order", id)}>{locale === "ar" ? "حذف من السجل" : "Remove from history"}</button> : null}</footer>
        </article>;
      })}</div> : <EmptyState icon="receipt" title={filter === "history" ? (locale === "ar" ? "سجل الطلبات فاضي" : "Order history is empty") : (locale === "ar" ? "لسه مفيش طلبات مقبولة" : "No accepted orders yet")} body={locale === "ar" ? "لما توافق على عرض أو رد متجر هيظهر الطلب هنا." : "Orders appear here after accepting an offer or store response."}/>} 
    </PortalPanel>

    {payment ? <div className="portal-modal-backdrop"><section className="portal-modal compact-modal"><header><div><span className="eyebrow"><Icon name="info"/>{locale === "ar" ? "حالة المستحقات" : "Payment status"}</span><h2>{text(payment.merchant_name, locale === "ar" ? "تفاصيل الطلب" : "Order details")}</h2></div><button className="icon-button" onClick={() => setPayment(null)}><Icon name="close"/></button></header><Notice tone="info">{locale === "ar" ? "البيانات دي للقراءة فقط، ولا يوجد دفع داخل الموقع." : "This information is read-only. No payment is processed on the website."}</Notice><div className="detail-list"><div><span>{locale === "ar" ? "حالة الطلب" : "Order status"}</span><StatusBadge value={payment.order_status} locale={locale}/></div><div><span>{locale === "ar" ? "حالة الدفع" : "Payment status"}</span><StatusBadge value={payment.payment_status} locale={locale}/></div><div><span>{locale === "ar" ? "القيمة الظاهرة" : "Displayed amount"}</span><strong>{money(payment.amount, text(payment.currency, currency), locale)}</strong></div></div><div className="modal-actions"><button className="button primary" onClick={() => setPayment(null)}>{locale === "ar" ? "تم" : "Done"}</button></div></section></div> : null}

    {chat ? <div className="portal-modal-backdrop"><section className="portal-modal chat-modal"><header><div><span className="eyebrow"><Icon name="quote"/>{locale === "ar" ? "محادثة الطلب" : "Order chat"}</span><h2>{text(chat.merchant.store_name, locale === "ar" ? "المتجر" : "Store")}</h2></div><button className="icon-button" onClick={() => setChat(null)}><Icon name="close"/></button></header><div className="chat-thread">{chat.messages.length ? chat.messages.map((item) => <article className={text(item.sender_user_id) === payload.account.userId ? "mine" : "theirs"} key={text(item.id)}><p>{text(item.body)}</p><small>{dateLabel(item.created_at, locale)}</small></article>) : <EmptyState icon="quote" title={locale === "ar" ? "ابدأ المحادثة" : "Start the conversation"} body={locale === "ar" ? "اكتب رسالة للمتجر بخصوص الطلب المقبول." : "Message the store about the accepted order."}/>}</div><form className="chat-composer" onSubmit={sendMessage}><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder={locale === "ar" ? "اكتب رسالتك" : "Write your message"}/><button className="button primary" disabled={!message.trim()}><Icon name="arrow"/>{locale === "ar" ? "إرسال" : "Send"}</button></form></section></div> : null}

    {review ? <div className="portal-modal-backdrop"><section className="portal-modal compact-modal"><header><div><span className="eyebrow"><Icon name="check"/>{locale === "ar" ? "تقييم المتجر" : "Store review"}</span><h2>{review.storeName}</h2></div><button className="icon-button" onClick={() => setReview(null)}><Icon name="close"/></button></header><form className="portal-form" onSubmit={submitReview}><label>{locale === "ar" ? "عدد النجوم" : "Stars"}<select value={review.stars} onChange={(event) => setReview({ ...review, stars: Number(event.target.value) })}>{[5,4,3,2,1].map((stars) => <option key={stars} value={stars}>{"★".repeat(stars)} ({stars})</option>)}</select></label><label>{locale === "ar" ? "تعليقك" : "Comment"}<textarea rows={4} maxLength={1000} value={review.comment} onChange={(event) => setReview({ ...review, comment: event.target.value })}/></label><div className="modal-actions"><button className="button secondary" type="button" onClick={() => setReview(null)}>{locale === "ar" ? "إلغاء" : "Cancel"}</button><button className="button primary" disabled={busyId === `review:${review.orderId}:${review.merchantId}`}>{locale === "ar" ? "حفظ التقييم" : "Save review"}</button></div></form></section></div> : null}
  </div>;
}
