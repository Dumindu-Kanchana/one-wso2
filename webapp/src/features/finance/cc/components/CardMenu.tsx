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

import { useState } from "react";
import {
  Badge,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@wso2/oxygen-ui";
import { PencilIcon } from "@wso2/oxygen-ui-icons-react";
import type { CcCreditCard } from "../ccTypes";

// Horizontal credit-card picker. Each card shows its (masked) number, label
// and an optional pending/new count badge.
export function CardMenu({
  cards,
  active,
  onSelect,
  badge,
  onRename,
}: {
  cards: CcCreditCard[];
  active: string | null;
  onSelect: (ccNumber: string) => void;
  badge?: "countNew" | "countPendingLead" | "countPendingFinance";
  /**
   * Lets a card be renamed in place — CardMenu.tsx:67-75 in the source, where
   * the label is the only thing distinguishing two cards with similar numbers.
   */
  onRename?: (card: CcCreditCard, label: string) => void;
}) {
  const [renaming, setRenaming] = useState<CcCreditCard | null>(null);
  const [draftLabel, setDraftLabel] = useState("");

  return (
    <>
    <Stack direction="row" spacing={1.25} sx={{ overflowX: "auto", pb: 0.5 }}>
      {cards.map((c) => {
        const selected = c.ccNumber === active;
        const count = badge ? c[badge] : 0;
        return (
          <Box
            key={c.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(c.ccNumber)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect(c.ccNumber)}
            sx={{
              cursor: "pointer",
              minWidth: 160,
              border: 1,
              borderColor: selected ? "primary.main" : "divider",
              bgcolor: selected ? "primary.light" : "background.paper",
              borderRadius: 1.5,
              px: 1.5,
              py: 1.25,
              flexShrink: 0,
              transition: "border-color .12s, background-color .12s",
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography sx={{ fontSize: 12.5, fontWeight: 700, fontFamily: "monospace", flex: 1 }} noWrap>
                •••• {c.ccNumber.slice(-4)}
              </Typography>
                {onRename && (
                  <IconButton
                    size="small"
                    aria-label={`Rename card ending ${c.ccNumber.slice(-4)}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenaming(c);
                      setDraftLabel(c.label ?? "");
                    }}
                    sx={{ p: 0.25, color: "text.secondary" }}
                  >
                    <PencilIcon size={13} />
                  </IconButton>
                )}
              {badge && count > 0 && (
                <Badge badgeContent={count} color="primary" sx={{ "& .MuiBadge-badge": { fontSize: 10, height: 16, minWidth: 16 } }} />
              )}
            </Stack>
            <Typography sx={{ fontSize: 11, color: "text.secondary" }} noWrap>
              {c.label || c.bankCode.toUpperCase()}
              {c.status !== "Active" ? " · Inactive" : ""}
            </Typography>
          </Box>
        );
      })}
    </Stack>

    <Dialog open={renaming !== null} onClose={() => setRenaming(null)} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Rename card</DialogTitle>
      <DialogContent dividers>
        <TextField
          size="small"
          fullWidth
          autoFocus
          value={draftLabel}
          onChange={(e) => setDraftLabel(e.target.value)}
          placeholder="e.g. Travel card"
          inputProps={{ "aria-label": "Card label" }}
        />
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={() => setRenaming(null)}>
          Cancel
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={() => {
            if (renaming) onRename?.(renaming, draftLabel.trim());
            setRenaming(null);
          }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
    </>
  );
}
