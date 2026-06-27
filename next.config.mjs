/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Server Actions are stable in Next 15; keep body size generous for bulk requests.
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  // Remote imagery is limited to a known allow-list (e.g. Unsplash for demo art).
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        // Uploaded images (news covers, etc.) served from Vercel Blob.
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
      },
    ],
  },
};

export default nextConfig;
