"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Brand } from "@/components/brand";
import { Icon } from "@/components/icons";
import { useSitePreferences } from "@/components/site-preferences";
import { t } from "@/lib/locale";
import {
  faqs,
  howSteps,
  merchantFeatures,
  navItems,
  policyContent,
  siteConfig,
  type Bilingual,
  type Locale,
} from "@/lib/site-content";
import { supabase } from "@/lib/supabase";

type PolicyKind = keyof typeof policyContent;

type IconName = Parameters<typeof Icon>[0]["name"];

function label(item: Bilingual, locale: Locale) {
  return t(item, locale);
}

function useReveal() {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -5%" },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);
}

export function SiteNav() {
  const { locale, setLocale, theme, setTheme } = useSitePreferences();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function closeOnDesktop() {
      if (window.innerWidth > 1080) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("resize", closeOnDesktop);
    window.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      window.removeEventListener("resize", closeOnDesktop);
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="site-header">
      <nav className="nav container" aria-label={locale === "ar" ? "التنقل الرئيسي" : "Main navigation"}>
        <Brand locale={locale} />
        <button
          className="icon-button mobile-menu-button"
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="public-navigation"
          aria-label={open ? (locale === "ar" ? "إغلاق القائمة" : "Close menu") : (locale === "ar" ? "فتح القائمة" : "Open menu")}
        >
          <Icon name={open ? "close" : "menu"} />
        </button>
        <div className={`nav-panel ${open ? "open" : ""}`} id="public-navigation">
          <div className="nav-links">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                {label(item.label, locale)}
              </Link>
            ))}
          </div>
          <div className="nav-actions">
            <button
              className="icon-button preference-button"
              type="button"
              onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
              title={locale === "ar" ? "English" : "العربية"}
            >
              <Icon name="globe" />
              <span>{locale === "ar" ? "EN" : "ع"}</span>
            </button>
            <button
              className="icon-button preference-button"
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={locale === "ar" ? "تغيير المظهر" : "Change appearance"}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} />
            </button>
            <Link className="button secondary compact buyer-login-button" href="/login" onClick={() => setOpen(false)}>
              {locale === "ar" ? "دخول المشتري" : "Buyer sign in"}
            </Link>
            <Link className="button secondary compact merchant-login-button" href="/merchant-login" onClick={() => setOpen(false)}>
              {locale === "ar" ? "دخول المتجر" : "Merchant sign in"}
            </Link>
            <Link className="button primary compact nav-download-button" href="/#download" onClick={() => setOpen(false)}>
              {locale === "ar" ? "حمّل التطبيق" : "Get the app"}
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}

function AppButtons({ locale, compact = false }: { locale: Locale; compact?: boolean }) {
  const buttons = [
    { name: "Google Play", url: siteConfig.googlePlayUrl },
    { name: "App Store", url: siteConfig.appStoreUrl },
  ];

  return (
    <div className={`store-buttons ${compact ? "compact" : ""}`}>
      {buttons.map((item) =>
        item.url ? (
          <a className="store-button" href={item.url} key={item.name} target="_blank" rel="noreferrer">
            <Icon name="download" />
            <span>
              <small>{locale === "ar" ? "تحميل من" : "Download on"}</small>
              <strong>{item.name}</strong>
            </span>
          </a>
        ) : (
          <span className="store-button disabled" key={item.name} aria-disabled="true">
            <Icon name="download" />
            <span>
              <small>{locale === "ar" ? "قريبًا على" : "Coming soon on"}</small>
              <strong>{item.name}</strong>
            </span>
          </span>
        ),
      )}
    </div>
  );
}

