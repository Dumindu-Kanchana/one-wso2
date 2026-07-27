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

import { IconButton, Tooltip } from "@wso2/oxygen-ui";

// Compact pencil/close icon-button shared by PersonalInfo and
// EmergencyContacts. Rendered inside an absolute-positioned wrapper by
// the parent so it lines up with the first row of card content without
// taking a whole header row of vertical space.
export default function EditToggle({
  editing,
  canEdit,
  pending,
  onEnter,
  onCancel,
}: {
  editing: boolean;
  canEdit: boolean;
  pending: boolean;
  onEnter: () => void;
  onCancel: () => void;
}) {
  return (
    <Tooltip title={editing ? "Cancel edit" : "Edit"} placement="left">
      <span>
        <IconButton
          size="small"
          aria-label={editing ? "Cancel edit" : "Edit"}
          onClick={editing ? onCancel : onEnter}
          disabled={editing ? pending : !canEdit}
          sx={{
            width: 30,
            height: 30,
            borderRadius: 0.75,
            color: editing ? "text.secondary" : "primary.main",
            "&:hover": {
              backgroundColor: editing ? "action.hover" : "primary.light",
            },
          }}
        >
          {editing ? <CloseIcon /> : <PencilIcon />}
        </IconButton>
      </span>
    </Tooltip>
  );
}

function PencilIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
      <line x1={6} y1={6} x2={18} y2={18} />
      <line x1={18} y1={6} x2={6} y2={18} />
    </svg>
  );
}
