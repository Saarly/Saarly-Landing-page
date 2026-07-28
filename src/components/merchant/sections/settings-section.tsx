"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { portalPost } from "@/components/merchant/portal-client";
import { Notice, PortalPanel } from "@/components/merchant/portal-ui";
import { rows, safeExternalUrl, text } from "@/components/merchant/portal-utils";
import type { SectionProps } from "@/components/merchant/section-props";

export function SettingsSection({ payload, locale, notify }: SectionProps) {
  const profile = payload.account.profile;
  const settingsAds = rows(payload.data.settingsAds);
  const [language, setLanguage] = useState(text(profile.preferred_language, locale) === "en" ? "en" : "ar");
  const [theme, setTheme] = useState(["light", "dark", "system"].includes(text(profile.theme)) ? text(profile.theme) : "system");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    try { await portalPost("save_preferences", { language, theme }); notify(locale === "ar" ? "تم حفظ تفضيلات الحساب." : "Account preferences saved.", "success"); }
    catch (error) { notify(error instanceof Error ? error.message : "preferences_save_failed", "error"); }
    finally { setSaving(false); }
  }

  async function requestDeletion() {
    if (!window.confirm(locale === "ar" ? "هل تريد إرسال طلب حذف الحساب للمراجعة؟" : "Submit an account deletion request for review?")) return;
    setDeleting(true);
    try { await portalPost("delete_account"); notify(locale === "ar" ? "تم تسجيل طلب حذف الحساب." : "Account deletion request registered.", "success"); }
    catch (error) { notify(error instanceof Error ? error.message : "deletion_request_failed", "error"); }
    finally { setDeleting(false); }
  }

  return <div className="portal-section-stack">
    {settingsAds.map((ad) => { const href = safeExternalUrl(ad.target_url); const image = <img src={text(ad.image_url)} alt={text(locale === "ar" ? ad.title_ar : ad.title_en)}/>; return href ? <a className="portal-ad" key={text(ad.id)} href={href} target="_blank" rel="noopener noreferrer">{image}</a> : <div className="portal-ad" key={text(ad.id)}>{image}</div>; })}
    <div className="portal-two-columns"><PortalPanel title={locale === "ar" ? "الحساب" : "Account"}><div className="detail-list"><div><span>{locale === "ar" ? "البريد" : "Email"}</span><strong>{payload.account.email}</strong></div><div><span>{locale === "ar" ? "الاسم" : "Name"}</span><strong>{text(profile.full_name, "—")}</strong></div><div><span>{locale === "ar" ? "نوع الوصول" : "Access type"}</span><strong>{payload.account.isOwner ? (locale === "ar" ? "صاحب المتجر" : "Store owner") : text(payload.account.staff?.role_label)}</strong></div></div></PortalPanel><PortalPanel title={locale === "ar" ? "روابط المساعدة" : "Help links"}><div className="settings-links"><Link href="/support"><Icon name="mail"/><span><strong>{locale === "ar" ? "الدعم" : "Support"}</strong><small>{locale === "ar" ? "أرسل مشكلة أو استفسارًا." : "Send an issue or question."}</small></span><Icon name="chevron"/></Link><Link href="/privacy"><Icon name="shield"/><span><strong>{locale === "ar" ? "سياسة الخصوصية" : "Privacy policy"}</strong><small>{locale === "ar" ? "تعرف على استخدام البيانات." : "Learn how data is used."}</small></span><Icon name="chevron"/></Link><Link href="/terms"><Icon name="receipt"/><span><strong>{locale === "ar" ? "شروط الاستخدام" : "Terms of use"}</strong><small>{locale === "ar" ? "حقوق ومسؤوليات الأطراف." : "Rights and responsibilities."}</small></span><Icon name="chevron"/></Link></div></PortalPanel></div>
    <PortalPanel title={locale === "ar" ? "اللغة والمظهر" : "Language and appearance"} subtitle={locale === "ar" ? "يتم حفظ التفضيلات في حساب سعرلي لتتوافق مع التطبيق." : "Preferences are saved to the Saarly account to stay aligned with the app."}><form className="portal-form" onSubmit={save}><div className="setting-options"><button type="button" className={language === "ar" ? "selected" : ""} onClick={() => setLanguage("ar")}><Icon name="globe"/><strong>العربية</strong></button><button type="button" className={language === "en" ? "selected" : ""} onClick={() => setLanguage("en")}><Icon name="globe"/><strong>English</strong></button></div><div className="setting-options three"><button type="button" className={theme === "light" ? "selected" : ""} onClick={() => setTheme("light")}><Icon name="sun"/><strong>{locale === "ar" ? "فاتح" : "Light"}</strong></button><button type="button" className={theme === "dark" ? "selected" : ""} onClick={() => setTheme("dark")}><Icon name="moon"/><strong>{locale === "ar" ? "داكن" : "Dark"}</strong></button><button type="button" className={theme === "system" ? "selected" : ""} onClick={() => setTheme("system")}><Icon name="desktop"/><strong>{locale === "ar" ? "حسب الجهاز" : "System"}</strong></button></div><div className="form-actions"><button className="button primary" type="submit" disabled={saving}>{saving ? (locale === "ar" ? "جارٍ الحفظ" : "Saving") : (locale === "ar" ? "حفظ التفضيلات" : "Save preferences")}</button></div></form></PortalPanel>
    <PortalPanel title={locale === "ar" ? "إجراءات الحساب" : "Account actions"}><Notice tone="warning">{locale === "ar" ? "حذف الحساب لا يتم فورًا من الواجهة؛ يُنشأ طلب للمراجعة وفق سياسة الاحتفاظ بالسجلات القانونية والمالية." : "Account deletion is not immediate; a review request is created under legal and financial retention rules."}</Notice><button className="button danger-button" type="button" disabled={deleting} onClick={() => void requestDeletion()}><Icon name="trash"/>{deleting ? (locale === "ar" ? "جارٍ الإرسال" : "Submitting") : (locale === "ar" ? "طلب حذف الحساب" : "Request account deletion")}</button></PortalPanel>
  </div>;
}
