import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-content";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/privacy", "/terms", "/support", "/refund-policy", "/delete-account"],
        disallow: [
          "/api/",
          "/buyer",
          "/login",
          "/merchant",
          "/merchant-login",
          "/merchant-register",
          "/forgot-password",
          "/reset-password",
        ],
      },
    ],
    sitemap: `${siteConfig.siteUrl}/sitemap.xml`,
    host: siteConfig.siteUrl,
  };
}
