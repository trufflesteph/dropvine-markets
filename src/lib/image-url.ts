export const defaultShareImage = {
  url: "/brand/og-default.png",
  width: 1200,
  height: 630,
  alt: "Dropvine Markets: One-of-a-kind finds. Close to home.",
};

const imageExtension = /\.(avif|gif|jpe?g|png|webp)$/i;

// True only for http(s) or root-relative URLs whose path ends in an image file extension.
// Page links such as "https://example.gov/parksrec/community-center" are rejected.
export function isImageUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value, "https://placeholder.invalid");
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (!value.startsWith("/") && !/^https?:\/\//i.test(value)) return false;
    return imageExtension.test(url.pathname);
  } catch {
    return false;
  }
}

// First uploaded photo, then hero_image_url when it is clearly an image, otherwise nothing.
export function marketImageUrl(firstPhotoUrl: string | null | undefined, heroImageUrl: string | null | undefined) {
  if (firstPhotoUrl) return firstPhotoUrl;
  return isImageUrl(heroImageUrl) ? heroImageUrl : null;
}
