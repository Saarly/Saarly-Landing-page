"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Brand } from "@/components/brand";
import { Icon } from "@/components/icons";
import { useSitePreferences } from "@/components/site-preferences";
import { merchantRememberSessionEnabled, setMerchantRememberSession, supabase, supabaseConfigured } from "@/lib/supabase";

const messages: Record<string, { ar: string; en: string }> = {
  merchant_account_required: { ar: "هذا الحساب غير مرتبط بمتجر. تقدر تسجل متجر جديد من الموقع.", en: "This account is not linked to a store. You can register a new store on the website." },
  buyer_account_not_allowed: { ar: "هذا البريد مسجل كمشتري. استخدم بريد متجر مختلف.", en: "This email is registered as a buyer. Use a different merchant email." },
  account_blocked: { ar: "هذا الحساب موقوف. تواصل مع الدعم.", en: "This account is blocked. Contact support." },
  merchant_not_approved_for_staff: { ar: "لا يمكن للموظف الدخول قبل اعتماد المتجر.", en: "Staff cannot enter before the store is approved." },
  merchant_pending_approval: { ar: "طلب المتجر ما زال قيد المراجعة. ستتمكن من دخول البوابة بعد الموافقة النهائية.", en: "The store application is still under review. Portal access starts after final approval." },
  merchant_registration_rejected: { ar: "طلب تسجيل المتجر مرفوض. راجع سبب الرفض في التطبيق أو تواصل مع الدعم.", en: "The store application was rejected. Review the reason in the app or contact support." },
  invalid_session: { ar: "انتهت الجلسة. حاول تسجيل الدخول مرة أخرى.", en: "The session expired. Sign in again." },
};

function AuthShell({ children }: { children: React.ReactNode }) {
  const { locale, setLocale, theme, setTheme } = useSitePreferences();
  return <main className="auth-page"><div className="auth-top"><Brand locale={locale}/><div><button className="icon-button" type="button" onClick={() => setLocale(locale === "ar" ? "en" : "ar")}><Icon name="globe"/><span>{locale === "ar" ? "EN" : "ع"}</span></button><button className="icon-button" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}><Icon name={theme === "dark" ? "sun" : "moon"}/></button></div></div><div className="auth-layout"><aside><span className="eyebrow light"><Icon name="store"/>{locale === "ar" ? "بوابة المتاجر" : "Merchant portal"}</span><h1>{locale === "ar" ? "أدر متجرك من الكمبيوتر بنفس حساب التطبيق" : "Manage your store on desktop with the same app account"}</h1><p>{locale === "ar" ? "المنتجات والفروع والموظفون وطلبات التسعير وحالة الحساب في مكان واحد." : "Products, branches, staff, quote requests, and account status in one place."}</p><ul><li><Icon name="shield"/>{locale === "ar" ? "تحقق سيرفري من ارتباط الحساب بالمتجر" : "Server-side store-account verification"}</li><li><Icon name="desktop"/>{locale === "ar" ? "واجهة عملية للموبايل والكمبيوتر" : "Practical mobile and desktop interface"}</li><li><Icon name="receipt"/>{locale === "ar" ? "اشتراك سعرلي وإثباتات التحويل من الويب فقط لصاحب المتجر" : "Saarly subscription and transfer proofs are web-only for the store owner"}</li></ul></aside>{children}</div></main>;
}

