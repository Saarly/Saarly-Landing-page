import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerServiceClient, createServerUserClient } from "@/lib/supabase/server";

function text(value: unknown, max = 5000) {
  return String(value ?? "").trim().slice(0, max);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function queueSupportNotification(
  service: SupabaseClient,
  input: {
    targetTable: "chat_conversations" | "public_support_requests";
    targetId: string;
    userId: string | null;
    email: string;
    name: string;
    subject: string;
    message: string;
    locale: "ar" | "en";
  },
) {
  const recipient = process.env.SUPPORT_NOTIFICATION_EMAIL
    || process.env.NEXT_PUBLIC_SUPPORT_EMAIL
    || "info@saarly.app";
  const title = input.locale === "ar"
    ? `طلب دعم جديد: ${input.subject}`
    : `New support request: ${input.subject}`;
  const bodyText = [
    input.locale === "ar" ? "وصل طلب دعم جديد من موقع سعرلي." : "A new support request was submitted through the Saarly website.",
    `${input.locale === "ar" ? "الاسم" : "Name"}: ${input.name || "—"}`,
    `${input.locale === "ar" ? "البريد" : "Email"}: ${input.email}`,
    `${input.locale === "ar" ? "الموضوع" : "Subject"}: ${input.subject}`,
    "",
    input.message,
  ].join("\n");
  const bodyHtml = `<div dir="${input.locale === "ar" ? "rtl" : "ltr"}" style="font-family:Arial,sans-serif;line-height:1.8">`
    + `<h2>${escapeHtml(title)}</h2>`
    + `<p><strong>${input.locale === "ar" ? "الاسم" : "Name"}:</strong> ${escapeHtml(input.name || "—")}</p>`
    + `<p><strong>${input.locale === "ar" ? "البريد" : "Email"}:</strong> ${escapeHtml(input.email)}</p>`
    + `<p><strong>${input.locale === "ar" ? "الموضوع" : "Subject"}:</strong> ${escapeHtml(input.subject)}</p>`
    + `<hr><p>${escapeHtml(input.message).replaceAll("\n", "<br>")}</p></div>`;

  const { error } = await service.from("admin_email_events").upsert({
    event_type: "support_request_received",
    target_table: input.targetTable,
    target_id: input.targetId,
    merchant_id: null,
    user_id: input.userId,
    recipient_user_id: null,
    recipient_email: recipient,
    subject: title,
    body_text: bodyText,
    body_html: bodyHtml,
    status: "pending",
    attempts: 0,
    idempotency_key: `support-notification:${input.targetTable}:${input.targetId}`,
    payload: {
      source: "landing_page",
      requester_email: input.email,
      requester_name: input.name || null,
      locale: input.locale,
    },
    next_attempt_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "idempotency_key" });

  if (error) {
    console.error("support email queue failed", error);
    return false;
  }

  const dispatchSecret = process.env.EMAIL_DISPATCH_SECRET?.trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  if (dispatchSecret && supabaseUrl) {
    try {
      await fetch(`${supabaseUrl}/functions/v1/process-admin-email-events`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-saarly-dispatch-secret": dispatchSecret,
        },
        body: JSON.stringify({ limit: 20 }),
        cache: "no-store",
      });
    } catch (dispatchError) {
      console.error("support email dispatch trigger failed", dispatchError);
    }
  }

  return true;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const email = text(body.email, 320).toLowerCase();
    const name = text(body.name, 160);
    const subject = text(body.subject, 240);
    const message = text(body.message, 5000);
    const locale: "ar" | "en" = body.locale === "en" ? "en" : "ar";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "valid_email_required" }, { status: 400 });
    }
    if (subject.length < 3 || message.length < 10) {
      return NextResponse.json({ error: "support_message_incomplete" }, { status: 400 });
    }

    const service = createServerServiceClient();
    const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    let userId: string | null = null;

    if (token) {
      const userDb = createServerUserClient(token);
      const { data } = await userDb.auth.getUser(token);
      userId = data.user?.id ?? null;
      if (userId) {
        const { data: conversationId, error: startError } = await userDb.rpc("start_or_get_support_conversation", {
          p_title: subject,
          p_locale: locale,
        });
        if (!startError && conversationId) {
          const { error: sendError } = await userDb.rpc("send_support_message", {
            p_conversation_id: conversationId,
            p_body: message,
          });
          if (!sendError) {
            const emailQueued = await queueSupportNotification(service, {
              targetTable: "chat_conversations",
              targetId: String(conversationId),
              userId,
              email,
              name,
              subject,
              message,
              locale,
            });
            return NextResponse.json({ data: { conversationId, emailQueued } });
          }
        }
      }
    }

    const { data: requestId, error } = await service.rpc("portal_submit_public_support_request", {
      p_requester_user_id: userId,
      p_email: email,
      p_name: name || null,
      p_subject: subject,
      p_message: message,
      p_locale: locale,
      p_source: "landing_page",
      p_metadata: { user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null },
    });
    if (error) throw error;

    const emailQueued = await queueSupportNotification(service, {
      targetTable: "public_support_requests",
      targetId: String(requestId),
      userId,
      email,
      name,
      subject,
      message,
      locale,
    });
    return NextResponse.json({ data: { requestId, emailQueued } });
  } catch (error) {
    console.error("support request failed", error);
    return NextResponse.json({ error: "support_request_failed" }, { status: 500 });
  }
}
