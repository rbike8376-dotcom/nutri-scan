import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "NutriScan AI — Label to Health Insight",
    short_name: "NutriScan AI",
    description: "Scan packaged-food barcodes or labels and get a plain-language, personalised verdict — voice-read aloud, matched to your goals and allergies. Informational only, never medical advice.",
    start_url: "/",
    display: "standalone",
    background_color: "#130c09",
    theme_color: "#3a241f",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
