// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nContext } from "../utils/i18nContext";
import { LayoutFields } from "./LayoutFields";
import { TextModeFields } from "./TextModeFields";

afterEach(cleanup);

describe("numeric field control choices", () => {
  it("opts only rows, columns and digits into steppers and inherits fieldset disabling", () => {
    render(
      <I18nContext.Provider
        value={{ language: "en", setLanguage: vi.fn(), t: (key) => key }}
      >
        <fieldset disabled>
          <LayoutFields
            config={{
              rows: 3,
              cols: 3,
              marginMm: 10,
              spacingMm: 10,
              orientation: "portrait",
              pageWidthMm: 210,
              pageHeightMm: 297,
            }}
            onConfigChange={vi.fn()}
          />
          <TextModeFields
            textConfig={{
              prefix: "SN-",
              startNumber: 123456,
              digits: 6,
              count: 10,
              showQrCode: false,
              qrSizeRatio: 0.35,
              qrContentPrefix: "",
            }}
            metrics={{ fontSizePt: 12, qrModuleSizeMm: null, error: null }}
            error={null}
            onChange={vi.fn()}
          />
        </fieldset>
      </I18nContext.Provider>,
    );

    for (const label of ["rows", "cols", "text_digits"]) {
      const input = screen.getByLabelText(label);
      for (const sign of ["-", "+"]) {
        const button = screen.getByRole("button", {
          name: `${label}: ${sign}1`,
        });
        expect(button.getAttribute("aria-controls")).toBe(input.id);
        expect(button.matches(":disabled")).toBe(true);
      }
      expect(input.matches(":disabled")).toBe(true);
    }
    for (const label of [
      "margin unit_mm",
      "spacing unit_mm",
      "text_start_number",
      "text_count",
    ]) {
      expect(screen.getByLabelText(label).classList.contains("text-left")).toBe(
        true,
      );
      expect(screen.queryByRole("button", { name: `${label}: +1` })).toBeNull();
      expect(screen.queryByRole("button", { name: `${label}: -1` })).toBeNull();
    }
    expect(
      screen
        .getAllByRole("button")
        .filter((button) => button.hasAttribute("aria-controls")),
    ).toHaveLength(6);
  });
});
