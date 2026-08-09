"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { portalPost } from "@/components/merchant/portal-client";
import { Notice, PortalPanel } from "@/components/merchant/portal-ui";
import { PortalAdCarousel } from "@/components/portal-v2/ad-carousel";
import { usePortalConfirm } from "@/components/portal-v2/portal-dialogs";
import { rows, staffRoleLabel, text } from "@/components/merchant/portal-utils";
import type { SectionProps } from "@/components/merchant/section-props";
import type { ThemeMode } from "@/components/site-preferences";
import type { Locale } from "@/lib/site-content";

const NOTIFICATION_KEY="saarly_merchant_web_notifications_enabled_v1";
const SOCIALS=[
  {key:"facebook",ar:"فيسبوك",en:"Facebook",href:process.env.NEXT_PUBLIC_FACEBOOK_URL||"https://www.facebook.com/share/1AKE7rcMHb/"},
  {key:"instagram",ar:"إنستغرام",en:"Instagram",href:process.env.NEXT_PUBLIC_INSTAGRAM_URL||"https://www.instagram.com/saarly_1"},
  {key:"tiktok",ar:"تيك توك",en:"TikTok",href:process.env.NEXT_PUBLIC_TIKTOK_URL||"https://tiktok.com/@saarly_1"},
];

function notificationPermissionLabel(permission: NotificationPermission, locale: "ar" | "en") {
  if (permission === "granted") return locale === "ar" ? "مسموح" : "Allowed";
  if (permission === "denied") return locale === "ar" ? "مرفوض" : "Denied";
  return locale === "ar" ? "لم يتم الاختيار" : "Not decided";
}

