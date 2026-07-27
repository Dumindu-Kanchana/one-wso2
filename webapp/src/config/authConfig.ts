// Copyright (c) 2026 WSO2 LLC. (https://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

// Asgardeo OAuth config. Read at runtime from window.config (injected by
// public/config.js) so a single static bundle can serve any environment.
// Same pattern as customer-portal — every WSO2 internal webapp follows this.

declare global {
  interface Window {
    config: {
      ONE_WSO2_AUTH_BASE_URL: string;
      ONE_WSO2_AUTH_CLIENT_ID: string;
      ONE_WSO2_AUTH_SIGN_IN_REDIRECT_URL: string;
      ONE_WSO2_AUTH_SIGN_OUT_REDIRECT_URL: string;
      ONE_WSO2_THEME?: string;
      // Base URL for the people-ops-suite people-app backend (the same
      // SERVICE_BASE_URL people-app's own webapp reads). Used to fetch the
      // current user's Employee + EmployeePersonalInfo records on the
      // My profile page. Optional — when absent, the My page still loads
      // but the profile sections show a "not configured" state.
      ONE_WSO2_PEOPLE_BACKEND_URL?: string;
      // Base URL for the digiops-hr promotion-app backend. Optional — when
      // absent, ConnectedServices' "Last promoted date" row falls back to a
      // "not configured" state and doesn't fire a request.
      ONE_WSO2_PROMOTION_BACKEND_URL?: string;
      // Base URL for the digiops-hr par-app backend. Optional — when
      // absent, the Performance & growth review row falls back to a
      // "not configured" state.
      ONE_WSO2_PAR_BACKEND_URL?: string;
      // Base URL for the digiops-hr banking-app backend. Optional — when
      // absent, the Bank accounts card in Connected apps shows a
      // "not configured" state.
      ONE_WSO2_BANKING_BACKEND_URL?: string;
      // Override for the Asgardeo My Account portal URL that the top-bar
      // "Profile" menu item opens. Only set this on non-standard tenants
      // (self-hosted / custom domain); on Asgardeo Cloud we derive it from
      // ONE_WSO2_AUTH_BASE_URL by swapping the api. subdomain for
      // myaccount. (e.g. api.asgardeo.io/t/wso2 → myaccount.asgardeo.io/t/wso2).
      ONE_WSO2_ASGARDEO_MYACCOUNT_URL?: string;
      // Dev-only escape hatch — when true AND the bundle is a Vite dev
      // build, AuthGuard treats the user as signed in without ever calling
      // Asgardeo. Ignored in production builds (see devBypassAuth below),
      // so a stray true in a prod config.js can't disable auth.
      ONE_WSO2_DEV_BYPASS_AUTH?: boolean;
    };
  }
}

// Gate on import.meta.env.DEV so this constant folds to `false` in the
// production bundle no matter what config.js says. Vite/esbuild replaces
// import.meta.env.DEV with a literal `false` at build time and dead-code
// eliminates the whole branch, so ONE_WSO2_DEV_BYPASS_AUTH becomes inert
// in shipped code even if an operator accidentally sets it to true.
export const devBypassAuth =
  import.meta.env.DEV && window.config?.ONE_WSO2_DEV_BYPASS_AUTH === true;

function readConfig(key: keyof Window["config"], fallback = ""): string {
  const value = window.config?.[key];
  if (typeof value === "string" && value) return value;
  if (devBypassAuth) return fallback;
  throw new Error(
    `Missing runtime config: window.config.${key}. Populate public/config.js from public/config.js.example.`,
  );
}

const baseUrl = readConfig("ONE_WSO2_AUTH_BASE_URL", "https://dev.local/asgardeo");

// Derive Asgardeo's hosted My Account portal URL from the tenant base URL.
// Standard Asgardeo Cloud shape: api.asgardeo.io/t/<tenant> → myaccount.asgardeo.io/t/<tenant>.
// Operators can override via ONE_WSO2_ASGARDEO_MYACCOUNT_URL for non-standard deployments.
function deriveMyAccountUrl(base: string): string {
  const override = window.config?.ONE_WSO2_ASGARDEO_MYACCOUNT_URL;
  if (typeof override === "string" && override) return override;
  return base.replace(/(^https?:\/\/)api\./, "$1myaccount.");
}

export const authConfig = {
  baseUrl,
  clientId: readConfig("ONE_WSO2_AUTH_CLIENT_ID", "dev-mode-client"),
  afterSignInUrl: readConfig("ONE_WSO2_AUTH_SIGN_IN_REDIRECT_URL", "http://localhost:3000"),
  afterSignOutUrl: readConfig("ONE_WSO2_AUTH_SIGN_OUT_REDIRECT_URL", "http://localhost:3000"),
  // Asgardeo's hosted My Account portal — opened from the top-bar profile menu.
  myAccountUrl: deriveMyAccountUrl(baseUrl),
  // Same scope set as Novera and the leave/menu backends — groups is
  // required for role-based checks in downstream experience APIs.
  scopes: ["openid", "email", "groups", "profile"] as const,
};
