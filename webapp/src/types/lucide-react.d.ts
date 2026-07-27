// Shim for `lucide-react` @0.545.0 — the version transitively pinned by
// @wso2/oxygen-ui-icons-react. Its package.json declares
// `"typings": "dist/lucide-react.d.ts"` but does not actually ship that
// file. TypeScript's `moduleResolution: "bundler"` then walks into
// oxygen-ui-icons-react's raw `.ts` sources (Facebook.ts, GitHub.ts, etc.)
// which import from `lucide-react`, and the whole build fails with
// TS7016 "Could not find a declaration file for module 'lucide-react'".
//
// Declaring the module here as `any` restores the build. Our own source
// never imports lucide-react directly, so the loss of type precision
// only affects the transitive icon package (which was already an
// escape-hatch dependency, not a first-class API).
declare module "lucide-react";