export function SettingsSection({ payload, locale, notify }: SectionProps) {
  const profile = payload.account.profile;
  const settingsAds = rows(payload.data.settingsAds);
  const [language, setLanguage] = useState<Locale>(text(profile.preferred_language, locale) === "en" ? "en" : "ar");
  const savedTheme = text(profile.theme);
  const initialTheme: ThemeMode = savedTheme === "dark" ? "dark" : "light";
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);
  const [browserNotifications,setBrowserNotifications]=useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { confirm, confirmDialog } = usePortalConfirm(locale);
  useEffect(()=>{try{setBrowserNotifications(window.localStorage.getItem(NOTIFICATION_KEY)==="true");}catch{}},[]);

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    try { await portalPost("save_preferences", { language, theme }); notify(locale === "ar" ? "تم حفظ تفضيلات الحساب." : "Account preferences saved.", "success"); }
    catch (error) { notify(error instanceof Error ? error.message : "preferences_save_failed", "error"); }
    finally { setSaving(false); }
  }
  async function requestDeletion() {
    if (!(await confirm({ title: locale === "ar" ? "طلب حذف الحساب" : "Request account deletion", body: locale === "ar" ? "سيتم إرسال طلب حذف الحساب للمراجعة. لن يتم حذف البيانات فورًا." : "An account deletion request will be submitted for review. Data will not be deleted immediately.", confirmLabel: locale === "ar" ? "إرسال الطلب" : "Submit request", tone: "danger" }))) return;
    setDeleting(true);
    try { await portalPost("delete_account"); notify(locale === "ar" ? "تم تسجيل طلب حذف الحساب." : "Account deletion request registered.", "success"); }
    catch (error) { notify(error instanceof Error ? error.message : "deletion_request_failed", "error"); }
    finally { setDeleting(false); }
  }
  async function toggleNotifications(){const next=!browserNotifications;if(next&&"Notification" in window&&Notification.permission==="default"){const permission=await Notification.requestPermission();if(permission==="denied"){notify(locale==="ar"?"تم رفض السماح بالإشعارات.":"Notification access was denied.","error");return;}}setBrowserNotifications(next);try{window.localStorage.setItem(NOTIFICATION_KEY,String(next));}catch{}notify(locale==="ar"?"تم حفظ إعداد إشعارات الموقع.":"Website notification setting saved.","success");}

  const googlePlay=process.env.NEXT_PUBLIC_GOOGLE_PLAY_URL||""; const appStore=process.env.NEXT_PUBLIC_APP_STORE_URL||"";
  return <div className="portal-section-stack settings-v2">
    {settingsAds.length ? <PortalAdCarousel ads={settingsAds} locale={locale} fit="contain"/> : null}
    <div className="settings-summary-banner merchant"><span><Icon name="settings" size={24}/></span><div><strong>{locale==="ar"?"إعدادات المتجر والحساب":"Store & account settings"}</strong><p>{locale==="ar"?"بيانات الوصول، تفضيلات الحساب، التنبيهات، السياسات وروابط الإدارة المتقدمة في واجهة واحدة.":"Access details, preferences, notifications, policies, and advanced management links in one place."}</p></div></div>
    <div className="portal-two-columns"><PortalPanel title={locale === "ar" ? "الحساب" : "Account"}><div className="detail-list"><div><span>{locale === "ar" ? "البريد" : "Email"}</span><strong>{payload.account.email}</strong></div><div><span>{locale === "ar" ? "الاسم" : "Name"}</span><strong>{text(profile.full_name, "—")}</strong></div><div><span>{locale === "ar" ? "نوع الوصول" : "Access type"}</span><strong>{payload.account.isOwner ? (locale === "ar" ? "صاحب المتجر" : "Store owner") : staffRoleLabel(payload.account.staff?.role_label, locale)}</strong></div><div><span>{locale==="ar"?"المتجر":"Store"}</span><strong>{text(payload.account.merchant.store_name,"—")}</strong></div></div></PortalPanel><PortalPanel title={locale==="ar"?"إدارة المتجر المتقدمة":"Advanced store management"}><div className="settings-links"><Link href="/merchant/store"><Icon name="store"/><span><strong>{locale==="ar"?"بيانات المتجر وتوفر الحرفي":"Store details & craftsman availability"}</strong><small>{locale==="ar"?"اسم المتجر والتصنيفات وطريقة التسعير والتوفر.":"Store name, categories, pricing method, and availability."}</small></span><Icon name="chevron"/></Link><Link href="/merchant/employees"><Icon name="users"/><span><strong>{locale==="ar"?"الموظفون والصلاحيات":"Staff & permissions"}</strong><small>{locale==="ar"?"إدارة الرتب والفروع والصفحات المتاحة لكل موظف.":"Manage roles, branches, and page permissions."}</small></span><Icon name="chevron"/></Link></div></PortalPanel></div>
    <div className="portal-two-columns"><PortalPanel title={locale==="ar"?"إشعارات الموقع":"Website notifications"} subtitle={locale==="ar"?"الاختيار محفوظ على هذا الجهاز، وسجل الإشعارات داخل حسابك يظل متاحًا دائمًا.":"This setting is saved on this device, and your account notification history remains available."}><div className="settings-switch-row"><span className={browserNotifications?"on":""}><Icon name="bell"/></span><div><strong>{locale==="ar"?"استقبال إشعارات الطلبات والرسائل":"Receive order and message alerts"}</strong><small>{typeof Notification!=="undefined"?`${locale==="ar"?"السماح بالإشعارات":"Notification access"}: ${notificationPermissionLabel(Notification.permission, locale)}`:(locale==="ar"?"غير متاح على هذا الجهاز":"Unavailable on this device")}</small></div><button type="button" className={`switch-control ${browserNotifications?"on":""}`} aria-pressed={browserNotifications} onClick={()=>void toggleNotifications()}><i/></button></div></PortalPanel><PortalPanel title={locale==="ar"?"حالة الحساب والاشتراك":"Account & subscription"}><div className="settings-links"><Link href="/merchant/account-status"><Icon name="shield"/><span><strong>{locale==="ar"?"حالة الحساب":"Account status"}</strong><small>{locale==="ar"?"الصلاحية واستقبال الطلبات وفترة السماح.":"Access, new-work eligibility, and grace period."}</small></span><Icon name="chevron"/></Link>{payload.account.isOwner?<Link href="/merchant/subscriptions"><Icon name="card"/><span><strong>{locale==="ar"?"الاشتراكات والباقات":"Subscriptions & plans"}</strong><small>{locale==="ar"?"الباقات وطلبات الدفع حسب الإعدادات الحالية.":"Plans and payment requests follow the current settings."}</small></span><Icon name="chevron"/></Link>:null}</div></PortalPanel></div>
    <PortalPanel title={locale === "ar" ? "اللغة والمظهر" : "Language and appearance"} subtitle={locale === "ar" ? "يتم حفظ التفضيلات في حساب سعرلي لتتوافق مع التطبيق." : "Preferences are saved to your Saarly account to stay aligned with the app."}><form className="portal-form" onSubmit={save}><div className="setting-options"><button type="button" className={language === "ar" ? "selected" : ""} onClick={() => setLanguage("ar")}><Icon name="globe"/><strong>{locale === "ar" ? "العربية" : "Arabic"}</strong></button><button type="button" className={language === "en" ? "selected" : ""} onClick={() => setLanguage("en")}><Icon name="globe"/><strong>{locale === "ar" ? "الإنجليزية" : "English"}</strong></button></div><div className="setting-options"><button type="button" className={theme === "light" ? "selected" : ""} onClick={() => setTheme("light")}><Icon name="sun"/><strong>{locale === "ar" ? "فاتح" : "Light"}</strong></button><button type="button" className={theme === "dark" ? "selected" : ""} onClick={() => setTheme("dark")}><Icon name="moon"/><strong>{locale === "ar" ? "داكن" : "Dark"}</strong></button></div><div className="form-actions"><button className="button primary" type="submit" disabled={saving}>{saving ? (locale === "ar" ? "جارٍ الحفظ" : "Saving") : (locale === "ar" ? "حفظ التفضيلات" : "Save preferences")}</button></div></form></PortalPanel>
    <div className="portal-two-columns"><PortalPanel title={locale==="ar"?"قيّم تطبيق سعرلي":"Rate Saarly app"}>{googlePlay||appStore?<div className="store-rating-actions">{googlePlay?<a className="button secondary" href={googlePlay} target="_blank" rel="noopener noreferrer"><Icon name="star"/>{locale === "ar" ? "متجر جوجل" : "Google Play"}</a>:null}{appStore?<a className="button secondary" href={appStore} target="_blank" rel="noopener noreferrer"><Icon name="star"/>{locale === "ar" ? "متجر آبل" : "App Store"}</a>:null}</div>:<Notice tone="info">{locale==="ar"?"روابط التقييم هتتفعّل بعد نشر التطبيق رسميًا.":"Rating links will be enabled after official app publication."}</Notice>}</PortalPanel><PortalPanel title={locale === "ar" ? "الدعم" : "Support"}><div className="settings-links"><Link href="/merchant/support"><Icon name="mail"/><span><strong>{locale === "ar" ? "الدعم والمساعدة" : "Support & help"}</strong><small>{locale === "ar" ? "الشكاوى السابقة أو محادثة جديدة مع المساعد وفريق الدعم." : "Previous complaints or a new conversation with the assistant and support team."}</small></span><Icon name="chevron"/></Link><Link href="/merchant/referrals"><Icon name="users"/><span><strong>{locale==="ar"?"الدعوات والمكافآت":"Invites & rewards"}</strong><small>{locale==="ar"?"تابع التقدم والمكافآت من نفس بيانات التطبيق.":"Track progress and rewards from the same app data."}</small></span><Icon name="chevron"/></Link></div></PortalPanel></div>
    <div className="portal-two-columns"><PortalPanel title={locale === "ar" ? "السياسات" : "Policies"}><div className="settings-links"><Link href="/privacy"><Icon name="shield"/><span><strong>{locale === "ar" ? "سياسة الخصوصية" : "Privacy policy"}</strong><small>{locale === "ar" ? "تعرف على استخدام البيانات." : "Learn how data is used."}</small></span><Icon name="chevron"/></Link><Link href="/terms"><Icon name="receipt"/><span><strong>{locale === "ar" ? "الشروط والأحكام" : "Terms and conditions"}</strong></span><Icon name="chevron"/></Link><Link href="/refund-policy"><Icon name="history"/><span><strong>{locale==="ar"?"سياسة الإرجاع واسترداد المبالغ":"Returns and refunds policy"}</strong></span><Icon name="chevron"/></Link></div></PortalPanel><PortalPanel title={locale==="ar"?"تابع سعرلي":"Follow Saarly"}><div className="social-link-grid">{SOCIALS.map(item=><a key={item.key} href={item.href} target="_blank" rel="noopener noreferrer"><Icon name="globe"/><strong>{locale === "ar" ? item.ar : item.en}</strong><Icon name="arrow" size={16}/></a>)}</div></PortalPanel></div>
    <PortalPanel title={locale === "ar" ? "الإعدادات المتقدمة" : "Advanced settings"}><Notice tone="warning">{locale === "ar" ? "حذف الحساب لا يتم فورًا؛ يتم إنشاء طلب للمراجعة وفق سياسة الاحتفاظ بالسجلات القانونية والمالية." : "Account deletion is not immediate; a review request is created under legal and financial retention rules."}</Notice><div className="form-actions"><button className="button danger-button" type="button" disabled={deleting} onClick={() => void requestDeletion()}><Icon name="trash"/>{deleting ? (locale === "ar" ? "جارٍ الإرسال" : "Submitting") : (locale === "ar" ? "طلب حذف الحساب" : "Request account deletion")}</button></div></PortalPanel>
    {confirmDialog}
  </div>;
}
