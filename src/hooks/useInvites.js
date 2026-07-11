import { useState, useCallback, useEffect } from "react";
import { getMyPendingInvites } from "../api/invites.js";

export function useInvites(enabled) {
  const [invites, setInvites] = useState([]);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setInvites([]);
      return;
    }
    try {
      setInvites(await getMyPendingInvites());
    } catch {
      setInvites([]);
    }
  }, [enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { invites, refresh };
}
