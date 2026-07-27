import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site-content";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["", "/privacy", "/terms", "/support", "/delete-account", "/refund-policy", "/merchant-login", "/forgot-password"];
  return paths.map((path) => ({ url: `${siteConfig.siteUrl}${path}`, lastModified: new Date(), changeFrequency: path === "" ? "weekly" : "monthly", priority: path === "" ? 1 : 0.6 }));
}
