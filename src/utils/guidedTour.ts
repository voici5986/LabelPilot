export type TourStep =
  | "edit"
  | "content"
  | "layout"
  | "preview"
  | "zoom"
  | "generate";

export const LEGACY_QUICK_SETUP_SEEN_KEY = "label-pilot-quick-setup-v1";
export const TOUR_SEEN_KEY = "label-pilot-tour-v1";

export function getTourSteps(isMobile: boolean): TourStep[] {
  return isMobile
    ? ["edit", "content", "layout", "preview", "generate"]
    : ["content", "layout", "preview", "zoom", "generate"];
}

export function shouldShowGuidedTour(persistedSettingsKey: string): boolean {
  try {
    return (
      localStorage.getItem(TOUR_SEEN_KEY) === null &&
      localStorage.getItem(persistedSettingsKey) === null &&
      localStorage.getItem(LEGACY_QUICK_SETUP_SEEN_KEY) === null
    );
  } catch {
    return false;
  }
}

export function markGuidedTourSeen(): void {
  try {
    if (localStorage.getItem(TOUR_SEEN_KEY) === null)
      localStorage.setItem(TOUR_SEEN_KEY, "1");
  } catch {
    // The workbench and manual replay remain available without storage.
  }
}

export interface TourRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TourPlacement {
  card: TourRect;
  target: TourRect | null;
  arrow: {
    from: { x: number; y: number };
    to: { x: number; y: number };
  } | null;
  side: "top" | "bottom" | "left" | "right" | "fallback";
}

export function intersectTourRects(a: TourRect, b: TourRect): TourRect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const width = Math.min(a.x + a.width, b.x + b.width) - x;
  const height = Math.min(a.y + a.height, b.y + b.height) - y;
  return width > 0 && height > 0 ? { x, y, width, height } : null;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

