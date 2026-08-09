"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Brand } from "@/components/brand";
import { Icon } from "@/components/icons";

export type PortalIconName = Parameters<typeof Icon>[0]["name"];
export type PortalNavItem = {
  key: string;
  href: string;
  ar: string;
  en: string;
  icon: PortalIconName;
  badge?: number;
  disabled?: boolean;
  hintAr?: string;
  hintEn?: string;
};
export type PortalNavGroup = { key: string; ar: string; en: string; items: PortalNavItem[] };

type Props = {
  kind: "buyer" | "merchant";
  locale: "ar" | "en";
  activeKey: string;
  groups: PortalNavGroup[];
  mobilePrimary: PortalNavItem[];
  identityTitle: string;
  identitySubtitle: string;
  identityIcon: PortalIconName;
  statusLabel: string;
  statusTone?: "ok" | "warning" | "danger";
  title: string;
  description: string;
  pageIcon: PortalIconName;
  headerActions?: ReactNode;
  utilityActions?: ReactNode;
  sidebarFooter?: ReactNode;
  children: ReactNode;
};

export function PortalAppShell({
  kind,
  locale,
  activeKey,
  groups,
  mobilePrimary,
  identityTitle,
  identitySubtitle,
  identityIcon,
  statusLabel,
  statusTone = "ok",
  title,
  description,
  pageIcon,
  headerActions,
  utilityActions,
  sidebarFooter,
  children,
}: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const dir = locale === "ar" ? "rtl" : "ltr";
  const allItems = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const primaryKeys = new Set(mobilePrimary.map((item) => item.key));
  const activeInPrimary = primaryKeys.has(activeKey);

  useEffect(() => {
    setDrawerOpen(false);
    setMobileMoreOpen(false);
  }, [activeKey]);

  return (
    <main className={`portal-v2 portal-v2-${kind}`} dir={dir}>
      <aside className={`portal-v2-sidebar ${drawerOpen ? "open" : ""}`}>
        <div className="portal-v2-brand-row">
          <Brand locale={locale} compact inverted />
          <button className="portal-v2-icon-button portal-v2-drawer-close" type="button" onClick={() => setDrawerOpen(false)} aria-label={locale === "ar" ? "إغلاق القائمة" : "Close navigation"}>
            <Icon name="close" size={19}/>
          </button>
        </div>

        <div className="portal-v2-identity">
          <span className="portal-v2-identity-icon"><Icon name={identityIcon} size={21}/></span>
          <div><strong>{identityTitle}</strong><small>{identitySubtitle}</small></div>
        </div>

        <nav className="portal-v2-nav" aria-label={locale === "ar" ? "التنقل الرئيسي" : "Primary navigation"}>
          {groups.map((group) => group.items.length ? (
            <section className="portal-v2-nav-group" key={group.key}>
              <p>{locale === "ar" ? group.ar : group.en}</p>
              <div>
                {group.items.map((item) => (
                  <PortalNavLink key={item.key} item={item} locale={locale} active={item.key === activeKey} onNavigate={() => setDrawerOpen(false)} />
                ))}
              </div>
            </section>
          ) : null)}
        </nav>

        <div className="portal-v2-sidebar-footer">{sidebarFooter}</div>
      </aside>

      {drawerOpen ? <button className="portal-v2-scrim" type="button" onClick={() => setDrawerOpen(false)} aria-label={locale === "ar" ? "إغلاق القائمة" : "Close navigation"}/> : null}

      <section className="portal-v2-main">
        <header className="portal-v2-topbar">
          <div className="portal-v2-topbar-start">
            <button className="portal-v2-icon-button portal-v2-menu-button" type="button" onClick={() => setDrawerOpen(true)} aria-label={locale === "ar" ? "فتح القائمة" : "Open navigation"}><Icon name="menu" size={20}/></button>
            <span className={`portal-v2-status-dot ${statusTone}`} />
            <div className="portal-v2-status-copy"><strong>{statusLabel}</strong><small>{locale === "ar" ? "متصل بحساب سعرلي" : "Synced with Saarly"}</small></div>
          </div>
          <div className="portal-v2-topbar-actions">{utilityActions}</div>
        </header>

        <div className="portal-v2-content">
          <header className="portal-v2-page-header">
            <div className="portal-v2-page-title-wrap">
              <span className="portal-v2-page-icon"><Icon name={pageIcon} size={22}/></span>
              <div><h1>{title}</h1><p>{description}</p></div>
            </div>
            {headerActions ? <div className="portal-v2-page-actions">{headerActions}</div> : null}
          </header>
          <div className="portal-v2-page-body">{children}</div>
        </div>
      </section>

      <nav className="portal-v2-mobile-nav" aria-label={locale === "ar" ? "التنقل السريع" : "Quick navigation"}>
        {mobilePrimary.slice(0, 4).map((item) => (
          <Link className={item.key === activeKey ? "active" : ""} href={item.href} key={item.key}>
            <span><Icon name={item.icon} size={21}/>{item.badge ? <i>{item.badge > 99 ? "99+" : item.badge}</i> : null}</span>
            <small>{locale === "ar" ? item.ar : item.en}</small>
          </Link>
        ))}
        <button className={!activeInPrimary ? "active" : ""} type="button" onClick={() => setMobileMoreOpen(true)}>
          <span><Icon name="menu" size={21}/></span>
          <small>{locale === "ar" ? "المزيد" : "More"}</small>
        </button>
      </nav>

      {mobileMoreOpen ? (
        <div className="portal-v2-sheet-layer" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setMobileMoreOpen(false); }}>
          <section className="portal-v2-sheet" role="dialog" aria-modal="true" aria-label={locale === "ar" ? "المزيد من الصفحات" : "More pages"}>
            <header><div><span className="portal-v2-sheet-handle"/><h2>{locale === "ar" ? "كل الأدوات" : "All tools"}</h2><p>{locale === "ar" ? "نفس أدوات الحساب مرتبة للوصول السريع من الموبايل." : "All account tools, organized for quick mobile access."}</p></div><button className="portal-v2-icon-button" type="button" onClick={() => setMobileMoreOpen(false)}><Icon name="close" size={19}/></button></header>
            <div className="portal-v2-sheet-grid">
              {allItems.map((item) => (
                <Link href={item.href} className={item.key === activeKey ? "active" : ""} key={item.key}>
                  <span><Icon name={item.icon} size={20}/>{item.badge ? <i>{item.badge}</i> : null}</span>
                  <div><strong>{locale === "ar" ? item.ar : item.en}</strong>{item.hintAr || item.hintEn ? <small>{locale === "ar" ? item.hintAr : item.hintEn}</small> : null}</div>
                  <Icon name="chevron" size={17}/>
                </Link>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function PortalNavLink({ item, locale, active, onNavigate }: { item: PortalNavItem; locale: "ar" | "en"; active: boolean; onNavigate: () => void }) {
  return (
    <Link href={item.href} className={`${active ? "active" : ""} ${item.disabled ? "disabled" : ""}`} aria-current={active ? "page" : undefined} onClick={onNavigate}>
      <span className="portal-v2-nav-icon"><Icon name={item.icon} size={19}/></span>
      <span className="portal-v2-nav-copy"><strong>{locale === "ar" ? item.ar : item.en}</strong>{item.hintAr || item.hintEn ? <small>{locale === "ar" ? item.hintAr : item.hintEn}</small> : null}</span>
      {item.badge ? <i>{item.badge > 99 ? "99+" : item.badge}</i> : null}
    </Link>
  );
}
