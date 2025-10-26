/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  // Increase request size limit for file uploads
  api: {
    bodyParser: {
      sizeLimit: '100mb', // Allow up to 100MB file uploads
    },
  },
};

export default nextConfig;
