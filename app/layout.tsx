import type { Metadata, Viewport } from "next";
import { AppProvider } from "@/components/AppProvider";
import { LanguageProvider } from "@/components/LanguageProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SettingsProvider } from "@/components/SettingsProvider";
import AppHeader from "@/components/AppHeader";
import "./globals.css";

export const metadata: Metadata = {
  title: "NutriScan AI — Label to Health Insight",
  description:
    "Scan packaged-food barcodes or labels. AI verdicts matched to your goals, allergies and doctor's advice — spoken aloud, in your language. Informational only, never medical advice.",
  applicationName: "NutriScan AI",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7ecdd" },
    { media: "(prefers-color-scheme: dark)", color: "#130c09" },
  ],
};

const themeInit = `
try {
  var saved = localStorage.getItem('nutriscan.theme');
  var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var resolved = saved === 'light' || saved === 'dark' ? saved : (systemDark ? 'dark' : 'light');
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
} catch (_) { document.documentElement.dataset.theme = 'light'; }
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: browser extensions inject attributes (e.g. bis_skin_checked) pre-hydration — harmless
    <html lang="en" className="h-full antialiased" data-theme="light" suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <ThemeProvider>
          <SettingsProvider>
            <LanguageProvider>
              <AppProvider>
                <AppHeader />
                <div className="flex flex-1 flex-col">{children}</div>
              </AppProvider>
            </LanguageProvider>
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
