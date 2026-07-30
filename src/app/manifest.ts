import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "سعرلي",
    short_name: "سعرلي",
    description: "صوّر، قارن، وفّر",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#101611",
    theme_color: "#85BB64",
    lang: "ar",
    dir: "rtl",
    categories: ["shopping", "business", "productivity"],
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
