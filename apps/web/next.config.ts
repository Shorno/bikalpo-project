import type { NextConfig } from "next";

const nextConfig: NextConfig = {

  /* config options here */

  reactCompiler: true,
  output: "standalone",
  typescript: {
    // TODO: Remove after deduplicating @types/react versions in pnpm monorepo
    ignoreBuildErrors: true,
  },
  experimental: {
    authInterrupts: true,
  },
  serverExternalPackages: ["pg"],
  images: {
    remotePatterns: [
      {
        hostname: "res.cloudinary.com",
      },
      {
        hostname: "images.unsplash.com",
      },
      {
        hostname: "upload.wikimedia.org",
      },
      {
        hostname: "api.qrserver.com",
      },
      {
        hostname: "placehold.co",
      },
      {
        hostname: "seeklogo.com",
      },
      {
        hostname: "meghnagroup.biz",
      },
      {
        hostname: "encrypted-tbn0.gstatic.com",
      },
      {
        hostname: "png.pngtree.com",
      },
    ],
  },
};

export default nextConfig;
