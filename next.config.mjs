/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // `after()` is stable in Next 15 but we keep serverActions sizes generous for chat payloads.
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  // Keep native/napi deps external to the server bundle so their binaries load.
  serverExternalPackages: ["@node-rs/argon2", "postgres"],
};

export default nextConfig;
