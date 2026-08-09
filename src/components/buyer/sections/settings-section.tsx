"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { buyerPost } from "@/components/buyer/portal-client";
import { Notice, PortalPanel } from "@/components/merchant/portal-ui";
import { row, rows, text } from "@/components/merchant/portal-utils";
import type { BuyerSectionProps } from "@/components/buyer/section-props";
import { useSitePreferences, type ThemeMode } from "@/components/site-preferences";
import { CoordinateMapPicker } from "@/components/portal-v2/coordinate-map-picker";
import type { Locale } from "@/lib/site-content";

const SOCIALS=[
  {key:"facebook",label:"Facebook",href:process.env.NEXT_PUBLIC_FACEBOOK_URL||"https://www.facebook.com/share/1AKE7rcMHb/"},
  {key:"instagram",label:"Instagram",href:process.env.NEXT_PUBLIC_INSTAGRAM_URL||"https://www.instagram.com/saarly_1"},
  {key:"tiktok",label:"TikTok",href:process.env.NEXT_PUBLIC_TIKTOK_URL||"https://tiktok.com/@saarly_1"},
];
const SEARCH_SCOPE_KEY="saarly_buyer_search_scope_v1";
const NOTIFICATION_KEY="saarly_web_notifications_enabled_v1";

function notificationPermissionLabel(permission: NotificationPermission, locale: "ar" | "en") {
  if (permission === "granted") return locale === "ar" ? "مسموح" : "Allowed";
  if (permission === "denied") return locale === "ar" ? "مرفوض" : "Denied";
  return locale === "ar" ? "لم يتم الاختيار" : "Not decided";
}

function normalizePlace(input: unknown) {
  return String(input ?? "").trim().toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, " ");
}

