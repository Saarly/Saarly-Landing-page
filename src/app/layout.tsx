import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { SitePreferencesProvider } from "@/components/site-preferences";
import { siteConfig } from "@/lib/site-content";
import "./globals.css";

const title = "سعرلي | صوّر، قارن، وفّر";
const description = "أرسل قائمة احتياجاتك، راجع البنود، وقارن عروض الأسعار من متاجر مناسبة. بوابة متاجر عملية لإدارة المنتجات وطلبات التسعير والاشتراك.";
const ogImage = "/og-image.png";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: { default: title, template: "%s | سعرلي" },
  description,
  applicationName: "سعرلي",
  referrer: "origin-when-cross-origin",
  keywords: [
    "سعرلي",
    "تطبيق سعرلي",
    "مقارنة الأسعار",
    "عروض أسعار",
    "طلبات تسعير",
    "أسعار المتاجر",
    "بوابة المتاجر",
    "quote requests",
    "price comparison",
    "store offers",
    "merchant portal",
    "Saarly",
  ],
  authors: [{ name: "Saarly" }],
  creator: "Saarly",
  publisher: "Saarly",
  category: "shopping",
  formatDetection: { email: false, address: false, telephone: false },
  alternates: {
    canonical: "/",
    languages: {
      "ar-EG": "/",
      "en-US": "/",
    },
  },
  openGraph: {
    type: "website",
    locale: "ar_EG",
    alternateLocale: "en_US",
    siteName: "سعرلي",
    title,
    description,
    url: "/",
    images: [{ url: ogImage, width: 1200, height: 630, alt: "شعار سعرلي" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [ogImage],
  },
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
      { url: "/favicon.ico" },
    ],
    shortcut: ["/favicon.ico"],
    apple: [{ url: "/icon.png", sizes: "512x512", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "سعرلي",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#85BB64" },
    { media: "(prefers-color-scheme: dark)", color: "#85BB64" },
  ],
};

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