/** All coordinates are viewport CSS pixels, including visual-viewport offsets. */
export function placeTourCard(
  target: TourRect | null,
  cardSize: { width: number; height: number },
  viewport: TourRect,
  options: {
    obstacles?: readonly TourRect[];
    preferredBounds?: TourRect;
    cardBounds?: TourRect;
  } = {},
): TourPlacement {
  const margin = 12;
  const gap = 24;
  const width = Math.min(
    cardSize.width,
    Math.max(0, viewport.width - margin * 2),
  );
  const height = Math.min(
    cardSize.height,
    Math.max(0, viewport.height - margin * 2),
  );
  const fit = (x: number, y: number): TourRect => ({
    x: clamp(
      x,
      viewport.x + margin,
      viewport.x + viewport.width - width - margin,
    ),
    y: clamp(
      y,
      viewport.y + margin,
      viewport.y + viewport.height - height - margin,
    ),
    width,
    height,
  });
  const visible = target && intersectTourRects(target, viewport);
  if (!visible) {
    return {
      card:
        options.cardBounds ??
        fit(
          viewport.x + (viewport.width - width) / 2,
          viewport.y + (viewport.height - height) / 2,
        ),
      target: null,
      arrow: null,
      side: "fallback",
    };
  }
  const cx = visible.x + visible.width / 2;
  const cy = visible.y + visible.height / 2;
  const preferred = options.preferredBounds;
  const freeCandidates = preferred
    ? [
        preferred.x + 12,
        preferred.x + (preferred.width - width) / 2,
        preferred.x + preferred.width - width - 12,
        ...(options.obstacles ?? []).flatMap((rect) => [
          rect.x + rect.width + 12,
          rect.x - width - 12,
        ]),
      ].flatMap((x) =>
        [
          preferred.y + 12,
          preferred.y + preferred.height - height - 12,
          ...(options.obstacles ?? []).flatMap((rect) => [
            rect.y + rect.height + 12,
            rect.y - height - 12,
          ]),
        ].map((y) => ({ side: "right" as const, x, y })),
      )
    : [];
  const candidates = [
    {
      side: "bottom" as const,
      x: cx - width / 2,
      y: visible.y + visible.height + gap,
    },
    { side: "top" as const, x: cx - width / 2, y: visible.y - height - gap },
    {
      side: "right" as const,
      x: visible.x + visible.width + gap,
      y: cy - height / 2,
    },
    { side: "left" as const, x: visible.x - width - gap, y: cy - height / 2 },
    ...freeCandidates,
  ].map((candidate) => {
    const card = options.cardBounds ?? fit(candidate.x, candidate.y);
    const overlap = intersectTourRects(card, visible);
    const separation = Math.max(
      card.x - visible.x - visible.width,
      visible.x - card.x - card.width,
      card.y - visible.y - visible.height,
      visible.y - card.y - card.height,
    );

    return {
      ...candidate,
      card,
      score:
        (!overlap && separation < gap ? width * height * 1000 : 0) +
        (options.obstacles ?? []).reduce((area, obstacle) => {
          const collision = intersectTourRects(card, obstacle);
          return area + (collision ? collision.width * collision.height : 0);
        }, 0) *
          10000 +
        (preferred
          ? (width * height -
              (intersectTourRects(card, preferred)?.width ?? 0) *
                (intersectTourRects(card, preferred)?.height ?? 0)) *
            1000
          : 0) +
        (overlap ? overlap.width * overlap.height : 0) * 100 +
        Math.abs(card.x - candidate.x) +
        Math.abs(card.y - candidate.y),
    };
  });
  candidates.sort((a, b) => a.score - b.score);
  const { card } = candidates[0];
  const side =
    card.x + card.width <= visible.x
      ? "left"
      : card.x >= visible.x + visible.width
        ? "right"
        : card.y + card.height <= visible.y
          ? "top"
          : "bottom";
  const insetX = Math.min(6, visible.width / 2);
  const insetY = Math.min(6, visible.height / 2);
  const inside = {
    left: visible.x + insetX,
    right: visible.x + visible.width - insetX,
    top: visible.y + insetY,
    bottom: visible.y + visible.height - insetY,
  };
  if (intersectTourRects(card, visible)) {
    // A preview that dominates the viewport is already identified by its
    // highlight. An arrow across its exposed paper adds no useful direction.
    if (
      visible.width * visible.height >
      (viewport.width * viewport.height) / 2
    ) {
      return { card, target: visible, side, arrow: null };
    }
    const x = clamp(
      clamp(card.x + card.width / 2, inside.left, inside.right),
      card.x,
      card.x + card.width,
    );
    const y = clamp(
      clamp(card.y + card.height / 2, inside.top, inside.bottom),
      card.y,
      card.y + card.height,
    );
    const targetX = clamp(x, inside.left, inside.right);
    const targetY = clamp(y, inside.top, inside.bottom);
    const exposed = [
      {
        side: "bottom" as const,
        from: { x, y: card.y },
        to: { x: targetX, y: inside.top },
        distance: card.y - inside.top,
      },
      {
        side: "top" as const,
        from: { x, y: card.y + card.height },
        to: { x: targetX, y: inside.bottom },
        distance: inside.bottom - card.y - card.height,
      },
      {
        side: "right" as const,
        from: { x: card.x, y },
        to: { x: inside.left, y: targetY },
        distance: card.x - inside.left,
      },
      {
        side: "left" as const,
        from: { x: card.x + card.width, y },
        to: { x: inside.right, y: targetY },
        distance: inside.right - card.x - card.width,
      },
    ]
      .filter((edge) => edge.distance > 0)
      .map((edge) => ({
        ...edge,
        length: Math.hypot(edge.to.x - edge.from.x, edge.to.y - edge.from.y),
      }))
      .sort((a, b) => a.length - b.length);
    const edge =
      exposed.find((candidate) => candidate.length >= 16) ?? exposed[0];
    return {
      card,
      target: visible,
      side: edge?.side ?? side,
      arrow: edge ? { from: edge.from, to: edge.to } : null,
    };
  }
  const horizontal = side === "left" || side === "right";
  const from = horizontal
    ? {
        x: side === "left" ? card.x + card.width : card.x,
        y: clamp(cy, card.y + 16, card.y + card.height - 16),
      }
    : {
        x: clamp(cx, card.x + 16, card.x + card.width - 16),
        y: side === "top" ? card.y + card.height : card.y,
      };
  const to = horizontal
    ? {
        x: side === "left" ? inside.left : inside.right,
        y: clamp(from.y, inside.top, inside.bottom),
      }
    : {
        x: clamp(from.x, inside.left, inside.right),
        y: side === "top" ? inside.top : inside.bottom,
      };
  return { card, target: visible, arrow: { from, to }, side };
}

/** Responsive duplicates can have dimensions while a containing panel is hidden. */
export function findVisibleTourTarget(step: TourStep): HTMLElement | null {
  for (const target of document.querySelectorAll<HTMLElement>(
    `[data-tour="${step}"]`,
  )) {
    let hidden = false;
    for (
      let node: HTMLElement | null = target;
      node;
      node = node.parentElement
    ) {
      const style = getComputedStyle(node);
      if (
        node.hidden ||
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.visibility === "collapse"
      ) {
        hidden = true;
        break;
      }
    }
    const rect = target.getBoundingClientRect();
    if (!hidden && rect.width > 0 && rect.height > 0) return target;
  }
  return null;
}

export function getVisibleTourRect(
  target: HTMLElement,
  viewport: TourRect,
): TourRect | null {
  const rect = target.getBoundingClientRect();
  let visible = intersectTourRects(
    { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
    viewport,
  );
  for (
    let parent = target.parentElement;
    parent && visible;
    parent = parent.parentElement
  ) {
    const style = getComputedStyle(parent);
    const clipsX = /(auto|scroll|hidden|clip)/.test(
      style.overflowX || style.overflow,
    );
    const clipsY = /(auto|scroll|hidden|clip)/.test(
      style.overflowY || style.overflow,
    );
    if (!clipsX && !clipsY) continue;
    const bounds = parent.getBoundingClientRect();
    visible = intersectTourRects(visible, {
      x: clipsX ? bounds.left : viewport.x,
      y: clipsY ? bounds.top : viewport.y,
      width: clipsX ? bounds.width : viewport.width,
      height: clipsY ? bounds.height : viewport.height,
    });
  }
  return visible;
}
