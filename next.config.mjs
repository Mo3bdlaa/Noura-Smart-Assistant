/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // `after()` is stable in Next 15 but we keep serverActions sizes generous for chat payloads.
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  // argon2 is a native module; keep it external to the server bundle.
  serverExternalPackages: ["argon2", "postgres"],
};

export default nextConfig;
