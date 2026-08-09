"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { EmptyState, Notice, StatusBadge } from "@/components/merchant/portal-ui";
import { dateLabel, numberValue, row, rows, text, type PortalRow } from "@/components/merchant/portal-utils";

type PostFn = (action: string, data?: PortalRow) => Promise<unknown>;
type Props = {
  data: PortalRow;
  locale: "ar" | "en";
  post: PostFn;
  notify: (message: string, tone?: "success" | "error" | "info") => void;
};

function ratingOf(conversation: PortalRow) {
  const relation = conversation.support_conversation_ratings;
  if (Array.isArray(relation) && relation.length) return row(relation[0]);
  return row(relation);
}

function supportStatusCopy(status: string, locale: "ar" | "en") {
  if (status === "transferred") return locale === "ar" ? "مع فريق خدمة العملاء" : "With customer support";
  if (status === "closed") return locale === "ar" ? "تم إنهاء الشكوى" : "Complaint closed";
  return locale === "ar" ? "المساعد الآلي متاح" : "AI assistant available";
}

export function SupportWorkspace({ data, locale, post, notify }: Props) {
  const [bundle, setBundle] = useState<PortalRow>(data);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [ratingOpen, setRatingOpen] = useState(false);
  const [stars, setStars] = useState(5);
  const [sentiment, setSentiment] = useState<"positive" | "negative">("positive");
  const [comment, setComment] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => setBundle(data), [data]);

  const conversation = row(bundle.conversation);
  const messages = rows(bundle.messages);
  const conversations = rows(bundle.conversations);
  const status = text(conversation.status, "bot");
  const rating = ratingOf(conversation);
  const activeId = text(conversation.id);
  const hasOpenConversation = useMemo(() => conversations.some((item) => text(item.status) !== "closed"), [conversations]);

  useEffect(() => {
    if (typeof endRef.current?.scrollIntoView === "function") endRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, activeId]);

  function apply(result: unknown) {
    const next = row(result);
    if (Object.keys(next).length) setBundle(next);
  }

  async function loadConversation(id: string) {
    if (!id || id === activeId) return;
    setBusy(`load:${id}`);
    try { apply(await post("load_support_conversation", { conversationId: id })); }
    catch (error) { notify(error instanceof Error ? error.message : "support_load_failed", "error"); }
    finally { setBusy(""); }
  }

  async function createConversation(event: FormEvent) {
    event.preventDefault();
    const title = newTitle.trim();
    if (title.length < 15) {
      notify(locale === "ar" ? "اكتب عنوانًا واضحًا من 15 حرفًا على الأقل." : "Enter a clear title of at least 15 characters.", "error");
      return;
    }
    setBusy("create");
    try {
      apply(await post("create_support_conversation", { title, locale }));
      setNewTitle(""); setCreateOpen(false);
      notify(locale === "ar" ? "تم إنشاء شكوى جديدة." : "A new complaint was created.", "success");
    } catch (error) { notify(error instanceof Error ? error.message : "support_create_failed", "error"); }
    finally { setBusy(""); }
  }

  async function send(event?: FormEvent, quickMessage?: string) {
    event?.preventDefault();
    const body = (quickMessage ?? message).trim();
    if (!body || !activeId || status === "closed") return;
    setBusy("send");
    try {
      apply(await post("send_support_message", { conversationId: activeId, message: body, locale }));
      setMessage("");
    } catch (error) { notify(error instanceof Error ? error.message : "support_send_failed", "error"); }
    finally { setBusy(""); }
  }

  async function transfer() {
    if (!activeId || status === "closed" || status === "transferred") return;
    setBusy("transfer");
    try {
      apply(await post("transfer_support", { conversationId: activeId, reason: "requested_by_web_portal" }));
      notify(locale === "ar" ? "جاري التحويل لخدمة العملاء. متوسط الانتظار من 3 إلى 5 دقائق." : "Transferring to customer support. Typical wait time is 3–5 minutes.", "success");
    } catch (error) { notify(error instanceof Error ? error.message : "support_transfer_failed", "error"); }
    finally { setBusy(""); }
  }

  async function closeConversation() {
    if (!activeId || status === "closed") return;
    if (!window.confirm(locale === "ar" ? "إنهاء هذه المحادثة؟ يمكنك الرجوع لها لاحقًا من سجل الشكاوى." : "End this conversation? It will remain in your complaint history.")) return;
    setBusy("close");
    try {
      apply(await post("close_support_conversation", { conversationId: activeId }));
      setRatingOpen(true);
      notify(locale === "ar" ? "تم إنهاء المحادثة." : "Conversation closed.", "success");
    } catch (error) { notify(error instanceof Error ? error.message : "support_close_failed", "error"); }
    finally { setBusy(""); }
  }

  async function submitRating(event: FormEvent) {
    event.preventDefault();
    if (!activeId) return;
    setBusy("rating");
    try {
      apply(await post("rate_support_conversation", { conversationId: activeId, stars, sentiment, comment }));
      setRatingOpen(false);
      notify(locale === "ar" ? "شكرًا، تم حفظ تقييمك." : "Thanks, your rating was saved.", "success");
    } catch (error) { notify(error instanceof Error ? error.message : "support_rating_failed", "error"); }
    finally { setBusy(""); }
  }

  return <div className="support-workspace-v2">
    <aside className="support-inbox-v2">
      <header>
        <div><span className="eyebrow"><Icon name="quote"/>{locale === "ar" ? "صندوق الدعم" : "Support inbox"}</span><h2>{locale === "ar" ? "الشكاوى والمحادثات" : "Complaints & conversations"}</h2></div>
        <button className="button primary compact" type="button" disabled={busy === "create" || hasOpenConversation} onClick={() => setCreateOpen(true)}><Icon name="plus" size={17}/>{hasOpenConversation ? (locale === "ar" ? "شكوى مفتوحة" : "Open complaint") : (locale === "ar" ? "شكوى جديدة" : "New complaint")}</button>
      </header>
      <p className="support-inbox-hint">{locale === "ar" ? "تابع نفس محادثات الدعم الموجودة في التطبيق، وافتح أي شكوى سابقة أو قيّم المحادثات المغلقة." : "Continue the same support conversations from the app, reopen history, and rate closed conversations."}</p>
      <div className="support-conversation-list">
        {conversations.length ? conversations.map((item) => {
          const itemId = text(item.id); const itemRating = ratingOf(item); const isActive = itemId === activeId;
          return <button className={isActive ? "active" : ""} type="button" key={itemId} onClick={() => void loadConversation(itemId)} disabled={busy === `load:${itemId}`}>
            <span className={`support-list-icon ${text(item.status)}`}><Icon name={text(item.status) === "closed" ? "check" : text(item.status) === "transferred" ? "users" : "quote"} size={18}/></span>
            <span className="support-list-copy"><strong>{text(item.title, locale === "ar" ? "شكوى دعم" : "Support complaint")}</strong><small>{dateLabel(item.last_message_at || item.updated_at || item.created_at, locale)}</small></span>
            <span className="support-list-meta"><StatusBadge value={item.status} locale={locale}/>{numberValue(itemRating.stars) > 0 ? <small className="support-mini-rating">★ {numberValue(itemRating.stars)}</small> : null}</span>
          </button>;
        }) : <EmptyState icon="quote" title={locale === "ar" ? "لا توجد شكاوى" : "No complaints"} body={locale === "ar" ? "ابدأ شكوى بعنوان واضح وسيظهر سجلها هنا." : "Start a complaint with a clear title and its history will appear here."}/>} 
      </div>
    </aside>

    <section className="support-chat-v2">
      <header className="support-chat-v2-head">
        <div><span className="support-chat-avatar"><Icon name={status === "transferred" ? "users" : "quote"}/></span><div><h2>{text(conversation.title, locale === "ar" ? "دعم سعرلي" : "Saarly support")}</h2><p>{supportStatusCopy(status, locale)} · {dateLabel(conversation.updated_at || conversation.created_at, locale)}</p></div></div>
        <div className="inline-actions"><StatusBadge value={status} locale={locale}/>{status !== "closed" && status !== "transferred" ? <button className="button secondary compact" disabled={Boolean(busy)} type="button" onClick={() => void transfer()}><Icon name="users" size={17}/>{locale === "ar" ? "موظف دعم" : "Human support"}</button> : null}{status !== "closed" ? <button className="button tertiary compact" disabled={Boolean(busy)} type="button" onClick={() => void closeConversation()}>{locale === "ar" ? "إنهاء" : "End"}</button> : null}</div>
      </header>

      {status === "transferred" ? <Notice tone="info">{locale === "ar" ? "جاري التحويل لخدمة العملاء. الرجاء الانتظار من 3 إلى 5 دقائق، وتقدر تكمّل كتابة رسائلك هنا." : "You are being transferred to customer support. Please allow 3–5 minutes; you can keep writing here."}</Notice> : null}
      {status === "closed" ? <Notice tone="success">{locale === "ar" ? "تم إغلاق هذه الشكوى. تقدر تقيم الدعم أو تختار محادثة تانية من السجل." : "This complaint is closed. You can rate support or choose another conversation from history."}</Notice> : null}

      <div className="support-messages-v2">
        {messages.length ? messages.map((item) => {
          const sender = text(item.sender_type, "system");
          const mine = sender === "user";
          return <article className={`support-message-v2 ${mine ? "mine" : sender}`} key={text(item.id)}>
            <div className="support-message-meta"><strong>{mine ? (locale === "ar" ? "أنت" : "You") : sender === "bot" ? (locale === "ar" ? "مساعد سعرلي" : "Saarly assistant") : sender === "support" ? (locale === "ar" ? "خدمة العملاء" : "Customer support") : (locale === "ar" ? "سعرلي" : "Saarly")}</strong><small>{dateLabel(item.created_at, locale)}</small></div>
            <p>{text(item.body)}</p>
          </article>;
        }) : <div className="support-empty-prompt"><span><Icon name="quote" size={30}/></span><h3>{locale === "ar" ? "مرحبًا بك في دعم سعرلي" : "Welcome to Saarly support"}</h3><p>{locale === "ar" ? "اكتب استفسارك وسنحاول مساعدتك فورًا. لو محتاج تسأل عن طلبك، استخدم الاختصار تحت." : "Write your question and we’ll help right away. Use the quick prompt below to ask about an order."}</p><button className="button secondary" type="button" onClick={() => void send(undefined, locale === "ar" ? "أين طلبي؟" : "Where is my order?")} disabled={Boolean(busy)}>{locale === "ar" ? "أين طلبي؟" : "Where is my order?"}</button></div>}
        <div ref={endRef}/>
      </div>

      {status === "closed" ? <div className="support-closed-actions">{numberValue(rating.stars) > 0 ? <div className="support-existing-rating"><span>{"★".repeat(numberValue(rating.stars))}{"☆".repeat(Math.max(0, 5 - numberValue(rating.stars)))}</span><div><strong>{locale === "ar" ? "تم إرسال تقييمك" : "Your rating was submitted"}</strong>{text(rating.comment) ? <small>{text(rating.comment)}</small> : null}</div></div> : <button className="button primary" type="button" onClick={() => setRatingOpen(true)}><Icon name="check"/>{locale === "ar" ? "تقييم خدمة الدعم" : "Rate support"}</button>}</div> : <form className="support-composer-v2" onSubmit={(event) => void send(event)}><textarea value={message} maxLength={4000} onChange={(event) => setMessage(event.target.value)} placeholder={locale === "ar" ? (status === "transferred" ? "اكتب رسالتك لفريق خدمة العملاء..." : "اكتب استفسارك...") : (status === "transferred" ? "Write to customer support..." : "Write your question...")}/><div><small>{message.length}/4000</small><button className="button primary" disabled={busy === "send" || !message.trim()}>{busy === "send" ? (locale === "ar" ? "جارٍ الإرسال" : "Sending") : (locale === "ar" ? "إرسال" : "Send")}</button></div></form>}
    </section>

    {createOpen ? <div className="portal-modal-backdrop"><section className="portal-modal compact-dialog" role="dialog" aria-modal="true"><header><div><span className="eyebrow"><Icon name="plus"/>{locale === "ar" ? "شكوى جديدة" : "New complaint"}</span><h2>{locale === "ar" ? "إيه المشكلة اللي محتاج مساعدة فيها؟" : "What do you need help with?"}</h2><p>{locale === "ar" ? "اكتب عنوان واضح عشان تقدر ترجع للمحادثة بسهولة من السجل." : "Use a clear title so you can find this conversation easily later."}</p></div><button className="icon-button" type="button" onClick={() => setCreateOpen(false)}><Icon name="close"/></button></header><form className="portal-form" onSubmit={createConversation}><label>{locale === "ar" ? "عنوان الشكوى" : "Complaint title"}<input autoFocus minLength={15} maxLength={160} value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder={locale === "ar" ? "مثال: مشكلة في متابعة طلب تم قبوله" : "Example: Issue tracking an accepted order"}/><small>{locale === "ar" ? "15 حرف على الأقل" : "At least 15 characters"}</small></label><div className="modal-actions"><button className="button secondary" type="button" onClick={() => setCreateOpen(false)}>{locale === "ar" ? "إلغاء" : "Cancel"}</button><button className="button primary" disabled={busy === "create" || newTitle.trim().length < 15}>{busy === "create" ? (locale === "ar" ? "جارٍ الإنشاء" : "Creating") : (locale === "ar" ? "إنشاء وفتح المحادثة" : "Create & open chat")}</button></div></form></section></div> : null}

    {ratingOpen ? <div className="portal-modal-backdrop"><section className="portal-modal compact-dialog rating-dialog" role="dialog" aria-modal="true"><header><div><span className="eyebrow"><Icon name="check"/>{locale === "ar" ? "تقييم الدعم" : "Support rating"}</span><h2>{locale === "ar" ? "قيّم خدمة الدعم" : "Rate your support experience"}</h2><p>{locale === "ar" ? "تقييمك يساعدنا نطوّر الخدمة." : "Your feedback helps us improve support."}</p></div><button className="icon-button" type="button" onClick={() => setRatingOpen(false)}><Icon name="close"/></button></header><form className="portal-form" onSubmit={submitRating}><div className="support-star-picker" role="radiogroup" aria-label={locale === "ar" ? "عدد النجوم" : "Star rating"}>{[1,2,3,4,5].map((value) => <button type="button" key={value} className={value <= stars ? "active" : ""} onClick={() => setStars(value)} aria-label={`${value}`}>★</button>)}</div><div className="setting-options two"><button type="button" className={sentiment === "positive" ? "selected" : ""} onClick={() => setSentiment("positive")}><Icon name="check"/><strong>{locale === "ar" ? "إيجابي" : "Positive"}</strong></button><button type="button" className={sentiment === "negative" ? "selected" : ""} onClick={() => setSentiment("negative")}><Icon name="info"/><strong>{locale === "ar" ? "سلبي" : "Negative"}</strong></button></div><label>{locale === "ar" ? "تعليق اختياري" : "Optional comment"}<textarea maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)}/></label><div className="modal-actions"><button className="button secondary" type="button" onClick={() => setRatingOpen(false)}>{locale === "ar" ? "لاحقًا" : "Later"}</button><button className="button primary" disabled={busy === "rating"}>{busy === "rating" ? (locale === "ar" ? "جارٍ الحفظ" : "Saving") : (locale === "ar" ? "إرسال التقييم" : "Submit rating")}</button></div></form></section></div> : null}
  </div>;
}
