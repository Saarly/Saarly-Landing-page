import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "سعرلي",
    short_name: "سعرلي",
    description: "صوّر، قارن، وفّر",
    start_url: "/",
    display: "standalone",
    background_color: "#F7F6F3",
    theme_color: "#85BB64",
    lang: "ar",
    dir: "rtl",
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
  };
}
