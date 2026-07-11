import { useState, useCallback } from "react";
import { requestInsight } from "../api/aiInsights.js";

export function useAiInsight() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [narrative, setNarrative] = useState("");
  const [rateLimited, setRateLimited] = useState(false);
  const [remaining, setRemaining] = useState(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await requestInsight();
      setNarrative(data.narrative || "");
      setRateLimited(!!data.rateLimited);
      setRemaining(data.remaining ?? null);
      if (data.rateLimited && data.message) {
        setError(data.message);
      }
    } catch (err) {
      setError(err.message || "Gagal membuat analisa keuangan");
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, narrative, rateLimited, remaining, generate };
}
