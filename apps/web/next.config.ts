import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  reactCompiler: true,
  output: "standalone",
  experimental: {
    authInterrupts: true,
  },
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