export function MerchantLoginForm() {
  const { locale } = useSitePreferences();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [remember, setRemember] = useState(() => merchantRememberSessionEnabled());
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"notice" | "error">("notice");
  const [saving, setSaving] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setInterval(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendIn]);

  function showMessage(value: string, tone: "notice" | "error" = "notice") {
    setMessage(value);
    setMessageTone(tone);
  }

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    if (!supabaseConfigured || !supabase) {
      showMessage(locale === "ar" ? "إعداد الاتصال غير مكتمل." : "Connection is not configured.", "error");
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;
    setSaving(true);
    setMerchantRememberSession(remember);
    showMessage("");
    try {
      await supabase.auth.signOut({ scope: "local" });
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { shouldCreateUser: false, data: { preferred_language: locale } },
      });
      if (error) throw error;
      setStep("code");
      setOtp("");
      setResendIn(45);
      showMessage(locale === "ar" ? "أرسلنا رمز دخول مكوّنًا من 6 أرقام إلى بريدك." : "We sent a 6-digit sign-in code to your email.");
    } catch {
      showMessage(locale === "ar" ? "تعذر إرسال رمز الدخول. تأكد من البريد وحاول مرة أخرى." : "Could not send the sign-in code. Check the email and try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    if (!supabaseConfigured || !supabase) {
      showMessage(locale === "ar" ? "إعداد الاتصال غير مكتمل." : "Connection is not configured.", "error");
      return;
    }
    const token = otp.replace(/\D/g, "");
    if (token.length !== 6) {
      showMessage(locale === "ar" ? "اكتب رمز الدخول المكوّن من 6 أرقام." : "Enter the 6-digit sign-in code.", "error");
      return;
    }

    setSaving(true);
    setMerchantRememberSession(remember);
    showMessage("");
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: "email",
      });
      if (error || !data.session) throw error ?? new Error("invalid_session");
      await supabase.auth.updateUser({ data: { preferred_language: locale } });

      const response = await fetch("/api/merchant/portal?section=overview", {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      const payload = await response.json();
      if (!response.ok) {
        const code = String(payload.error ?? "");
        if (["merchant_account_required", "merchant_pending_approval", "merchant_registration_rejected", "profile_incomplete"].includes(code)) {
          window.location.assign("/merchant-register");
          return;
        }
        await supabase.auth.signOut({ scope: "local" });
        const known = messages[code];
        showMessage(
          known ? (locale === "ar" ? known.ar : known.en) : (locale === "ar" ? "لا يمكن فتح بوابة المتجر بهذا الحساب." : "This account cannot open the merchant portal."),
          "error",
        );
        setSaving(false);
        return;
      }
      window.location.assign("/merchant");
    } catch {
      showMessage(locale === "ar" ? "الرمز غير صحيح أو انتهت صلاحيته. اطلب رمزًا جديدًا." : "The code is invalid or expired. Request a new code.", "error");
      setSaving(false);
    }
  }

  return (
    <AuthShell>
      <section className="auth-card otp-auth-card">
        <span className="eyebrow"><Icon name="store" />{locale === "ar" ? "تسجيل دخول المتجر" : "Merchant sign in"}</span>
        <h2>{step === "email" ? (locale === "ar" ? "ادخل ببريد متجرك" : "Sign in with your store email") : (locale === "ar" ? "أدخل رمز الدخول" : "Enter the sign-in code")}</h2>
        <p>{step === "email" ? (locale === "ar" ? "اكتب البريد المستخدم في تطبيق سعرلي، وسنرسل رمزًا لمرة واحدة بدون كلمة مرور." : "Enter the email used in the Saarly app and we will send a one-time code—no password needed.") : (locale === "ar" ? `أرسلنا الرمز إلى ${email.trim().toLowerCase()}` : `We sent the code to ${email.trim().toLowerCase()}`)}</p>

        {step === "email" ? (
          <form onSubmit={(event) => void sendCode(event)}>
            <label>{locale === "ar" ? "البريد الإلكتروني" : "Email"}<input required value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="info@example.com" /></label>
            <label className="remember-row">
              <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
              <span><strong>{locale === "ar" ? "تذكرني على هذا الجهاز" : "Remember me on this device"}</strong><small>{locale === "ar" ? "عند إلغاء الاختيار تنتهي الجلسة عند إغلاق المتصفح." : "When unchecked, the session ends when the browser closes."}</small></span>
            </label>
            {message ? <p className={messageTone === "error" ? "form-error" : "form-notice"}>{message}</p> : null}
            <button className="button primary full" type="submit" disabled={saving}>{saving ? (locale === "ar" ? "جارٍ إرسال الرمز" : "Sending code") : (locale === "ar" ? "إرسال رمز الدخول" : "Send sign-in code")}<Icon name="mail" size={18} /></button>
          </form>
        ) : (
          <form onSubmit={verifyCode}>
            <label>{locale === "ar" ? "رمز الدخول" : "Sign-in code"}<input className="otp-input" required value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="000000" /></label>
            <label className="remember-row">
              <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
              <span><strong>{locale === "ar" ? "تذكرني على هذا الجهاز" : "Remember me on this device"}</strong><small>{locale === "ar" ? "يمكنك تسجيل الخروج لاحقًا من بوابة المتجر." : "You can sign out later from the merchant portal."}</small></span>
            </label>
            {message ? <p className={messageTone === "error" ? "form-error" : "form-notice"}>{message}</p> : null}
            <button className="button primary full" type="submit" disabled={saving}>{saving ? (locale === "ar" ? "جارٍ التحقق" : "Verifying") : (locale === "ar" ? "تأكيد والدخول" : "Verify and sign in")}<Icon name="arrow" size={18} /></button>
            <div className="otp-actions">
              <button className="button text-button" type="button" onClick={() => { setStep("email"); setOtp(""); showMessage(""); }} disabled={saving}>{locale === "ar" ? "تغيير البريد" : "Change email"}</button>
              <button className="button text-button" type="button" onClick={() => void sendCode()} disabled={saving || resendIn > 0}>{resendIn > 0 ? (locale === "ar" ? `إعادة الإرسال خلال ${resendIn}ث` : `Resend in ${resendIn}s`) : (locale === "ar" ? "إرسال رمز جديد" : "Send a new code")}</button>
            </div>
          </form>
        )}

        <div className="auth-links auth-links-wrap"><Link href="/merchant-register">{locale === "ar" ? "تسجيل متجر جديد" : "Register a new store"}</Link><Link href="/support">{locale === "ar" ? "تحتاج مساعدة؟" : "Need help?"}</Link><Link href="/">{locale === "ar" ? "العودة للموقع" : "Back to website"}</Link></div>
      </section>
    </AuthShell>
  );
}

