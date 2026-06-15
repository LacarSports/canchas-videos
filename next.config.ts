import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Requerido para SharedArrayBuffer (FFmpeg WASM)
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          // credentialless (no require-corp) para no bloquear recursos de R2
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        // El FAQ ahora vive como sección de la página de dueños.
        source: "/faq",
        destination: "/complejos#faq",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
