import { API_BASE } from "../api/apiClient.js";

export function mediaUrl(path) {
  if (!path) return "";
  if (/^(https?:)?\/\//i.test(path) || path.startsWith("data:") || path.startsWith("blob:")) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const normalizedApiBase = API_BASE.startsWith("/") ? API_BASE : API_BASE.replace(/\/api\/?$/, "");

  if (normalizedPath.startsWith("/uploads/")) {
    return `${normalizedApiBase}/uploads${normalizedPath.slice("/uploads".length)}`;
  }

  return normalizedPath;
}