export function ForgotPasswordForm() {
  const { locale } = useSitePreferences();
  return (
    <AuthShell>
      <section className="auth-card">
        <span className="eyebrow"><Icon name="mail" />{locale === "ar" ? "دخول بدون كلمة مرور" : "Passwordless sign in"}</span>
        <h2>{locale === "ar" ? "مش محتاج تستعيد كلمة مرور" : "There is no password to recover"}</h2>
        <p>{locale === "ar" ? "بوابة المتاجر تستخدم رمز دخول مؤقت يصل إلى بريدك. ارجع لصفحة الدخول، اكتب البريد، ثم أدخل الرمز المكوّن من 6 أرقام." : "The merchant portal uses a temporary code sent to your email. Return to sign in, enter your email, then use the 6-digit code."}</p>
        <div className="auth-links auth-links-stacked"><Link className="button primary full" href="/merchant-login">{locale === "ar" ? "العودة لتسجيل الدخول" : "Back to sign in"}<Icon name="arrow" size={18} /></Link><Link href="/support">{locale === "ar" ? "تحتاج مساعدة من الدعم؟" : "Need help from support?"}</Link></div>
      </section>
    </AuthShell>
  );
}

export function ResetPasswordForm() {
  const { locale } = useSitePreferences();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setReady(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !ready) { setMessage(locale === "ar" ? "رابط الاستعادة غير صالح أو انتهت صلاحيته." : "The recovery link is invalid or expired."); return; }
    if (password.length < 8 || password !== confirm) { setMessage(locale === "ar" ? "استخدم 8 أحرف على الأقل وتأكد من تطابق الكلمتين." : "Use at least 8 characters and make sure both passwords match."); return; }
    setSaving(true); const { error } = await supabase.auth.updateUser({ password }); setSaving(false);
    if (error) { setMessage(locale === "ar" ? "تعذر تحديث كلمة المرور." : "Could not update the password."); return; }
    setMessage(locale === "ar" ? "تم تحديث كلمة المرور. يمكنك تسجيل الدخول الآن." : "Password updated. You can now sign in.");
    setTimeout(() => window.location.assign("/merchant-login"), 1200);
  }
  return <AuthShell><section className="auth-card"><span className="eyebrow"><Icon name="shield"/>{locale === "ar" ? "كلمة مرور جديدة" : "New password"}</span><h2>{locale === "ar" ? "أنشئ كلمة مرور آمنة" : "Create a secure password"}</h2><form onSubmit={submit}><label>{locale === "ar" ? "كلمة المرور الجديدة" : "New password"}<input required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="new-password" /></label><label>{locale === "ar" ? "تأكيد كلمة المرور" : "Confirm password"}<input required minLength={8} value={confirm} onChange={(event) => setConfirm(event.target.value)} type="password" autoComplete="new-password" /></label>{message ? <p className="form-notice">{message}</p> : null}<button className="button primary full" type="submit" disabled={saving || !ready}>{saving ? (locale === "ar" ? "جارٍ الحفظ" : "Saving") : (locale === "ar" ? "حفظ كلمة المرور" : "Save password")}</button></form></section></AuthShell>;
}
