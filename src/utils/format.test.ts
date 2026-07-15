import { describe, expect, it } from "vitest";
import { formatDateForFilename } from "./format";

describe("formatDateForFilename", () => {
  it("includes seconds and milliseconds to avoid same-minute collisions", () => {
    const first = formatDateForFilename(new Date(2026, 6, 14, 9, 8, 7, 6));
    const second = formatDateForFilename(new Date(2026, 6, 14, 9, 8, 7, 7));

    expect(first).toBe("260714_090807_006");
    expect(second).toBe("260714_090807_007");
  });
});
