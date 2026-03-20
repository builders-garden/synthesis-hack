import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // @lifi/widget pulls @mysten/dapp-kit which has broken peer deps
    // on @mysten/sui — ignore these unused Sui modules at build time
    config.resolve.alias = {
      ...config.resolve.alias,
      "@mysten/dapp-kit": false,
      "@mysten/sui": false,
    };
    return config;
  },
};

export default nextConfig;
