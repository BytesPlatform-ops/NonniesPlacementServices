import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nonnis Platform",
  description: "Nonnis Digital Optimization Platform — discharge operations console",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
