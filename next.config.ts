import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseUrl ? [{
      protocol: supabaseUrl.protocol.replace(":", "") as "http" | "https",
      hostname: supabaseUrl.hostname,
      pathname: "/**",
    }] : [],
  },
  experimental: {
    // Admin image uploads go through server actions, which accept 1 MB by default. Spotlight images are capped
    // at 4 MB (under Vercel's 4.5 MB request limit); the extra room covers the multipart overhead.
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
