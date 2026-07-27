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

import { Navigate, Route, Routes } from "react-router";
import AuthGuard from "@layouts/AuthGuard";
import AppLayout from "@layouts/AppLayout";
import PeopleOpsPage from "@features/people-ops/pages/PeopleOpsPage";
import MyProfilePage from "@features/my/pages/MyProfilePage";

export default function App() {
  return (
    <Routes>
      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>
          {/* Default landing = People Ops (the home perspective). */}
          <Route index element={<Navigate to="/people-ops" replace />} />
          <Route path="people-ops" element={<PeopleOpsPage />} />
          <Route path="my" element={<MyProfilePage />} />
          {/* Catch-all → home */}
          <Route path="*" element={<Navigate to="/people-ops" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
