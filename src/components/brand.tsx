import Image from "next/image";
import Link from "next/link";
import { siteConfig, type Locale } from "@/lib/site-content";
import { t } from "@/lib/locale";

export function Brand({ locale, compact = false, inverted = false }: { locale: Locale; compact?: boolean; inverted?: boolean }) {
  return (
    <Link className={`brand ${compact ? "compact" : ""} ${inverted ? "inverted" : ""}`} href="/" aria-label={t(siteConfig.name, locale)}>
      <Image
        className="brand-logo brand-logo-light"
        src="/saarly-logo.png"
        alt={locale === "ar" ? "شعار سعرلي" : "Saarly logo"}
        width={compact ? 124 : 152}
        height={compact ? 42 : 52}
        priority
      />
      <Image
        className="brand-logo brand-logo-dark"
        src="/saarly-logo-dark.png"
        alt=""
        aria-hidden="true"
        width={compact ? 124 : 152}
        height={compact ? 42 : 52}
        priority
      />
    </Link>
  );
}
