import type { NextConfig } from "next";

const supabaseImageHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname || 'uzjlssmjvdkjsqthekgh.supabase.co';
  } catch {
    return 'uzjlssmjvdkjsqthekgh.supabase.co';
  }
})();

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: supabaseImageHost,
      },
    ],
  }
};

export default nextConfig;
