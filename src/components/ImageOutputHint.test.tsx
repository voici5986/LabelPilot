// @vitest-environment jsdom

import { File as BrowserFile } from "node:buffer";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createJpegWithMetadata } from "../test/jpegFixtures";
import { createCollisionPng } from "../test/pngFixtures";
import { I18nProvider } from "../utils/i18n";
import { validateImageFileContents } from "../utils/imageLimits";
import { ImageOutputHint } from "./ImageOutputHint";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function show(file: File) {
  return render(
    <I18nProvider>
      <ImageOutputHint imageItems={[{ id: "photo", file, count: 1 }]} />
    </I18nProvider>,
  );
}

describe("ImageOutputHint", () => {
  it.each([undefined, 1, 2, 3, 4, 5, 6, 7, 8])(
    "uses validated EXIF orientation %s",
    async (orientation) => {
      vi.stubGlobal("File", BrowserFile);
      vi.stubGlobal(
        "createImageBitmap",
        vi.fn(async () => ({ width: 80, height: 40, close: vi.fn() })),
      );
      const file = new File(
        [createJpegWithMetadata({ orientation })],
        "photo.bin",
        { type: "" },
      );
      await validateImageFileContents([file]);
      const read = vi.spyOn(file, "slice");
      const view = show(file);
      expect(screen.queryByRole("status") !== null).toBe(
        orientation !== undefined && orientation > 1,
      );
      view.rerender(
        <I18nProvider>
          <ImageOutputHint imageItems={[{ id: "photo", file, count: 4 }]} />
        </I18nProvider>,
      );
      expect(read).not.toHaveBeenCalled();
      expect(createImageBitmap).not.toHaveBeenCalled();
    },
  );

  it("does not warn for a signature-validated MIME-less PNG", async () => {
    vi.stubGlobal("File", BrowserFile);
    const file = new File([createCollisionPng("red")], "photo.bin", {
      type: "",
    });
    await validateImageFileContents([file]);
    show(file);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("keeps a cautious warning for an unvalidated JPEG", () => {
    show(new File(["unknown"], "photo.jpg", { type: "image/jpeg" }));
    expect(screen.queryByRole("status")).not.toBeNull();
  });
});
