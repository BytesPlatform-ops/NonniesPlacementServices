import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { SmoothScrollProvider } from "@/components/animation/SmoothScrollProvider";
import { ScrollProgressBar } from "@/components/animation/ScrollProgressBar";
import { Preloader } from "@/components/layout/Preloader";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = "https://nonnisplacement.example";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Nonni's Placement Services — Right Care. Right Placement. Right Time.",
    template: "%s · Nonni's Placement Services",
  },
  description:
    "RN-led care placement for Washington State. Nonni's connects families, hospitals, discharge planners, and providers through human-reviewed, intelligent matching.",
  keywords: [
    "senior care placement",
    "RN-led placement",
    "assisted living Washington",
    "adult family home",
    "memory care",
    "skilled nursing",
    "care facility matching",
  ],
  authors: [{ name: "Nonni's Placement Services" }],
  openGraph: {
    title: "Nonni's Placement Services",
    description:
      "RN-led, intelligent care placement across Washington State — for families, hospitals, and providers.",
    type: "website",
    url: SITE_URL,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#472e16",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} h-full`}>
      <body className="min-h-full bg-porcelain text-[#2b1b0e] antialiased">
        {/* No-JS: never trap users behind the preloader overlay. */}
        <noscript>
          <style>{`#nonnis-preloader{display:none!important}`}</style>
        </noscript>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-navy focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-white"
        >
          Skip to content
        </a>
        <SmoothScrollProvider>
          <Preloader />
          <ScrollProgressBar />
          <Navbar />
          <main id="main">{children}</main>
          <Footer />
        </SmoothScrollProvider>
      </body>
    </html>
  );
}
