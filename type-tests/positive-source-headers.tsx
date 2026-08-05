import type { ReactElement } from "react";
import { ImageCrop } from "../src/ImageCrop";
import { ImageWithCrop } from "../src/ImageWithCrop";

/**
 * Case 4 (positive): `imageProps.source` overrides the library's default `source={{ uri }}`
 * to carry an `Authorization` header for the renderer's own fetch, on the default (RN `Image`)
 * renderer. Per §3.7 of the dev-lead brief, the `uri` prop must name the same image — it does
 * here.
 */
const AUTHENTICATED_URI = "https://example.com/private-photo.jpg";

export const SourceHeadersImageCrop = (): ReactElement => (
  <ImageCrop
    uri={AUTHENTICATED_URI}
    imageProps={{ source: { uri: AUTHENTICATED_URI, headers: { Authorization: "Bearer token" } } }}
  />
);

export const SourceHeadersImageWithCrop = (): ReactElement => (
  <ImageWithCrop
    uri={AUTHENTICATED_URI}
    cropData={{ scale: 1, translateX: 0, translateY: 0 }}
    headers={{ Authorization: "Bearer token" }}
    imageProps={{ source: { uri: AUTHENTICATED_URI, headers: { Authorization: "Bearer token" } } }}
  />
);
