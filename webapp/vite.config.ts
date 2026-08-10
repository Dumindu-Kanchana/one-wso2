import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Content-Security-Policy for the shipped SPA (threat-model risk ONEWSO2-R2:
// no app-defined headers previously). Injected as a <meta> on PRODUCTION
// builds only — the dev server relies on inline scripts + ws HMR that a
// strict CSP would block. HTTP-only headers that a meta tag can't express
// (X-Frame-Options, HSTS, X-Content-Type-Options, Permissions-Policy) must
// still be set at the Choreo/Cloudflare edge.
//
// connect-src covers the Asgardeo IdP and the Choreo backend gateway hosts
// (apis[-stg].wso2.com); style-src allows 'unsafe-inline' for MUI/emotion's
// injected styles; img-src/frame-src allow blob:/data: for receipt previews.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.wso2.com https://*.asgardeo.io https://api.asgardeo.io",
  "frame-src 'self' blob: https://*.asgardeo.io",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

function cspPlugin(): Plugin {
  return {
    name: "one-wso2-csp",
    apply: "build",
    transformIndexHtml() {
      return [
        {
          tag: "meta",
          injectTo: "head",
          attrs: { "http-equiv": "Content-Security-Policy", content: CSP },
        },
      ];
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
    cspPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@api": path.resolve(__dirname, "./src/api"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@config": path.resolve(__dirname, "./src/config"),
      "@constants": path.resolve(__dirname, "./src/constants"),
      "@context": path.resolve(__dirname, "./src/context"),
      "@features": path.resolve(__dirname, "./src/features"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
      "@layouts": path.resolve(__dirname, "./src/layouts"),
    },
  },
  envPrefix: ["ONE_WSO2_"],
  server: {
    port: 3000,
  },
});
