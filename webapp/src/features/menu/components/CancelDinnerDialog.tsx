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
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@wso2/oxygen-ui";
import { useNotifications } from "@context/notifications/NotificationsContext";
import { useCancelDinnerOrder } from "../api/useMenuMutations";
import { describeError } from "../util/menuError";

// Confirm cancelling a dinner order.
//
// Owns its own mutation so the pending state can gate its own buttons. In the
// standalone app the confirm button only changed colour while the request was in
// flight and stayed clickable, so an impatient double-click sent two cancels.
export default function CancelDinnerDialog({
  open,
  onClose,
  mealLabel,
}: {
  open: boolean;
  onClose: () => void;
  mealLabel: string;
}) {
  const cancel = useCancelDinnerOrder();
  const { showSuccess, showError } = useNotifications();

  const close = () => {
    cancel.reset();
    onClose();
  };

  const confirm = () => {
    cancel.mutate(undefined, {
      onSuccess: () => {
        showSuccess("Dinner order cancelled");
        close();
      },
      onError: (err) => showError(describeError(err)),
    });
  };

  return (
    <Dialog open={open} onClose={cancel.isPending ? undefined : close} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: 17, fontWeight: 700 }}>Cancel your dinner?</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary">
          Your {mealLabel.toLowerCase()} dinner order will be cancelled. You can order again while
          ordering is open.
        </Typography>
        {cancel.isError && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {describeError(cancel.error)}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={close} disabled={cancel.isPending}>
          Keep my order
        </Button>
        <Button
          size="small"
          variant="contained"
          color="error"
          onClick={confirm}
          disabled={cancel.isPending}
          sx={{ fontWeight: 600 }}
        >
          {cancel.isPending ? "Cancelling…" : "Cancel order"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
