import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server's HMR/assets to be loaded when the app is opened from
  // a phone on the LAN (Mac Internet Sharing hotspot, Wi-Fi, or Ethernet IPs).
  allowedDevOrigins: ["192.168.2.1", "192.168.0.146", "192.168.1.102"],
  // Keep pdfkit external so its bundled .afm font-metric files resolve from
  // node_modules at runtime instead of being (incorrectly) bundled.
  serverExternalPackages: ["pdfkit"],
  images: {
    // Narrowly allow only Supabase Storage public objects (CMS blog/video media).
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
  },
};

export default nextConfig;
