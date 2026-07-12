import { apiFetch } from "./apiClient.js";

export async function getCurrentMetalPrices() {
  return apiFetch("/metal-prices/current");
}
