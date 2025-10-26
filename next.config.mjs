/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    // Increase body size limit to 50MB for API routes
    bodySizeLimit: "50mb",
  },
};

export default nextConfig;
