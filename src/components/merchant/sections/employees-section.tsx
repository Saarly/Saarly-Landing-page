"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { portalPost } from "@/components/merchant/portal-client";
import { EmptyState, Notice, PortalPanel, StatusBadge } from "@/components/merchant/portal-ui";
import { bool, row, rows, text } from "@/components/merchant/portal-utils";
import type { SectionProps } from "@/components/merchant/section-props";

const permissionOptions = [
  { key: "dashboard", ar: "الملخص", en: "Dashboard" },
  { key: "orders", ar: "الطلبات", en: "Orders" },
  { key: "rfqs", ar: "التسعير اليدوي", en: "Manual RFQ" },
  { key: "products", ar: "المنتجات", en: "Products" },
  { key: "imports", ar: "استيراد المنتجات", en: "Imports" },
  { key: "branches", ar: "الفروع", en: "Branches" },
  { key: "hours", ar: "مواعيد العمل", en: "Working hours" },
  { key: "delivery", ar: "التوصيل", en: "Delivery" },
  { key: "reports", ar: "التقارير", en: "Reports" },
  { key: "billing", ar: "حالة الحساب", en: "Account status" },
  { key: "referrals", ar: "الدعوات", en: "Referrals" },
  { key: "buyer_mode", ar: "التصفح كمشتري", en: "Browse as buyer" },
  { key: "support", ar: "الدعم", en: "Support" },
  { key: "settings", ar: "الإعدادات", en: "Settings" },
];

const defaultPermissions: Record<string, boolean> = {
  dashboard: true,
  orders: true,
  rfqs: true,
  products: false,
  imports: false,
  branches: false,
  hours: false,
  delivery: false,
  reports: false,
  billing: false,
  referrals: false,
  buyer_mode: false,
  support: true,
  settings: false,
};

