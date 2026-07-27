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

import { AsgardeoProvider } from "@asgardeo/react";
import { OxygenUIThemeProvider } from "@wso2/oxygen-ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { BrowserRouter } from "react-router";
import { authConfig } from "@config/authConfig";
import { themeConfig } from "@config/themeConfig";
import { ThemeModeProvider } from "@context/theme-mode/ThemeModeContext";
import { PerspectiveProvider } from "@context/perspective/PerspectiveContext";
import { NotificationsProvider } from "@context/notifications/NotificationsContext";
import { HttpError } from "@api/http";
import App from "./App";

// One shared QueryClient — retry only on transient upstream errors. All
// HTTP failures the app throws are HttpError (see @features/my/api), so we
// key the check off the class + .status rather than a fragile regex on the
// message. Non-HttpError throws (e.g. network offline) also retry.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: (failureCount, error) => {
        if (failureCount >= 2) return false;
        if (error instanceof HttpError) return error.status === 502 || error.status === 503;
        return true;
      },
    },
  },
});

export default function AppWithConfig() {
  return (
    <AsgardeoProvider
      baseUrl={authConfig.baseUrl}
      clientId={authConfig.clientId}
      afterSignInUrl={authConfig.afterSignInUrl}
      afterSignOutUrl={authConfig.afterSignOutUrl}
      scopes={[...authConfig.scopes]}
      preferences={{
        theme: { inheritFromBranding: false },
        user: { fetchUserProfile: false, fetchOrganizations: false },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <OxygenUIThemeProvider theme={themeConfig}>
          <ThemeModeProvider>
            <BrowserRouter>
              <PerspectiveProvider>
                <NotificationsProvider>
                  <App />
                </NotificationsProvider>
              </PerspectiveProvider>
            </BrowserRouter>
          </ThemeModeProvider>
        </OxygenUIThemeProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </AsgardeoProvider>
  );
}
