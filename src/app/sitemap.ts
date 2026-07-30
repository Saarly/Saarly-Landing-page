import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-content";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${siteConfig.siteUrl}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteConfig.siteUrl}/support`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteConfig.siteUrl}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.6 },
    { url: `${siteConfig.siteUrl}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.6 },
    { url: `${siteConfig.siteUrl}/refund-policy`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
    { url: `${siteConfig.siteUrl}/delete-account`, lastModified: now, changeFrequency: "yearly", priority: 0.5 },
  ];
}