export function EmployeesSection({ payload, locale, refresh, notify }: SectionProps) {
  const employees = rows(payload.data.employees);
  const branches = rows(payload.data.branches);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ email: "", roleLabel: "", permissions: { ...defaultPermissions }, branchIds: [] as string[] });
  const isOwner = payload.account.isOwner;

  function togglePermission(key: string) { setForm((current) => ({ ...current, permissions: { ...current.permissions, [key]: !current.permissions[key] } })); }
  function toggleBranch(id: string) { setForm((current) => ({ ...current, branchIds: current.branchIds.includes(id) ? current.branchIds.filter((item) => item !== id) : [...current.branchIds, id] })); }

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    try {
      await portalPost("save_staff", form);
      notify(locale === "ar" ? "تم حفظ الموظف وصلاحياته." : "Staff member and permissions saved.", "success");
      setOpen(false); setForm({ email: "", roleLabel: "", permissions: { ...defaultPermissions }, branchIds: [] }); await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "save_failed", "error"); }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!window.confirm(locale === "ar" ? "هل تريد إيقاف وصول هذا الموظف؟" : "Disable access for this staff member?")) return;
    try { await portalPost("remove_staff", { id }); notify(locale === "ar" ? "تم إيقاف وصول الموظف." : "Staff access disabled.", "success"); await refresh(); }
    catch (error) { notify(error instanceof Error ? error.message : "remove_failed", "error"); }
  }

  return <div className="portal-section-stack">{!isOwner ? <Notice tone="warning">{locale === "ar" ? "إدارة الموظفين متاحة لصاحب المتجر فقط." : "Staff management is available only to the store owner."}</Notice> : null}<PortalPanel title={locale === "ar" ? "فريق المتجر" : "Store team"} subtitle={locale === "ar" ? "أضف موظفًا بالبريد المسجل في سعرلي وحدد الفروع والصلاحيات." : "Add a staff member using a Saarly account email and assign branches and permissions."} action={isOwner ? <button className="button primary compact" type="button" onClick={() => setOpen(true)}><Icon name="plus" size={18}/>{locale === "ar" ? "إضافة موظف" : "Add staff"}</button> : null}>
    {employees.length === 0 ? <EmptyState icon="users" title={locale === "ar" ? "لا يوجد موظفون" : "No staff members"} body={locale === "ar" ? "يستطيع صاحب المتجر إضافة الموظفين وتحديد نطاق وصولهم." : "The store owner can add staff and define their access scope."}/> : <div className="employee-grid">{employees.map((employee) => { const permissions = row(employee.permissions); return <article className="employee-card" key={text(employee.id)}><header><span className="avatar-placeholder">{text(employee.display_name || employee.email, "M").slice(0, 1).toUpperCase()}</span><div><h3>{text(employee.display_name || employee.email)}</h3><p>{text(employee.email)}</p></div><StatusBadge value={bool(employee.is_active, true) ? "active" : "suspended"} locale={locale}/></header><div className="permission-tags">{permissionOptions.filter((option) => permissions[option.key] === true).map((option) => <span key={option.key}>{locale === "ar" ? option.ar : option.en}</span>)}</div><small>{locale === "ar" ? `الدور: ${text(employee.role_label, "manager")}` : `Role: ${text(employee.role_label, "manager")}`}</small>{isOwner ? <button className="button danger-button compact full" type="button" onClick={() => void remove(text(employee.id))}>{locale === "ar" ? "إيقاف الوصول" : "Disable access"}</button> : null}</article>; })}</div>}
  </PortalPanel>

  {open ? <div className="portal-modal-backdrop" role="presentation"><section className="portal-modal" role="dialog" aria-modal="true"><header><div><span className="eyebrow"><Icon name="users" size={17}/>{locale === "ar" ? "موظف جديد" : "New staff member"}</span><h2>{locale === "ar" ? "الحساب والصلاحيات" : "Account and permissions"}</h2></div><button className="icon-button" type="button" onClick={() => setOpen(false)}><Icon name="close"/></button></header><form className="portal-form" onSubmit={submit}><label>{locale === "ar" ? "البريد الإلكتروني المسجل في سعرلي" : "Email registered in Saarly"}<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })}/></label><label>{locale === "ar" ? "اسم الرتبة" : "Role name"}<input value={form.roleLabel} onChange={(event) => setForm({ ...form, roleLabel: event.target.value })} placeholder={locale === "ar" ? "مثال: مدير فرع" : "Example: Branch lead"}/></label><fieldset><legend>{locale === "ar" ? "الفروع المتاحة" : "Available branches"}</legend><div className="check-list"><label><input type="checkbox" checked={form.branchIds.length === 0} onChange={(event) => { if (event.target.checked) setForm({ ...form, branchIds: [] }); }}/><span>{locale === "ar" ? "كل الفروع" : "All branches"}</span></label>{branches.map((branch) => { const branchId = text(branch.id); const location = [text(branch.city_name), text(branch.governorate_name)].filter(Boolean).join(" - "); return <label key={branchId}><input type="checkbox" checked={form.branchIds.includes(branchId)} onChange={() => toggleBranch(branchId)}/><span><strong>{text(branch.name)}</strong>{location ? <small>{location}</small> : null}</span></label>; })}</div></fieldset><fieldset><legend>{locale === "ar" ? "الصفحات المتاحة" : "Available pages"}</legend><div className="check-list">{permissionOptions.map((option) => <label key={option.key}><input type="checkbox" checked={Boolean(form.permissions[option.key])} onChange={() => togglePermission(option.key)}/><span>{locale === "ar" ? option.ar : option.en}</span></label>)}</div></fieldset><div className="modal-actions"><button className="button secondary" type="button" onClick={() => setOpen(false)}>{locale === "ar" ? "إلغاء" : "Cancel"}</button><button className="button primary" type="submit" disabled={saving}>{saving ? (locale === "ar" ? "جارٍ الحفظ" : "Saving") : (locale === "ar" ? "حفظ الموظف" : "Save staff")}</button></div></form></section></div> : null}
  </div>;
}
