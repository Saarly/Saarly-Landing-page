"use client";

import { Icon } from "@/components/icons";
import { MetricCard, Notice, PortalPanel, StatusBadge } from "@/components/merchant/portal-ui";
import { bool, dateLabel, row, statusLabel, text } from "@/components/merchant/portal-utils";
import type { SectionProps } from "@/components/merchant/section-props";

export function AccountStatusSection({ payload, locale }: SectionProps) {
  const status = row(payload.data.status || payload.data);
  const merchant = payload.account.merchant;
  const approval = text(merchant.approval_status, "pending");
  const access = text(status.access_status, approval === "approved" ? "pre_launch_access" : approval);
  const canReceiveWork = bool(status.can_receive_new_work, bool(status.can_receive_orders, approval === "approved"));
  const canReceiveOrders = bool(status.can_receive_orders, canReceiveWork);
  const stopReason = text(status.stop_reason || merchant.rejection_reason);
  const accessEnd = status.access_ends_at || status.free_trial_ends_at || status.grace_period_ends_at;
  const planName = text(locale === "ar" ? status.plan_name_ar || status.active_plan_name_ar : status.plan_name_en || status.active_plan_name_en);

  return (
    <div className="portal-section-stack">
      <Notice tone={canReceiveWork ? "success" : "warning"} title={locale === "ar" ? "حالة استقبال العمل" : "Work receiving status"}>
        {canReceiveWork
          ? (locale === "ar" ? "متجرك يستطيع استقبال طلبات وتسعيرات جديدة حسب حالة الاعتماد الحالية." : "Your store can receive new orders and quote requests according to its current approval status.")
          : (stopReason || (locale === "ar" ? "استقبال الطلبات متوقف حاليًا. راجع السبب أو تواصل مع دعم سعرلي." : "Receiving new work is currently paused. Review the reason or contact Saarly support."))}
      </Notice>

      <div className="metrics-grid">
        <MetricCard icon="shield" label={locale === "ar" ? "حالة الوصول" : "Access status"} value={statusLabel(access, locale)} note={planName || statusLabel(approval, locale)}/>
        <MetricCard icon="quote" label={locale === "ar" ? "طلبات التسعير" : "Quote requests"} value={canReceiveWork ? (locale === "ar" ? "متاحة" : "Available") : (locale === "ar" ? "متوقفة" : "Paused")} tone={canReceiveWork ? "green" : "gold"}/>
        <MetricCard icon="receipt" label={locale === "ar" ? "طلبات الشراء" : "Purchase orders"} value={canReceiveOrders ? (locale === "ar" ? "متاحة" : "Available") : (locale === "ar" ? "متوقفة" : "Paused")} tone={canReceiveOrders ? "green" : "gold"}/>
        <MetricCard icon="clock" label={locale === "ar" ? "نهاية الفترة الحالية" : "Current period ends"} value={dateLabel(accessEnd, locale)} tone="gray"/>
      </div>

      <PortalPanel title={locale === "ar" ? "تفاصيل حالة الحساب" : "Account status details"} subtitle={locale === "ar" ? "البيانات هنا للمتابعة فقط. اشتراك سعرلي وطلبات التحويل موجودة في صفحة الاشتراكات والدفع على الويب." : "This page is read-only. Saarly subscription and transfer requests live in the web subscriptions and payments page."}>
        <div className="detail-list">
          <div><span>{locale === "ar" ? "اعتماد المتجر" : "Store approval"}</span><StatusBadge value={approval} locale={locale}/></div>
          <div><span>{locale === "ar" ? "حالة الحساب" : "Account status"}</span><StatusBadge value={access} locale={locale}/></div>
          <div><span>{locale === "ar" ? "نظام المتجر" : "Store mode"}</span><strong>{statusLabel(status.pricing_mode || merchant.pricing_mode, locale)}</strong></div>
          <div><span>{locale === "ar" ? "استقبال طلبات جديدة" : "Receiving new work"}</span><strong>{canReceiveWork ? (locale === "ar" ? "نعم" : "Yes") : (locale === "ar" ? "لا" : "No")}</strong></div>
          <div><span>{locale === "ar" ? "استقبال طلبات الشراء" : "Receiving purchase orders"}</span><strong>{canReceiveOrders ? (locale === "ar" ? "نعم" : "Yes") : (locale === "ar" ? "لا" : "No")}</strong></div>
          <div><span>{locale === "ar" ? "سبب التوقف" : "Pause reason"}</span><strong>{stopReason || (locale === "ar" ? "لا يوجد سبب مسجل" : "No recorded reason")}</strong></div>
        </div>
      </PortalPanel>

      <PortalPanel title={locale === "ar" ? "ما الذي يحدث عند تغير الحالة؟" : "What changes when status changes?"}>
        <div className="settings-links">
          <div className="settings-link-static"><Icon name="quote"/><span><strong>{locale === "ar" ? "طلبات التسعير" : "Quote requests"}</strong><small>{locale === "ar" ? "عند إتاحة الاستقبال تظهر طلبات العملاء الجديدة في صفحة التسعير." : "When receiving is available, new buyer requests appear in the requests page."}</small></span></div>
          <div className="settings-link-static"><Icon name="receipt"/><span><strong>{locale === "ar" ? "طلبات الشراء من العملاء" : "Buyer purchase orders"}</strong><small>{locale === "ar" ? "طلبات شراء المنتجات من المتجر تظل جزءًا من Saarly ولا يتم خلطها مع اشتراك المتجر في سعرلي." : "Buyer purchases from stores remain part of Saarly and are not mixed with merchant subscriptions to Saarly."}</small></span></div>
          <div className="settings-link-static"><Icon name="mail"/><span><strong>{locale === "ar" ? "الدعم" : "Support"}</strong><small>{locale === "ar" ? "لو الحالة غير واضحة، افتح دعم سعرلي من صفحة الدعم بنفس الحساب." : "If the status is unclear, open Saarly support from the support page with the same account."}</small></span></div>
        </div>
      </PortalPanel>
    </div>
  );
}
