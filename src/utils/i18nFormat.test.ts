import { describe, expect, it } from "vitest";
import { interpolateTranslation } from "./i18nFormat";

describe("interpolateTranslation", () => {
  it("replaces every occurrence of the same variable", () => {
    expect(interpolateTranslation("{count} of {count}", { count: 3 })).toBe(
      "3 of 3",
    );
  });

  it("leaves missing variables intact", () => {
    expect(interpolateTranslation("{known} {missing}", { known: "ok" })).toBe(
      "ok {missing}",
    );
  });

  it("treats variable names and values as literal text", () => {
    expect(interpolateTranslation("{a.b} {a.b}", { "a.b": "$&" })).toBe(
      "$& $&",
    );
  });
});