export function BuyerSettingsSection({ payload, locale, refresh, notify }: BuyerSectionProps) {
  const { setLocale, setTheme } = useSitePreferences();
  const profile = payload.account.profile;
  const savedLocation = row(payload.data.location);
  const options = rows(payload.data.locationOptions).filter((item) => item.is_country_marker !== true);
  const [fullName, setFullName] = useState(text(profile.full_name));
  const [mobile, setMobile] = useState(text(profile.mobile));
  const [language, setLanguage] = useState<Locale>(text(profile.preferred_language, locale) === "en" ? "en" : "ar");
  const [theme, setLocalTheme] = useState<ThemeMode>(text(profile.theme, "light") === "dark" ? "dark" : "light");
  const [cityId, setCityId] = useState(text(savedLocation.city_id));
  const [latitude, setLatitude] = useState(text(savedLocation.latitude));
  const [longitude, setLongitude] = useState(text(savedLocation.longitude));
  const [scope,setScope]=useState("city");
  const [browserNotifications,setBrowserNotifications]=useState(false);
  const [saving, setSaving] = useState("");

  useEffect(()=>{try{const saved=window.localStorage.getItem(SEARCH_SCOPE_KEY);if(["city","governorate","country"].includes(saved||""))setScope(saved!);setBrowserNotifications(window.localStorage.getItem(NOTIFICATION_KEY)==="true");}catch{}},[]);

  async function saveProfile(event: FormEvent) { event.preventDefault(); setSaving("profile"); try { await buyerPost("save_profile", { fullName, mobile }); notify(locale === "ar" ? "تم حفظ بيانات الحساب." : "Account details saved.", "success"); await refresh(); } catch (error) { notify(error instanceof Error ? error.message : "profile_save_failed", "error"); } finally { setSaving(""); } }
  async function savePreferences(event: FormEvent) { event.preventDefault(); setSaving("preferences"); try { await buyerPost("save_preferences", { language, theme }); setLocale(language); setTheme(theme); notify(locale === "ar" ? "تم حفظ اللغة والمظهر." : "Language and appearance saved.", "success"); await refresh(); } catch (error) { notify(error instanceof Error ? error.message : "preferences_save_failed", "error"); } finally { setSaving(""); } }
  async function saveLocation(event: FormEvent) { event.preventDefault(); setSaving("location"); try { await buyerPost("save_location", { cityId, latitude, longitude }); notify(locale === "ar" ? "تم حفظ الموقع والعملة." : "Location and currency saved.", "success"); await refresh(); } catch (error) { notify(error instanceof Error ? error.message : "location_save_failed", "error"); } finally { setSaving(""); } }
  function locate() { if (!navigator.geolocation) {notify(locale==="ar"?"المتصفح لا يدعم تحديد الموقع.":"Geolocation is not supported by this browser.","error");return;} navigator.geolocation.getCurrentPosition((position) => { setLatitude(String(position.coords.latitude)); setLongitude(String(position.coords.longitude)); }, () => notify(locale === "ar" ? "تعذر الوصول لموقعك." : "Could not access your location.", "error"), { enableHighAccuracy: true, timeout: 12000 }); }
  function updateMapLocation(nextLatitude: string, nextLongitude: string, resolved?: { city?: string; governorate?: string; country?: string }) {
    setLatitude(nextLatitude); setLongitude(nextLongitude);
    if (!resolved) return;
    const city = normalizePlace(resolved.city);
    const governorate = normalizePlace(resolved.governorate);
    const country = normalizePlace(resolved.country);
    const matched = options.find((item) => {
      const names = [item.name_ar, item.name_en].map(normalizePlace);
      const govs = [item.governorate_ar, item.governorate_en].map(normalizePlace);
      const countries = [item.country_ar, item.country_en].map(normalizePlace);
      const cityMatch = !city || names.some((name) => name && (name === city || name.includes(city) || city.includes(name)));
      const govMatch = !governorate || govs.some((name) => name && (name === governorate || name.includes(governorate) || governorate.includes(name)));
      const countryMatch = !country || countries.some((name) => name && (name === country || name.includes(country) || country.includes(name)));
      return cityMatch && govMatch && countryMatch;
    });
    if (matched) setCityId(text(matched.id));
  }
  function saveScope(next:string){setScope(next);try{window.localStorage.setItem(SEARCH_SCOPE_KEY,next);}catch{} notify(locale==="ar"?"تم حفظ نطاق البحث الافتراضي لهذا المتصفح.":"Default search scope saved for this browser.","success");}
  async function toggleNotifications(){const next=!browserNotifications;if(next&&"Notification" in window&&Notification.permission==="default"){const permission=await Notification.requestPermission();if(permission==="denied"){notify(locale==="ar"?"تم رفض إذن إشعارات المتصفح من إعدادات الجهاز.":"Browser notification permission was denied.","error");return;}}setBrowserNotifications(next);try{window.localStorage.setItem(NOTIFICATION_KEY,String(next));}catch{}notify(locale==="ar"?"تم حفظ إعداد تنبيهات البوابة على هذا المتصفح.":"Portal notification preference saved on this browser.","success");}

  const googlePlay=process.env.NEXT_PUBLIC_GOOGLE_PLAY_URL||""; const appStore=process.env.NEXT_PUBLIC_APP_STORE_URL||"";
  return <div className="portal-section-stack settings-v2">
    <div className="settings-summary-banner"><span><Icon name="settings" size={24}/></span><div><strong>{locale==="ar"?"إعدادات حساب المشتري":"Buyer account settings"}</strong><p>{locale==="ar"?"الموقع ونطاق البحث واللغة والمظهر والتنبيهات والسياسات في مكان واحد، بنفس منطق التطبيق وبترتيب أوضح للويب.":"Location, search scope, language, appearance, notifications, and policies in one web-optimized workspace."}</p></div></div>
    <div className="portal-two-columns"><PortalPanel title={locale === "ar" ? "بيانات الحساب" : "Account details"} subtitle={locale==="ar"?"البيانات الأساسية المستخدمة في الطلبات والتواصل.":"Core details used for requests and communication."}><form className="portal-form" onSubmit={saveProfile}><label>{locale === "ar" ? "الاسم بالكامل" : "Full name"}<input required minLength={2} value={fullName} onChange={(event) => setFullName(event.target.value)}/></label><label>{locale === "ar" ? "رقم الهاتف" : "Phone number"}<input required minLength={7} inputMode="tel" value={mobile} onChange={(event) => setMobile(event.target.value)}/></label><label>{locale === "ar" ? "البريد" : "Email"}<input value={payload.account.email} readOnly/></label><button className="button primary" disabled={saving === "profile"}>{saving==="profile"?(locale==="ar"?"جارٍ الحفظ":"Saving"):(locale === "ar" ? "حفظ البيانات" : "Save details")}</button></form></PortalPanel><PortalPanel title={locale === "ar" ? "موقعك والعملة" : "Location and currency"} subtitle={locale==="ar"?"الموقع يحدد المتاجر والعروض والعملة المناسبة.":"Your location determines relevant stores, offers, and currency."}><form className="portal-form" onSubmit={saveLocation}><label>{locale === "ar" ? "الدولة والمحافظة والمدينة" : "Country, governorate, and city"}<select required value={cityId} onChange={(event) => setCityId(event.target.value)}><option value="">{locale === "ar" ? "اختر الموقع" : "Choose location"}</option>{options.map((item) => <option key={text(item.id)} value={text(item.id)}>{locale === "ar" ? `${text(item.country_ar)} - ${text(item.governorate_ar)} - ${text(item.name_ar)}` : `${text(item.country_en)} - ${text(item.governorate_en)} - ${text(item.name_en)}`}</option>)}</select></label><div className="coordinate-inline"><input inputMode="decimal" placeholder={locale === "ar" ? "خط العرض" : "Latitude"} value={latitude} onChange={(event) => setLatitude(event.target.value)}/><input inputMode="decimal" placeholder={locale === "ar" ? "خط الطول" : "Longitude"} value={longitude} onChange={(event) => setLongitude(event.target.value)}/></div><CoordinateMapPicker latitude={latitude} longitude={longitude} locale={locale} onChange={updateMapLocation}/><button className="button secondary" type="button" onClick={locate}><Icon name="location"/>{locale === "ar" ? "استخدام موقعي" : "Use my location"}</button><button className="button primary" disabled={saving === "location"}>{saving==="location"?(locale==="ar"?"جارٍ الحفظ":"Saving"):(locale === "ar" ? "حفظ الموقع" : "Save location")}</button></form></PortalPanel></div>
    <div className="portal-two-columns"><PortalPanel title={locale==="ar"?"نطاق البحث الافتراضي":"Default search scope"} subtitle={locale==="ar"?"نفس اختيار التطبيق: المدينة أو المحافظة أو كل الدولة. يمكن تغييره داخل كل طلب.":"The same app choices: city, governorate, or whole country. You can override it per request."}><div className="setting-options three"><button type="button" className={scope==="city"?"selected":""} onClick={()=>saveScope("city")}><Icon name="store"/><strong>{locale==="ar"?"مدينتي":"City"}</strong></button><button type="button" className={scope==="governorate"?"selected":""} onClick={()=>saveScope("governorate")}><Icon name="location"/><strong>{locale==="ar"?"محافظتي":"Governorate"}</strong></button><button type="button" className={scope==="country"?"selected":""} onClick={()=>saveScope("country")}><Icon name="globe"/><strong>{locale==="ar"?"كل الدولة":"Whole country"}</strong></button></div></PortalPanel><PortalPanel title={locale==="ar"?"إشعارات البوابة":"Portal notifications"} subtitle={locale==="ar"?"تحكم محلي لهذا المتصفح. سجل الإشعارات داخل سعرلي يفضل متاح دائمًا.":"A browser-local preference; your Saarly notification history remains available."}><div className="settings-switch-row"><span className={browserNotifications?"on":""}><Icon name="bell"/></span><div><strong>{locale==="ar"?"استقبال تنبيهات البوابة":"Receive portal alerts"}</strong><small>{"Notification" in globalThis&&typeof Notification!=="undefined"?`${locale==="ar"?"إذن المتصفح":"Browser permission"}: ${notificationPermissionLabel(Notification.permission, locale)}`:(locale==="ar"?"إشعارات النظام غير مدعومة هنا":"System notifications are unavailable here")}</small></div><button type="button" className={`switch-control ${browserNotifications?"on":""}`} aria-pressed={browserNotifications} onClick={()=>void toggleNotifications()}><i/></button></div></PortalPanel></div>
    <PortalPanel title={locale === "ar" ? "اللغة والمظهر" : "Language and appearance"} subtitle={locale === "ar" ? "يتم حفظ الاختيار في حسابك ويُستخدم في التطبيق والبوابة." : "These preferences are saved to your account and used across app and portal."}><form className="portal-form" onSubmit={savePreferences}><div className="setting-options"><button type="button" className={language === "ar" ? "selected" : ""} onClick={() => setLanguage("ar")}><Icon name="globe"/><strong>العربية</strong></button><button type="button" className={language === "en" ? "selected" : ""} onClick={() => setLanguage("en")}><Icon name="globe"/><strong>English</strong></button></div><div className="setting-options"><button type="button" className={theme === "light" ? "selected" : ""} onClick={() => setLocalTheme("light")}><Icon name="sun"/><strong>{locale === "ar" ? "فاتح" : "Light"}</strong></button><button type="button" className={theme === "dark" ? "selected" : ""} onClick={() => setLocalTheme("dark")}><Icon name="moon"/><strong>{locale === "ar" ? "داكن" : "Dark"}</strong></button></div><button className="button primary" disabled={saving === "preferences"}>{saving==="preferences"?(locale==="ar"?"جارٍ الحفظ":"Saving"):(locale === "ar" ? "حفظ التفضيلات" : "Save preferences")}</button></form></PortalPanel>
    <div className="portal-two-columns"><PortalPanel title={locale==="ar"?"قيّم تطبيق سعرلي":"Rate Saarly app"} subtitle={locale==="ar"?"بعد نشر التطبيق رسميًا تقدر تفتحه مباشرة على المتجر المناسب.":"Open the relevant store once the app is officially published."}><div className="store-rating-actions">{googlePlay?<a className="button secondary" href={googlePlay} target="_blank" rel="noopener noreferrer"><Icon name="star"/>{locale==="ar"?"جوجل بلاي":"Google Play"}</a>:null}{appStore?<a className="button secondary" href={appStore} target="_blank" rel="noopener noreferrer"><Icon name="star"/>{locale==="ar"?"آب ستور":"App Store"}</a>:null}{!googlePlay&&!appStore?<Notice tone="info">{locale==="ar"?"روابط التقييم هتتفعّل بعد نشر التطبيق رسميًا.":"Rating links will be enabled after the app is officially published."}</Notice>:null}</div></PortalPanel><PortalPanel title={locale === "ar" ? "الدعم والدعوات" : "Support & invites"}><div className="settings-links"><Link href="/buyer/support"><Icon name="quote"/><span><strong>{locale === "ar" ? "الدعم والمساعدة" : "Support and help"}</strong><small>{locale === "ar" ? "الشكاوى والمحادثات السابقة والجديدة." : "New and previous support conversations."}</small></span><Icon name="chevron"/></Link><Link href="/buyer/referrals"><Icon name="users"/><span><strong>{locale==="ar"?"الدعوات والمكافآت":"Invites and rewards"}</strong><small>{locale==="ar"?"رابط الدعوة والتقدم والمكافآت.":"Invite link, progress, and rewards."}</small></span><Icon name="chevron"/></Link></div></PortalPanel></div>
    <div className="portal-two-columns"><PortalPanel title={locale==="ar"?"السياسات":"Policies"}><div className="settings-links"><Link href="/privacy"><Icon name="shield"/><span><strong>{locale === "ar" ? "سياسة الخصوصية" : "Privacy policy"}</strong></span><Icon name="chevron"/></Link><Link href="/terms"><Icon name="receipt"/><span><strong>{locale === "ar" ? "الشروط والأحكام" : "Terms and conditions"}</strong></span><Icon name="chevron"/></Link><Link href="/refund-policy"><Icon name="history"/><span><strong>{locale==="ar"?"سياسة الإرجاع واسترداد المبالغ":"Returns and refunds policy"}</strong></span><Icon name="chevron"/></Link></div></PortalPanel><PortalPanel title={locale==="ar"?"تابع سعرلي":"Follow Saarly"} subtitle={locale==="ar"?"تابع آخر التحديثات وانضم لمجتمع سعرلي.":"Follow updates and join the Saarly community."}><div className="social-link-grid">{SOCIALS.map(item=><a key={item.key} href={item.href} target="_blank" rel="noopener noreferrer"><Icon name="globe"/><strong>{item.label}</strong><Icon name="arrow" size={16}/></a>)}</div></PortalPanel></div>
    <PortalPanel title={locale === "ar" ? "الإعدادات المتقدمة" : "Advanced settings"}><Notice tone="warning">{locale === "ar" ? "حذف الحساب يخضع لمراجعة السجلات القانونية والطلبات المرتبطة بالحساب." : "Account deletion is reviewed against legal and order records."}</Notice><div className="form-actions"><Link className="button danger-button" href="/delete-account"><Icon name="trash"/>{locale === "ar" ? "طلب حذف الحساب" : "Request account deletion"}</Link></div></PortalPanel>
  </div>;
}
