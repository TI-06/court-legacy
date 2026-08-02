export function supportsRasterMasks(): boolean {
  if (typeof CSS === "undefined" || typeof CSS.supports !== "function") {
    return false;
  }

  const source = 'url("data:image/webp;base64,UklGRg==")';
  return (
    CSS.supports("mask-image", source) ||
    CSS.supports("-webkit-mask-image", source)
  );
}
