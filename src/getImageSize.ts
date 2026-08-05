import { Image } from "react-native";
import type { Size } from "./types";

/**
 * Measures the natural pixel size of an image identified by `uri`.
 *
 * Wraps React Native's `Image.getSize` / `Image.getSizeWithHeaders`: `getSizeWithHeaders`
 * is used when `options.headers` is provided (needed for images that require
 * authentication), otherwise plain `getSize` is used.
 *
 * Always rejects with an `Error` instance on failure, regardless of what shape the
 * underlying native call reports the failure in — callers never have to guess or
 * defensively check the rejection reason's type.
 *
 * @param uri - The image URI to measure. Only URI strings are supported; `require()` asset
 * numbers are not accepted (the same limitation `Image.getSize` itself has).
 * @param options.headers - HTTP headers to send with the size request, for images served
 * behind authentication.
 * @returns A promise resolving to the image's natural `{ width, height }`, in pixels.
 */
export const getImageSize = (uri: string, options?: { headers?: Record<string, string> }): Promise<Size> => {
  return new Promise((resolve, reject) => {
    const onSuccess = (width: number, height: number) => resolve({ width, height });
    const onFailure = (error: unknown) => {
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    if (options?.headers) {
      Image.getSizeWithHeaders(uri, options.headers, onSuccess, onFailure);
    } else {
      Image.getSize(uri, onSuccess, onFailure);
    }
  });
};
