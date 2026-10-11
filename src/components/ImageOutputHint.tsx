import { useI18n } from "../utils/i18nContext";
import {
  IMAGE_PROCESSING_LIMITS,
  getValidatedJpegOrientation,
  normalizeImageMimeType,
} from "../utils/imageLimits";
import type { ImageItem } from "../utils/layoutMath";
import { InlineAlert } from "./ui/InlineAlert";

export function ImageOutputHint({ imageItems }: { imageItems: ImageItem[] }) {
  const { t } = useI18n();
  if (
    !imageItems.some(({ file }) => {
      const orientation = getValidatedJpegOrientation(file);
      if (orientation !== undefined)
        return orientation !== null && orientation > 1;
      // Unvalidated/incomplete headers cannot establish the direct-embed path.
      const type = normalizeImageMimeType(file.type);
      return type === "image/jpeg" || type === "";
    })
  ) {
    return null;
  }
  return (
    <InlineAlert tone="warning" className="mt-3 text-sm">
      {t("image_normalization_hint", {
        max: IMAGE_PROCESSING_LIMITS.maxNormalizedJpegPixels / 1_000_000,
      })}
    </InlineAlert>
  );
}
