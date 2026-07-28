import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { SitePreferencesProvider } from "@/components/site-preferences";
import { siteConfig } from "@/lib/site-content";
import "./globals.css";

const title = "سعرلي | صوّر، قارن، وفّر";
const description = "أرسل قائمة احتياجاتك، راجع البنود، وقارن عروض الأسعار من متاجر مناسبة. بوابة متاجر عملية لإدارة المنتجات وطلبات التسعير والاشتراك.";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: { default: title, template: "%s | سعرلي" },
  description,
  applicationName: "سعرلي",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ar_EG",
    alternateLocale: "en_US",
    siteName: "سعرلي",
    title,
    description,
    url: "/",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "سعرلي - صوّر، قارن، وفّر" }],
  },
  twitter: { card: "summary_large_image", title, description, images: ["/og-image.png"] },
  icons: { icon: "/icon.png", apple: "/icon.png" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, colorScheme: "light dark", themeColor: "#85BB64" };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var l=localStorage.getItem('saarly-locale')==='en'?'en':'ar';var t=localStorage.getItem('saarly-theme');t=t==='light'||t==='dark'?t:'system';var r=document.documentElement;r.lang=l;r.dir=l==='ar'?'rtl':'ltr';r.dataset.theme=t;r.style.colorScheme=t==='system'?'light dark':t;}catch(e){}})();`,
          }}
        />
        <SitePreferencesProvider>{children}</SitePreferencesProvider>
      </body>
    </html>
  );
}
