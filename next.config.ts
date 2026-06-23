import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Form asset uploads (logo/cover/background) allow up to 5MB images;
      // add headroom for multipart encoding overhead.
      bodySizeLimit: "6mb",
    },
  },
  async headers() {
    return [
      {
        // Allow the embeddable form route to be framed on any external site.
        source: "/forms/:formId/embed",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
