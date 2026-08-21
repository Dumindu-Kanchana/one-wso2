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

// Oxygen's typography asks for "Inter Variable" but the library does not
// actually load it (its README claims it does) — so both this app and csm-portal
// have been rendering in the platform system font. Import the face here; the
// package is already in the tree as an @wso2/oxygen-ui dependency, and the
// build-time CSP already allows font-src 'self'. Imported by explicit .css
// path so it type-checks as a stylesheet side-effect import (the package ships
// no type declarations, and noUncheckedSideEffectImports is on).
import "@fontsource-variable/inter/index.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AppWithConfig from "./AppWithConfig";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppWithConfig />
  </StrictMode>,
);
