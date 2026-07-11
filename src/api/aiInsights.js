// src/api/aiInsights.js
// Trigger AI Financial Insight (Fase 8) — dipicu manual, bukan otomatis.

import { apiFetch } from "./apiClient.js";

export async function requestInsight() {
  return apiFetch('/ai/insights', { method: 'POST' });
}
