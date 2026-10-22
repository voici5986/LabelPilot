// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getTourSteps,
  intersectTourRects,
  markGuidedTourSeen,
  placeTourCard,
  shouldShowGuidedTour,
  TOUR_SEEN_KEY,
  LEGACY_QUICK_SETUP_SEEN_KEY,
} from "./guidedTour";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("tour admission", () => {
  it("admits a fresh browser and keeps responsive step order", () => {
    expect(shouldShowGuidedTour("settings")).toBe(true);
    expect(getTourSteps(false)).toEqual([
      "content",
      "layout",
      "preview",
      "zoom",
      "generate",
    ]);
    expect(getTourSteps(true)).toEqual([
      "edit",
      "content",
      "layout",
      "preview",
      "generate",
    ]);
  });
  it.each([TOUR_SEEN_KEY, "settings", LEGACY_QUICK_SETUP_SEEN_KEY])(
    "respects existing %s even when empty",
    (key) => {
      localStorage.setItem(key, "");
      expect(shouldShowGuidedTour("settings")).toBe(false);
    },
  );
  it("records completion and tolerates unavailable storage", () => {
    markGuidedTourSeen();
    expect(localStorage.getItem(TOUR_SEEN_KEY)).toBe("1");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(shouldShowGuidedTour("settings")).toBe(false);
    expect(() => markGuidedTourSeen()).not.toThrow();
  });
});

describe("viewport placement", () => {
  const desktop = { x: 0, y: 0, width: 1200, height: 800 };
  it.each([
    [{ x: 450, y: 0, width: 100, height: 80 }, "bottom"],
    [{ x: 450, y: 720, width: 100, height: 80 }, "top"],
    [{ x: 0, y: 0, width: 320, height: 800 }, "right"],
    [{ x: 880, y: 0, width: 320, height: 800 }, "left"],
  ] as const)("uses available space around %o", (target, side) => {
    const result = placeTourCard(target, { width: 320, height: 220 }, desktop);
    expect(result.side).toBe(side);
    expect(result.arrow).not.toBeNull();
  });
  it("clamps a tall card and a clipped target on a short 360px screen", () => {
    const result = placeTourCard(
      { x: -20, y: 380, width: 400, height: 80 },
      { width: 320, height: 600 },
      { x: 0, y: 0, width: 360, height: 420 },
    );
    expect(result.card).toEqual({ x: 20, y: 12, width: 320, height: 396 });
    expect(result.target).toEqual({ x: 0, y: 380, width: 360, height: 40 });
  });
  it("centers a usable fallback with visual viewport offsets", () => {
    const result = placeTourCard(
      null,
      { width: 320, height: 200 },
      { x: 10, y: 100, width: 360, height: 420 },
    );
    expect(result.card).toEqual({ x: 30, y: 210, width: 320, height: 200 });
    expect(result.arrow).toBeNull();
    expect(result.side).toBe("fallback");
  });
  it("uses only the highlight when a large preview fills the screen", () => {
    const result = placeTourCard(
      { x: 8, y: 8, width: 344, height: 640 },
      { width: 320, height: 240 },
      { x: 0, y: 0, width: 360, height: 660 },
    );
    expect(result.target).toEqual({ x: 8, y: 8, width: 344, height: 640 });
    expect(result.arrow).toBeNull();
  });
});

it("keeps desktop cards out of a live control panel when preview space is available", () => {
  const obstacle = { x: 0, y: 60, width: 320, height: 720 };
  const result = placeTourCard(
    { x: 16, y: 130, width: 288, height: 100 },
    { width: 280, height: 240 },
    { x: 0, y: 0, width: 1200, height: 800 },
    {
      obstacles: [obstacle],
      preferredBounds: { x: 332, y: 72, width: 856, height: 704 },
    },
  );
  expect(intersectTourRects(result.card, obstacle)).toBeNull();
});
it("suppresses the clamped arrow when the preview occupies over half the viewport", () => {
  const result = placeTourCard(
    { x: 100, y: 72, width: 1088, height: 475 },
    { width: 280, height: 240 },
    { x: 0, y: 0, width: 1200, height: 800 },
  );
  expect(result.target).not.toBeNull();
  expect(result.arrow).toBeNull();
});
it("retains a visible ordinary arrow and a large target arrow when the card is outside", () => {
  for (const target of [
    { x: 100, y: 72, width: 1088, height: 375 },
    { x: 400, y: 72, width: 800, height: 700 },
  ]) {
    const result = placeTourCard(
      target,
      { width: 280, height: 240 },
      { x: 0, y: 0, width: 1200, height: 800 },
    );
    expect(intersectTourRects(result.card, result.target!)).toBeNull();
    expect(
      Math.hypot(
        result.arrow!.to.x - result.arrow!.from.x,
        result.arrow!.to.y - result.arrow!.from.y,
      ),
    ).toBeGreaterThanOrEqual(24);
  }
});

it("preserves an existing non-null seen marker", () => {
  localStorage.setItem(TOUR_SEEN_KEY, "previous-version");
  markGuidedTourSeen();
  expect(localStorage.getItem(TOUR_SEEN_KEY)).toBe("previous-version");
});

