const MEDIA_EXTENSION_PATTERN = /\.(mp4|mov|m4v|webm|avi|mkv|mpeg|mpg|wmv)$/i;

export function stripMediaSuffix(value: string): string {
  let next = String(value || "").trim();

  while (MEDIA_EXTENSION_PATTERN.test(next)) {
    next = next.replace(MEDIA_EXTENSION_PATTERN, "").trim();
  }

  return next;
}

export function displayTypeName(value: string): string {
  return stripMediaSuffix(value) || value;
}
