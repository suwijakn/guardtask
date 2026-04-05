import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: process.env.NGROK_URL
    ? [new URL(process.env.NGROK_URL).hostname]
    : [],
};

export default nextConfig;