it("connects a sheet card to the clipped control through its reserved 16px gap", () => {
  const card = { x: 12, y: 500, width: 336, height: 228 };
  const result = placeTourCard(
    { x: 16, y: 380, width: 328, height: 104 },
    { width: card.width, height: card.height },
    { x: 0, y: 0, width: 360, height: 740 },
    { cardBounds: card },
  );
  expect(result.card).toEqual(card);
  expect(intersectTourRects(result.card, result.target!)).toBeNull();
  expect(result.arrow).toEqual({
    from: { x: 180, y: 500 },
    to: { x: 180, y: 478 },
  });
  expect(result.card.y + result.card.height).toBeLessThanOrEqual(740);
});

it("keeps the actual inline sheet card bounds when its target is temporarily missing", () => {
  const card = { x: 12, y: 494, width: 336, height: 234 };
  const result = placeTourCard(
    null,
    { width: 280, height: 234 },
    { x: 0, y: 0, width: 360, height: 740 },
    { cardBounds: card },
  );
  expect(result.card).toEqual(card);
  expect(result.target).toBeNull();
  expect(result.arrow).toBeNull();
  expect(result.side).toBe("fallback");
});

it.each([
  {
    viewport: { x: 0, y: 0, width: 1280, height: 720 },
    target: { x: 344, y: 52, width: 924, height: 656 },
    card: { x: 356, y: 64, width: 280, height: 240 },
  },
  {
    viewport: { x: 0, y: 0, width: 390, height: 844 },
    target: { x: 8, y: 64, width: 374, height: 700 },
    card: { x: 55, y: 124, width: 280, height: 240 },
  },
])(
  "highlights a large overlapping preview without an arrow crossing the paper ($viewport.width)",
  ({ viewport, target, card }) => {
    const result = placeTourCard(target, card, viewport, { cardBounds: card });
    expect(result.target).toEqual(target);
    expect(result.arrow).toBeNull();
  },
);
it("places the ordinary arrow tip strictly inside the clipped target", () => {
  const result = placeTourCard(
    { x: -20, y: 100, width: 80, height: 60 },
    { width: 200, height: 100 },
    { x: 0, y: 0, width: 360, height: 740 },
    { cardBounds: { x: 100, y: 90, width: 200, height: 100 } },
  );
  expect(result.target).toEqual({ x: 0, y: 100, width: 60, height: 60 });
  expect(result.arrow!.to.x).toBeGreaterThan(0);
  expect(result.arrow!.to.x).toBeLessThan(60);
  expect(result.arrow!.to.y).toBeGreaterThan(100);
  expect(result.arrow!.to.y).toBeLessThan(160);
});
it("uses the nearest meaningful exposed edge for a smaller overlapping target", () => {
  const result = placeTourCard(
    { x: 100, y: 100, width: 200, height: 180 },
    { width: 80, height: 70 },
    { x: 0, y: 0, width: 1200, height: 800 },
    { cardBounds: { x: 110, y: 110, width: 80, height: 70 } },
  );
  expect(result.arrow).toEqual({
    from: { x: 150, y: 180 },
    to: { x: 150, y: 274 },
  });
});

it.each([
  {
    target: { x: 250, y: 180, width: 690, height: 214 },
    size: { width: 280, height: 172 },
    viewport: { x: 0, y: 0, width: 1200, height: 480 },
    options: {},
  },
  {
    target: { x: 279, y: 80, width: 60, height: 21 },
    size: { width: 280, height: 240 },
    viewport: { x: 0, y: 0, width: 1200, height: 800 },
    options: { cardBounds: { x: 0, y: 100, width: 280, height: 240 } },
  },
])(
  "anchors a small-overlap arrow on the card and immediately points outward ($target.x)",
  ({ target, size, viewport, options }) => {
    const result = placeTourCard(target, size, viewport, options);
    const { card, arrow } = result;
    expect(arrow).not.toBeNull();
    const { from, to } = arrow!;
    const onVertical =
      (from.x === card.x || from.x === card.x + card.width) &&
      from.y >= card.y &&
      from.y <= card.y + card.height;
    const onHorizontal =
      (from.y === card.y || from.y === card.y + card.height) &&
      from.x >= card.x &&
      from.x <= card.x + card.width;
    expect(onVertical || onHorizontal).toBe(true);
    expect(to.x).toBeGreaterThan(result.target!.x);
    expect(to.x).toBeLessThan(result.target!.x + result.target!.width);
    expect(to.y).toBeGreaterThan(result.target!.y);
    expect(to.y).toBeLessThan(result.target!.y + result.target!.height);
    const nearStart = {
      x: from.x + (to.x - from.x) * 0.001,
      y: from.y + (to.y - from.y) * 0.001,
    };
    expect(
      nearStart.x < card.x ||
        nearStart.x > card.x + card.width ||
        nearStart.y < card.y ||
        nearStart.y > card.y + card.height,
    ).toBe(true);
  },
);