function IllustrativePhone({ locale }: { locale: Locale }) {
  const products = locale === "ar"
    ? ["كابل نحاس 3 مم", "محبس مياه", "دهان داخلي"]
    : ["3 mm copper cable", "Water valve", "Interior paint"];

  return (
    <div className="hero-visual" aria-label={locale === "ar" ? "تصور توضيحي لمسار مقارنة الأسعار" : "Illustrative price-comparison flow"}>
      <div className="phone-stage">
        <div className="visual-orbit orbit-one" />
        <div className="visual-orbit orbit-two" />
        <div className="phone-frame">
          <div className="phone-top">
            <span className="phone-speaker" />
            <strong>{locale === "ar" ? "طلب تسعير" : "Quote request"}</strong>
            <span className="phone-bell"><Icon name="bell" size={17} /></span>
          </div>
          <div className="phone-content">
            <div className="mock-progress"><span className="active" /><span className="active" /><span /><span /></div>
            <div className="mock-heading">
              <small>{locale === "ar" ? "الخطوة 2 من 4" : "Step 2 of 4"}</small>
              <div className="mock-title">{locale === "ar" ? "راجع البنود قبل الإرسال" : "Review items before sending"}</div>
            </div>
            <div className="mock-list">
              {products.map((name, index) => (
                <div className="mock-row" key={name}>
                  <span className="mock-icon"><Icon name={index === 2 ? "box" : "check"} size={17} /></span>
                  <div>
                    <strong>{name}</strong>
                    <small>{locale === "ar" ? `${index + 1} × قطعة` : `${index + 1} × item`}</small>
                  </div>
                  <Icon name="chevron" size={16} />
                </div>
              ))}
            </div>
            <div className="mock-total"><span>{locale === "ar" ? "إجمالي البنود" : "Total items"}</span><strong>3</strong></div>
            <div className="mock-button">{locale === "ar" ? "أرسل الطلب" : "Send request"}<Icon name="arrow" size={17} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HomePage() {
  const { locale } = useSitePreferences();
  useReveal();

  const trustItems: Array<{ icon: IconName; ar: string; en: string }> = [
    { icon: "list", ar: "طلب واحد منظم", en: "One organised request" },
    { icon: "clock", ar: "وقت أقل في البحث", en: "Less search time" },
    { icon: "compare", ar: "ردود أسهل في المقارنة", en: "Easier offer comparison" },
    { icon: "shield", ar: "تحكم أفضل في بياناتك", en: "Better control of your data" },
  ];

  const merchantHowSteps = [
    { number: "01", icon: "upload" as IconName, arTitle: "سجّل متجرك", enTitle: "Register your store", arBody: "ابدأ التسجيل من الموقع أو التطبيق وأدخل بيانات المتجر الأساسية.", enBody: "Start registration on the website or app and enter the core store details." },
    { number: "02", icon: "shield" as IconName, arTitle: "أكمل التحقق", enTitle: "Complete verification", arBody: "ارفع المستندات المطلوبة وتابع حالة المراجعة بوضوح.", enBody: "Upload the required documents and follow the review status clearly." },
    { number: "03", icon: "quote" as IconName, arTitle: "استقبل الطلبات", enTitle: "Receive requests", arBody: "بعد الاعتماد قم برفع منتجاتك واستقبل الطلبات في واجهة منظمة سهلة الإدارة.", enBody: "After approval, upload your products and receive requests in an organised, easy-to-manage interface." },
    { number: "04", icon: "desktop" as IconName, arTitle: "أدِر العمل", enTitle: "Run operations", arBody: "تابع المنتجات والفروع والفريق والطلبات من مكان واحد.", enBody: "Manage products, branches, staff, and orders from one place." },
  ];

  return (
    <main className="site-shell">
      <SiteNav />

      <section className="hero-section">
        <div className="container hero-grid">
          <div className="hero-copy reveal is-visible" data-reveal>
            <span className="eyebrow hero-eyebrow"><Icon name="receipt" size={18} />{locale === "ar" ? "طلب واحد، مقارنة أوضح" : "One request, clearer comparison"}</span>
            <h1>
              {locale === "ar" ? (
                <>
                  <span className="hero-title-line">اطلب احتياجاتك وقارن</span>
                  <span className="hero-title-line">عروض المتاجر</span>
                  <span className="hero-title-line hero-title-accent">في مكان واحد</span>
                </>
              ) : (
                <>
                  <span className="hero-title-line">Request what you need and compare</span>
                  <span className="hero-title-line">store offers</span>
                  <span className="hero-title-line hero-title-accent">in one place</span>
                </>
              )}
            </h1>
            <p>{locale === "ar" ? "ارفع فاتورة أو ملفًا، أو اكتب البنود بنفسك. راجع طلبك، واستقبل ردود المتاجر المناسبة، ثم اختر العرض الذي يناسب احتياجك." : "Upload an invoice or file, or enter items yourself. Review the request, receive responses from relevant stores, and choose the offer that fits your needs."}</p>
            <div className="hero-actions">
              <a className="button primary hero-primary" href="#download">{locale === "ar" ? "حمّل التطبيق" : "Get the app"}<Icon name="arrow" /></a>
              <a className="button secondary" href="#how-it-works">{locale === "ar" ? "شاهد طريقة العمل" : "See how it works"}<Icon name="history" size={18} /></a>
              <Link className="button primary" href="/merchant-register">{locale === "ar" ? "سجل متجرك" : "Register your store"}<Icon name="plus" size={18} /></Link><Link className="button secondary" href="/merchant-login">{locale === "ar" ? "دخول المتجر" : "Merchant sign in"}<Icon name="store" size={18} /></Link><Link className="button secondary" href="/login">{locale === "ar" ? "دخول المشتري" : "Buyer sign in"}<Icon name="receipt" size={18} /></Link>
            </div>
            <div className="hero-trust">
              <span><Icon name="shield" />{locale === "ar" ? "بياناتك محمية" : "Protected data"}</span>
              <span><Icon name="compare" />{locale === "ar" ? "تفاصيل واضحة" : "Clear details"}</span>
              <span><Icon name="history" />{locale === "ar" ? "متابعة من مكان واحد" : "One-place tracking"}</span>
            </div>
          </div>
          <IllustrativePhone locale={locale} />
        </div>
      </section>

      <section className="trust-strip" aria-label={locale === "ar" ? "مزايا سريعة" : "Quick benefits"}>
        <div className="container trust-grid">
          {trustItems.map((item) => (
            <div key={item.en}><Icon name={item.icon} /><span>{locale === "ar" ? item.ar : item.en}</span></div>
          ))}
        </div>
      </section>

      <section className="section container how-section" id="how-it-works">
        <SectionHead
          eyebrow={locale === "ar" ? "كيف يعمل سعرلي" : "How Saarly works"}
          title={locale === "ar" ? "رحلتان واضحتان للمشتري والمتجر" : "Two clear journeys for buyers and stores"}
          body={locale === "ar" ? "كل طرف يرى الخطوات التي تخصه فقط، من البداية وحتى الوصول إلى النتيجة المطلوبة." : "Each side sees only the steps that matter, from the first action to the intended outcome."}
        />
        <div className="journey-stack">
          <article className="journey-panel buyer-journey reveal" data-reveal>
            <header className="journey-head">
              <span className="journey-icon"><Icon name="users" /></span>
              <div>
                <span className="eyebrow">{locale === "ar" ? "للمشتري" : "For buyers"}</span>
                <h3>{locale === "ar" ? "من الاحتياج إلى العرض الأنسب في أربع خطوات" : "From a need to the right offer in four steps"}</h3>
                <p>{locale === "ar" ? "أنشئ طلبًا منظمًا، راجع التفاصيل، قارن الردود، ثم اختر بثقة." : "Create an organised request, review the details, compare responses, and choose confidently."}</p>
              </div>
            </header>
            <div className="journey-steps">
              {howSteps.map((step) => (
                <article className="step-card interactive-card" key={`buyer-${step.number}`}>
                  <span className="step-number">{step.number}</span>
                  <span className="feature-icon"><Icon name={step.icon as IconName} /></span>
                  <h4>{label(step.title, locale)}</h4>
                  <p>{label(step.body, locale)}</p>
                </article>
              ))}
            </div>
          </article>

          <article className="journey-panel merchant-journey reveal" data-reveal>
            <header className="journey-head">
              <span className="journey-icon"><Icon name="store" /></span>
              <div>
                <span className="eyebrow">{locale === "ar" ? "للمتجر" : "For stores"}</span>
                <h3>{locale === "ar" ? "من التسجيل إلى إدارة العمل في أربع خطوات" : "From registration to daily operations in four steps"}</h3>
                <p>{locale === "ar" ? "أكمل التسجيل والتحقق، ثم استخدم واجهة واحدة لاستقبال الطلبات وإدارة فروعك وفريق العمل الخاص بك." : "Complete registration and verification, then use one interface to receive requests and manage your branches and team."}</p>
              </div>
            </header>
            <div className="journey-steps">
              {merchantHowSteps.map((step) => (
                <article className="step-card interactive-card" key={`merchant-${step.number}`}>
                  <span className="step-number">{step.number}</span>
                  <span className="feature-icon"><Icon name={step.icon} /></span>
                  <h4>{locale === "ar" ? step.arTitle : step.enTitle}</h4>
                  <p>{locale === "ar" ? step.arBody : step.enBody}</p>
                </article>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="section merchant-section" id="merchants">
        <div className="container merchant-layout">
          <div className="merchant-copy reveal" data-reveal>
            <span className="eyebrow light"><Icon name="store" />{locale === "ar" ? "مساحة عمل المتجر" : "Store workspace"}</span>
            <h2 className="merchant-main-title">{locale === "ar" ? (<><span>كل ما تحتاجه للإدارة</span><span>في مكان واحد</span></>) : (<><span>Everything you need to manage</span><span>in one place</span></>)}</h2>
            <p>{locale === "ar" ? "بعد اعتماد المتجر، استخدم الحساب نفسه لمتابعة المنتجات والفروع والموظفين والطلبات وحالة الحساب من الكمبيوتر أو التطبيق." : "After approval, use the same account to manage products, branches, staff, requests, and account status from desktop or mobile."}</p>
            <div className="merchant-cta">
              <Link className="button light-primary" href="/merchant-register">{locale === "ar" ? "ابدأ تسجيل المتجر" : "Start merchant registration"}<Icon name="arrow" /></Link>
              <a className="button light-secondary" href="#download">{locale === "ar" ? "سجّل متجرك من التطبيق" : "Register through the app"}</a>
            </div>
          </div>
          <div className="merchant-feature-list">
            {merchantFeatures.map((feature) => (
              <article className="reveal" data-reveal key={feature.title.en}>
                <span><Icon name={feature.icon as IconName} /></span>
                <div><h3>{label(feature.title, locale)}</h3><p>{label(feature.body, locale)}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section container why-section" id="trust">
        <div className="why-panel reveal" data-reveal>
          <div className="why-copy">
            <span className="eyebrow light"><Icon name="shield" />{locale === "ar" ? "الثقة والأمان" : "Trust and safety"}</span>
            <h2>{locale === "ar" ? "المعلومات الحساسة تظهر فقط في المسار المسموح" : "Sensitive information appears only in the authorised flow"}</h2>
            <p>{locale === "ar" ? "تخضع المتاجر للمراجعة قبل استقبال الطلبات، وتظل مستندات التحقق داخل تخزين خاص، مع صلاحيات محددة للوصول." : "Stores are reviewed before receiving requests. Verification documents remain in private storage with controlled access."}</p>
          </div>
          <div className="security-list">
            <div><span><Icon name="shield" /></span><div><strong>{locale === "ar" ? "صلاحيات واضحة" : "Clear permissions"}</strong><small>{locale === "ar" ? "الوصول حسب دور المستخدم" : "Access based on user role"}</small></div></div>
            <div><span><Icon name="receipt" /></span><div><strong>{locale === "ar" ? "شراء المشترين مستقل" : "Buyer purchases stay separate"}</strong><small>{locale === "ar" ? "طلبات المنتجات لا تختلط باشتراك المتجر في سعرلي" : "Product orders do not mix with Saarly merchant subscription"}</small></div></div>
            <div><span><Icon name="mail" /></span><div><strong>{locale === "ar" ? "دعم وسياسات واضحة" : "Support and clear policies"}</strong><small>{locale === "ar" ? "قنوات مساعدة وإدارة للحساب" : "Help and account-management channels"}</small></div></div>
          </div>
        </div>
      </section>

      <section className="section surface-section" id="faq">
        <div className="container faq-layout">
          <div className="faq-intro">
            <SectionHead
              eyebrow={locale === "ar" ? "الأسئلة الشائعة" : "Frequently asked questions"}
              title={locale === "ar" ? "إجابات مباشرة قبل أن تبدأ" : "Straight answers before you start"}
              body={locale === "ar" ? "اعرف طريقة إنشاء الطلب، التعامل مع العروض، ودخول المتاجر إلى البوابة." : "Learn how requests, offers, and merchant portal access work."}
            />
            <Link className="button secondary" href="/support">{locale === "ar" ? "تواصل مع الدعم" : "Contact support"}<Icon name="mail" /></Link>
          </div>
          <div className="faq-list">
            {faqs.map((faq, index) => (
              <details key={faq.question.en} open={index === 0}>
                <summary><span>{label(faq.question, locale)}</span><Icon name="plus" /></summary>
                <p>{label(faq.answer, locale)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="section container" id="download">
        <div className="download-panel reveal" data-reveal>
          <div>
            <span className="eyebrow"><Icon name="download" />{locale === "ar" ? "ابدأ من موبايلك" : "Start on your phone"}</span>
            <h2>{locale === "ar" ? "اجمع احتياجاتك في طلب واحد واضح" : "Bring your needs into one clear request"}</h2>
            <p>{locale === "ar" ? "روابط التحميل ستظهر فور إضافة روابط المتاجر الرسمية." : "Download links will activate as soon as the official store listings are available."}</p>
          </div>
          <AppButtons locale={locale} />
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function SectionHead({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return <div className="section-head"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{body}</p></div>;
}

export function PolicyPage({ kind }: { kind: PolicyKind }) {
  const { locale } = useSitePreferences();
  const policy = policyContent[kind];
  return (
    <main className="site-shell">
      <SiteNav />
      <article className="legal-page container">
        <header className="legal-hero">
          <span className="eyebrow"><Icon name="shield" />{locale === "ar" ? "سياسات سعرلي" : "Saarly policies"}</span>
          <h1>{label(policy.title, locale)}</h1>
          <p>{label(policy.intro, locale)}</p>
          <div className="legal-meta">
            <span><Icon name="history" size={17} />{label(policy.updated, locale)}</span>
            {policy.legalReview ? <span className="legal-review"><Icon name="info" size={17} />{locale === "ar" ? "تحتاج مراجعة قانونية نهائية قبل النشر التجاري" : "Final legal review is required before commercial publication"}</span> : null}
          </div>
        </header>
        <div className="legal-sections">
          {policy.sections.map((section, index) => (
            <section key={section.title.en}>
              <span className="legal-index">{String(index + 1).padStart(2, "0")}</span>
              <div><h2>{label(section.title, locale)}</h2><p>{label(section.body, locale)}</p></div>
            </section>
          ))}
        </div>
      </article>
      <SiteFooter />
    </main>
  );
}

export function SupportPage({ deletion = false }: { deletion?: boolean }) {
  const { locale } = useSitePreferences();
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: deletion ? (locale === "ar" ? "طلب حذف حساب" : "Account deletion request") : "",
    message: "",
  });
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const [linkedAccount, setLinkedAccount] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase?.auth.getSession().then(({ data }) => {
      if (!alive || !data.session?.user) return;
      const user = data.session.user;
      setLinkedAccount(true);
      setForm((current) => ({
        ...current,
        email: current.email || user.email || "",
        name: current.name || String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? ""),
      }));
    });
    return () => { alive = false; };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setState("sending");
    setError("");
    try {
      const token = supabase
        ? (await supabase.auth.getSession()).data.session?.access_token
        : undefined;
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ ...form, locale }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "support_request_failed");
      setState("sent");
      setForm((current) => ({ ...current, message: "" }));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "support_request_failed");
      setState("error");
    }
  }

  return (
    <main className="site-shell">
      <SiteNav />
      {deletion ? (
        <article className="legal-page container compact-legal">
          <header className="legal-hero">
            <span className="eyebrow"><Icon name="trash" />{locale === "ar" ? "حذف الحساب" : "Delete account"}</span>
            <h1>{label(policyContent.deleteAccount.title, locale)}</h1>
            <p>{label(policyContent.deleteAccount.intro, locale)}</p>
            <div className="legal-meta"><span><Icon name="history" size={17} />{label(policyContent.deleteAccount.updated, locale)}</span></div>
          </header>
          <div className="legal-sections compact-sections">
            {policyContent.deleteAccount.sections.map((section, index) => (
              <section key={section.title.en}><span className="legal-index">{String(index + 1).padStart(2, "0")}</span><div><h2>{label(section.title, locale)}</h2><p>{label(section.body, locale)}</p></div></section>
            ))}
          </div>
        </article>
      ) : null}
      <section className="support-section container">
        <div className="support-copy">
          <span className="eyebrow"><Icon name="mail" />{deletion ? (locale === "ar" ? "طلب حذف الحساب" : "Account deletion") : (locale === "ar" ? "الدعم والمساعدة" : "Support and help")}</span>
          <h1>{deletion ? (locale === "ar" ? "أرسل الطلب من البريد المرتبط بحسابك" : "Submit from the email linked to your account") : (locale === "ar" ? (<><span className="support-title-line">احكِ لنا المشكلة</span><span className="support-title-line">وسنتابعها معك</span></>) : (<><span className="support-title-line">Tell us about the problem</span><span className="support-title-line">and we will follow up with you</span></>) )}</h1>
          <p>{locale === "ar" ? "اكتب التفاصيل بوضوح، وأضف البريد المرتبط بالحساب لتسهيل المراجعة والرد." : "Describe the issue clearly and include the email linked to your account to help us review and respond."}</p>
          <div className="support-points">
            <span><Icon name="shield" />{locale === "ar" ? "تُحفظ الطلبات للمراجعة الآمنة" : "Requests are stored for secure review"}</span>
            <span><Icon name="history" />{locale === "ar" ? "يساعد الموضوع الواضح على سرعة المتابعة" : "A clear subject helps faster follow-up"}</span>
          </div>
          {siteConfig.supportEmail ? <a className="support-email" href={`mailto:${siteConfig.supportEmail}`}><Icon name="mail" />{siteConfig.supportEmail}</a> : null}
        </div>
        <form className="support-form" onSubmit={submit}>
          <div className="support-form-head"><span className="feature-icon"><Icon name="mail" /></span><div><h2>{locale === "ar" ? "أرسل طلب دعم" : "Send a support request"}</h2><p>{locale === "ar" ? "لا تحتاج إلى تسجيل الدخول. سنرسل طلبك مباشرة إلى فريق الدعم ولوحة الإدارة." : "You do not need to sign in. Your request will go directly to the support team and admin panel."}</p></div></div>
          {linkedAccount ? <p className="account-linked-notice"><Icon name="shield" size={17} />{locale === "ar" ? "تم التعرف على حسابك الحالي لتسهيل المراجعة فقط" : "Your current account was recognized only to help with review"}</p> : null}
          <div className="form-grid">
            <label>{locale === "ar" ? "الاسم" : "Name"}<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoComplete="name" placeholder={locale === "ar" ? "الاسم الكامل" : "Full name"} /></label>
            <label>{locale === "ar" ? "البريد الإلكتروني" : "Email"}<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="email" placeholder="name@example.com" /></label>
          </div>
          <label>{locale === "ar" ? "الموضوع" : "Subject"}<input required minLength={3} value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder={locale === "ar" ? "اكتب عنوانًا مختصرًا للمشكلة" : "Write a short issue title"} /></label>
          <label>{locale === "ar" ? "التفاصيل" : "Details"}<textarea required minLength={10} maxLength={5000} rows={7} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder={locale === "ar" ? "اشرح ما حدث والخطوات التي جربتها" : "Explain what happened and what you already tried"} /></label>
          {state === "sent" ? <p className="form-success">{locale === "ar" ? "تم إرسال طلبك إلى فريق الدعم بنجاح." : "Your support request was sent successfully."}</p> : null}
          {state === "error" ? <p className="form-error">{locale === "ar" ? `تعذر الإرسال: ${error}` : `Could not send: ${error}`}</p> : null}
          <button className="button primary" type="submit" disabled={state === "sending"}>{state === "sending" ? (locale === "ar" ? "جارٍ الإرسال" : "Sending") : (locale === "ar" ? "إرسال الطلب" : "Send request")}<Icon name="arrow" /></button>
        </form>
      </section>
      <SiteFooter />
    </main>
  );
}

export function SiteFooter() {
  const { locale } = useSitePreferences();
  const year = new Date().getFullYear();
  const links = [
    { href: "/privacy", ar: "الخصوصية", en: "Privacy" },
    { href: "/terms", ar: "الشروط", en: "Terms" },
    { href: "/refund-policy", ar: "سياسة الاسترداد", en: "Refund policy" },
    { href: "/delete-account", ar: "حذف الحساب", en: "Delete account" },
    { href: "/support", ar: "الدعم", en: "Support" },
  ];

  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand-column">
          <Brand locale={locale} inverted />
          <p>{locale === "ar" ? "منصة لتنظيم طلبات التسعير ومقارنة ردود المتاجر في تجربة واحدة واضحة." : "A platform for organising quote requests and comparing store responses in one clear experience."}</p>
          {siteConfig.supportEmail ? <a href={`mailto:${siteConfig.supportEmail}`} className="footer-contact"><Icon name="mail" size={18} />{siteConfig.supportEmail}</a> : null}
        </div>
        <div><h3>{locale === "ar" ? "استكشف" : "Explore"}</h3><Link href="/#how-it-works">{locale === "ar" ? "كيف يعمل" : "How it works"}</Link><Link href="/#trust">{locale === "ar" ? "الثقة والأمان" : "Trust and safety"}</Link><Link href="/#merchants">{locale === "ar" ? "للمتاجر" : "For merchants"}</Link><Link href="/#faq">{locale === "ar" ? "الأسئلة الشائعة" : "FAQ"}</Link></div>
        <div><h3>{locale === "ar" ? "الحساب والدعم" : "Account and support"}</h3><Link href="/login">{locale === "ar" ? "دخول أو إنشاء حساب مشتري" : "Buyer sign in or sign up"}</Link><Link href="/merchant-register">{locale === "ar" ? "تسجيل متجر جديد" : "Register a new store"}</Link><Link href="/merchant-login">{locale === "ar" ? "تسجيل دخول للمتجر" : "Merchant sign in"}</Link><Link href="/support">{locale === "ar" ? "طلب دعم" : "Support request"}</Link>{links.slice(0, 2).map((item) => <Link href={item.href} key={item.href}>{locale === "ar" ? item.ar : item.en}</Link>)}</div>
        <div><h3>{locale === "ar" ? "السياسات" : "Policies"}</h3>{links.slice(2).map((item) => <Link href={item.href} key={item.href}>{locale === "ar" ? item.ar : item.en}</Link>)}</div>
      </div>
      <div className="container footer-bottom"><span>© {year} {label(siteConfig.name, locale)}</span><span>{locale === "ar" ? "صوّر، قارن، وفّر" : "Capture, compare, save"}</span></div>
    </footer>
  );
}
