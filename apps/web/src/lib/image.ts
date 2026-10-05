export function getProxiedImageUrl(src?: string): string {
  if (!src) return "";
  if (src.startsWith("data:") || src.startsWith("blob:") || src.startsWith("/")) return src;
  return `/v1/image-proxy?url=${encodeURIComponent(src)}`;
}
