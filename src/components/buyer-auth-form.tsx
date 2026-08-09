"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Brand } from "@/components/brand";
import { Icon } from "@/components/icons";
import { useSitePreferences } from "@/components/site-preferences";
import { humanError } from "@/components/merchant/portal-utils";
import {
  cleanReferralCode,
  forgetReferralCode,
  referralCodeFromBrowser,
  referralDeviceFamilyFingerprint,
  referralDeviceFingerprint,
  rememberReferralCode,
} from "@/lib/referrals";
import {
  merchantRememberSessionEnabled,
  setMerchantRememberSession,
  supabase,
  supabaseConfigured,
} from "@/lib/supabase";

type Mode = "signin" | "signup";
type Step = "email" | "code" | "profile" | "accountType";

export function BuyerAuthForm({ initialMode = "signin" }: { initialMode?: Mode } = {}) {
  const { locale, setLocale, theme, setTheme } = useSitePreferences();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [remember, setRemember] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [referralCode, setReferralCode] = useState(referralCodeFromBrowser);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setRemember(merchantRememberSessionEnabled());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    rememberReferralCode(referralCode);
  }, [referralCode]);
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setInterval(
      () => setResendIn((current) => Math.max(0, current - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [resendIn]);

  function reset(nextMode: Mode) {
    setMode(nextMode);
    setStep("email");
    setOtp("");
    setMessage("");
    setError("");
  }

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    if (!supabaseConfigured || !supabase) {
      setError(
        locale === "ar"
          ? "إعداد الاتصال غير مكتمل."
          : "Connection is not configured.",
      );
      return;
    }
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;
    setSaving(true);
    setError("");
    setMessage("");
    setMerchantRememberSession(remember);
    try {
      await supabase.auth.signOut({ scope: "local" });
      const result = await supabase.auth.signInWithOtp({
        email: normalized,
        options: {
          shouldCreateUser: mode === "signup",
          data: { preferred_language: locale },
        },
      });
      if (result.error) throw result.error;
      setStep("code");
      setOtp("");
      setResendIn(45);
      setMessage(
        locale === "ar"
          ? "أرسلنا رمز دخول من 6 أرقام إلى بريدك."
          : "We sent a 6-digit code to your email.",
      );
    } catch (requestError) {
      setError(humanError(requestError, locale));
    } finally {
      setSaving(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    if (!supabaseConfigured || !supabase) return;
    const token = otp.replace(/\D/g, "");
    if (token.length !== 6) {
      setError(
        locale === "ar"
          ? "اكتب رمز الدخول المكوّن من 6 أرقام."
          : "Enter the 6-digit code.",
      );
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: "email",
      });
      if (result.error || !result.data.session)
        throw result.error ?? new Error("invalid_session");
      await supabase.auth.updateUser({ data: { preferred_language: locale } });
      const check = await fetch("/api/buyer/portal?section=home", {
        headers: {
          Authorization: `Bearer ${result.data.session.access_token}`,
        },
      });
      const payload = await check.json();
      if (check.ok) {
        window.location.assign("/buyer");
        return;
      }
      if (String(payload.error ?? "") === "profile_incomplete") {
        const normalizedEmail = email.trim().toLowerCase();
        setPrimaryEmail(normalizedEmail);
        setRecoveryEmail("");
        setStep("profile");
        return;
      }
      throw new Error(String(payload.error ?? "buyer_access_required"));
    } catch (verifyError) {
      setError(humanError(verifyError, locale));
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setError("");
    const profilePrimaryEmail =
      primaryEmail.trim().toLowerCase() || email.trim().toLowerCase();
    if (fullName.trim().length < 2) {
      setError(locale === "ar" ? "اكتب الاسم بالكامل." : "Enter your full name.");
      return;
    }
    if (mobile.trim().replace(/\s+/g, "").length < 7) {
      setError(locale === "ar" ? "اكتب رقم الهاتف." : "Enter your phone number.");
      return;
    }
    if (!profilePrimaryEmail) {
      setError(locale === "ar" ? "اكتب البريد الأساسي." : "Enter the primary email.");
      return;
    }
    setPrimaryEmail(profilePrimaryEmail);
    setStep("accountType");
  }

  async function chooseAccountType(role: "buyer" | "merchant") {
    if (!supabase) return;
    setSaving(true);
    setError("");
    try {
      const cleanReferral = cleanReferralCode(referralCode);
      const profilePrimaryEmail =
        primaryEmail.trim().toLowerCase() || email.trim().toLowerCase();
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error("invalid_session");
      const response = await fetch(
        role === "buyer" ? "/api/buyer/onboarding" : "/api/merchant/registration",
        {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          role === "buyer"
            ? {
                fullName,
                mobile,
                primaryEmail: profilePrimaryEmail,
                recoveryEmail: recoveryEmail.trim().toLowerCase() || null,
                language: locale,
                theme: theme === "dark" ? "dark" : "light",
                ...(cleanReferral
                  ? {
                      referralCode: cleanReferral,
                      referralDeviceFingerprint: referralDeviceFingerprint(),
                      referralDeviceFamilyFingerprint:
                        referralDeviceFamilyFingerprint(),
                    }
                  : {}),
              }
            : {
                action: "complete_profile",
                fullName,
                mobile,
                recoveryEmail: recoveryEmail.trim().toLowerCase() || null,
                email: profilePrimaryEmail,
                locale,
                role: "merchant",
                theme: theme === "dark" ? "dark" : "light",
              },
        ),
        },
      );
      const payload = await response.json();
      if (!response.ok)
        throw new Error(String(payload.error ?? "profile_save_failed"));
      if (role === "buyer" && cleanReferral) forgetReferralCode();
      window.location.assign(role === "buyer" ? "/buyer" : "/merchant-register");
    } catch (profileError) {
      setError(humanError(profileError, locale));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-top">
        <Brand locale={locale} />
        <div>
          <button
            className="icon-button"
            type="button"
            onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
          >
            <Icon name="globe" />
            <span>{locale === "ar" ? "EN" : "ع"}</span>
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} />
          </button>
        </div>
      </div>
      <div className="auth-layout">
        <aside>
          <span className="eyebrow light">
            <Icon name="globe" />
            {locale === "ar" ? "سعرلي للمشتري" : "Saarly for buyers"}
          </span>
          <h1>
            {locale === "ar"
              ? "كل أدوات المشتري من التطبيق متاحة على الموقع"
              : "Every buyer tool from the app, now on the web"}
          </h1>
          <p>
            {locale === "ar"
              ? "اطلب تسعير، قارن العروض، تابع طلباتك، تصفح المتاجر واحفظ المفضلة وتنبيهات الأسعار من أي جهاز."
              : "Request quotes, compare offers, track orders, browse stores, and manage favorites and price alerts from any device."}
          </p>
          <ul>
            <li>
              <Icon name="quote" />
              {locale === "ar"
                ? "طلبات يدوية أو صورة أو PDF أو تسجيل صوتي"
                : "Manual, image, PDF, or voice requests"}
            </li>
            <li>
              <Icon name="compare" />
              {locale === "ar"
                ? "عروض وأسعار حسب موقعك وعملتك"
                : "Offers and prices for your location and currency"}
            </li>
            <li>
              <Icon name="shield" />
              {locale === "ar"
                ? "نفس الحساب والبيانات بين الموقع والتطبيق"
                : "The same account and data across web and app"}
            </li>
          </ul>
        </aside>
        <section className="auth-card otp-auth-card">
          <div className="portal-subtabs auth-mode-tabs">
            <button
              type="button"
              className={mode === "signin" ? "active" : ""}
              onClick={() => reset("signin")}
            >
              {locale === "ar" ? "تسجيل الدخول" : "Sign in"}
            </button>
            <button
              type="button"
              className={mode === "signup" ? "active" : ""}
              onClick={() => reset("signup")}
            >
              {locale === "ar" ? "حساب مشتري جديد" : "New buyer account"}
            </button>
          </div>
          <span className="eyebrow">
            <Icon name="receipt" />
            {locale === "ar" ? "بوابة المشتري" : "Buyer portal"}
          </span>
          <h2>
            {step === "email"
              ? mode === "signup"
                ? locale === "ar"
                  ? "أنشئ حسابك"
                  : "Create your account"
                : locale === "ar"
                  ? "سجّل دخولك"
                  : "Sign in"
              : step === "code"
                ? locale === "ar"
                  ? "اكتب رمز الدخول"
                  : "Enter the code"
                : step === "profile"
                  ? locale === "ar"
                    ? "كمّل بيانات الحساب"
                    : "Complete your profile"
                : locale === "ar"
                  ? "اختار نوع الحساب"
                  : "Choose account type"}
          </h2>
          <p>
            {step === "email"
              ? locale === "ar"
                ? "اكتب بريدك وسنرسل لك رمزًا لمرة واحدة بدون كلمة مرور."
                : "Enter your email and we will send a one-time code—no password needed."
              : step === "code"
                ? email.trim().toLowerCase()
                : step === "profile"
                  ? locale === "ar"
                    ? "الاسم ورقم الهاتف مطلوبان لتشغيل الطلبات والتواصل الآمن."
                    : "Your name and phone are required for requests and secure communication."
                : locale === "ar"
                  ? "نفس الحساب يقدر يكمل كمشتري أو يبدأ تسجيل متجر جديد."
                  : "The same account can continue as a buyer or start a new merchant registration."}
          </p>
          {step === "email" ? (
            <form onSubmit={sendCode}>
              <label>
                {locale === "ar" ? "البريد الإلكتروني" : "Email"}
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="name@example.com"
                />
              </label>
              <label className="remember-row">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                <span>
                  <strong>
                    {locale === "ar" ? "تذكرني على الجهاز" : "Remember me"}
                  </strong>
                  <small>
                    {locale === "ar"
                      ? "يمكنك تسجيل الخروج في أي وقت."
                      : "You can sign out at any time."}
                  </small>
                </span>
              </label>
              {message ? <p className="form-notice">{message}</p> : null}
              {error ? <p className="form-error">{error}</p> : null}
              <button className="button primary full" disabled={saving}>
                {saving
                  ? locale === "ar"
                    ? "جارٍ الإرسال"
                    : "Sending"
                  : locale === "ar"
                    ? "إرسال رمز الدخول"
                    : "Send code"}
                <Icon name="mail" />
              </button>
            </form>
          ) : null}
          {step === "code" ? (
            <form onSubmit={verifyCode}>
              <label>
                {locale === "ar" ? "رمز الدخول" : "Sign-in code"}
                <input
                  className="otp-input"
                  required
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(event) =>
                    setOtp(event.target.value.replace(/\D/g, ""))
                  }
                  autoComplete="one-time-code"
                />
              </label>
              {message ? <p className="form-notice">{message}</p> : null}
              {error ? <p className="form-error">{error}</p> : null}
              <button className="button primary full" disabled={saving}>
                {saving
                  ? locale === "ar"
                    ? "جارٍ التحقق"
                    : "Verifying"
                  : locale === "ar"
                    ? "فتح حسابي"
                    : "Open my account"}
              </button>
              <button
                className="button secondary full"
                type="button"
                disabled={saving || resendIn > 0}
                onClick={() => void sendCode()}
              >
                {resendIn > 0
                  ? locale === "ar"
                    ? `إعادة الإرسال بعد ${resendIn} ث`
                    : `Resend in ${resendIn}s`
                  : locale === "ar"
                    ? "إرسال رمز جديد"
                    : "Send another code"}
              </button>
            </form>
          ) : null}
          {step === "profile" ? (
            <form onSubmit={saveProfile}>
              <label>
                {locale === "ar" ? "الاسم بالكامل" : "Full name"}
                <input
                  required
                  minLength={2}
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  autoComplete="name"
                />
              </label>
              <label>
                {locale === "ar" ? "رقم الهاتف" : "Phone number"}
                <input
                  required
                  minLength={7}
                  value={mobile}
                  onChange={(event) => setMobile(event.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                />
              </label>
              <label>
                {locale === "ar" ? "البريد الأساسي" : "Primary email"}
                <input
                  required
                  type="email"
                  value={primaryEmail}
                  onChange={(event) => setPrimaryEmail(event.target.value)}
                  autoComplete="email"
                />
              </label>
              <label>
                {locale === "ar"
                  ? "بريد استرداد اختياري"
                  : "Optional recovery email"}
                <input
                  type="email"
                  value={recoveryEmail}
                  onChange={(event) => setRecoveryEmail(event.target.value)}
                  autoComplete="email"
                />
              </label>
              <label>
                {locale === "ar" ? "كود إحالة اختياري" : "Optional referral code"}
                <input
                  value={referralCode}
                  onChange={(event) =>
                    setReferralCode(event.target.value.toUpperCase())
                  }
                  autoComplete="off"
                />
                <small>
                  {locale === "ar"
                    ? "لو حد دعاك لسعرلي، اكتب كوده هنا قبل حفظ الحساب."
                    : "If someone invited you to Saarly, enter the code before saving."}
                </small>
              </label>
              {error ? <p className="form-error">{error}</p> : null}
              <button className="button primary full" disabled={saving}>
                {saving
                  ? locale === "ar"
                    ? "جارٍ الحفظ"
                    : "Saving"
                  : locale === "ar"
                    ? "متابعة"
                    : "Continue"}
              </button>
            </form>
          ) : null}
          {step === "accountType" ? (
            <div className="account-type-step">
              <div className="choice-grid">
                <button
                  className="choice-card compact account-type-card"
                  type="button"
                  disabled={saving}
                  onClick={() => void chooseAccountType("buyer")}
                >
                  <Icon name="receipt" />
                  <strong>{locale === "ar" ? "مشتري" : "Buyer"}</strong>
                  <small>
                    {locale === "ar"
                      ? "اطلب تسعير، قارن العروض، تابع طلباتك، واحفظ المتاجر والمنتجات."
                      : "Request quotes, compare offers, track orders, and save stores and products."}
                  </small>
                </button>
                <button
                  className="choice-card compact account-type-card"
                  type="button"
                  disabled={saving}
                  onClick={() => void chooseAccountType("merchant")}
                >
                  <Icon name="store" />
                  <strong>{locale === "ar" ? "متجر" : "Merchant"}</strong>
                  <small>
                    {locale === "ar"
                      ? "كمّل تسجيل المتجر، ارفع المستندات، ثم انتظر مراجعة الإدارة."
                      : "Complete store registration, upload documents, then wait for admin review."}
                  </small>
                </button>
              </div>
              <p className="form-notice">
                {locale === "ar"
                  ? "إذا واجهت مشكلة في التسجيل، تواصل مع الدعم عبر: support@saarly.app"
                  : "If you face registration issues, contact support at: support@saarly.app"}
              </p>
              {error ? <p className="form-error">{error}</p> : null}
              <button
                className="button secondary full"
                type="button"
                disabled={saving}
                onClick={() => {
                  if (!supabase) return;
                  void supabase.auth.signOut().then(() => window.location.assign("/login"));
                }}
              >
                <Icon name="logout" />
                {locale === "ar" ? "تسجيل الخروج" : "Sign out"}
              </button>
            </div>
          ) : null}
          <div className="auth-links">
            <Link href="/">
              {locale === "ar" ? "العودة للرئيسية" : "Back home"}
            </Link>
            <Link href="/merchant-login">
              {locale === "ar" ? "دخول المتاجر" : "Merchant login"}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
