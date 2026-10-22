import { X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  findVisibleTourTarget,
  getVisibleTourRect,
  placeTourCard,
  type TourPlacement,
  type TourStep,
} from "../utils/guidedTour";
import { useI18n } from "../utils/i18nContext";
import { ActionButton } from "./ui/ActionButton";
import { DialogBody } from "./ui/DialogBody";
import { IconButton } from "./ui/IconButton";

const popupSelector =
  '#global-settings-panel, [role="dialog"]:not([aria-modal="true"]):not([data-tour-card]), [role="menu"]';
const discoverySelector = `[data-tour], ${popupSelector}`;

export interface GuidedTourProps {
  open: boolean;
  steps: readonly TourStep[];
  stepIndex: number;
  appMode: "image" | "text";
  portalHost?: HTMLElement | null;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}

export function GuidedTour({
  open,
  steps,
  stepIndex,
  appMode,
  portalHost,
  onNext,
  onBack,
  onClose,
}: GuidedTourProps) {
  const { t, language } = useI18n();
  const step = steps[stepIndex] ?? steps[0] ?? "content";
  const stepCount = steps.length;
  const id = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const focusedStep = useRef<TourStep | null>(null);
  const cardHadFocus = useRef(false);
  const [placement, setPlacement] = useState<TourPlacement | null>(null);

  useEffect(() => {
    if (!open) {
      focusedStep.current = null;
      cardHadFocus.current = false;
      return;
    }
    // Only entry and semantic step changes move focus. Resizing, input edits,
    // scrolling and language/mode updates must leave the user's focus alone.
    const semanticChange = focusedStep.current !== step;
    const initialActive = document.activeElement;
    const lostPortalFocus =
      cardHadFocus.current && initialActive === document.body;
    if (!semanticChange && !lostPortalFocus) return;
    // The sheet schedules its own entry focus. Run after that mount work and
    // recover a focused card replaced by a portal move, without taking inputs.
    let focusFrame = 0;
    const frame = requestAnimationFrame(() => {
      focusFrame = requestAnimationFrame(() => {
        const active = document.activeElement;
        const editing =
          active instanceof HTMLElement &&
          (active.matches("input, textarea, select") ||
            active.isContentEditable);
        if (editing && (!semanticChange || active !== initialActive)) return;
        nextRef.current?.focus({ preventScroll: true });
        focusedStep.current = step;
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(focusFrame);
    };
  }, [open, step, portalHost]);

  useEffect(() => {
    if (!open) return;
    let frame = 0;
    let settleFrame = 0;
    let observedTarget: HTMLElement | null = null;
    let scrolledTarget: HTMLElement | null = null;
    const visibility = new MutationObserver(schedule);
    const visibilityNodes = new Set<Element>();
    const observedPopups = new Set<Element>();
    function observeVisibility() {
      visibility.disconnect();
      visibilityNodes.clear();
      for (const popup of observedPopups) resizeObserver?.unobserve(popup);
      observedPopups.clear();
      for (const popup of document.querySelectorAll(popupSelector)) {
        if (popup.closest("[data-tour-overlay]")) continue;
        observedPopups.add(popup);
        resizeObserver?.observe(popup);
      }
      for (const candidate of document.querySelectorAll(
        `[data-tour="${step}"], ${popupSelector}`,
      )) {
        if (candidate.closest("[data-tour-overlay]")) continue;
        for (
          let node: Element | null = candidate;
          node;
          node = node.parentElement
        ) {
          if (visibilityNodes.has(node)) continue;
          visibilityNodes.add(node);
          visibility.observe(node, {
            attributes: true,
            attributeFilter: ["class", "style", "hidden"],
          });
        }
      }
    }
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(schedule);
    function measure() {
      const visual = window.visualViewport;
      const viewport = {
        x: visual?.offsetLeft ?? 0,
        y: visual?.offsetTop ?? 0,
        width: visual?.width ?? window.innerWidth,
        height: visual?.height ?? window.innerHeight,
      };
      const target = findVisibleTourTarget(step);
      if (target !== observedTarget) {
        if (observedTarget) resizeObserver?.unobserve(observedTarget);
        observedTarget = target;
        if (target) resizeObserver?.observe(target);
      }
      if (target && scrolledTarget !== target) {
        scrolledTarget = target;
        target.scrollIntoView?.({
          block: "nearest",
          inline: "nearest",
          behavior: "instant",
        });
        // Re-read after sheet layout / scroll has been applied.
        cancelAnimationFrame(settleFrame);
        settleFrame = requestAnimationFrame(schedule);
      }
      const card = cardRef.current?.getBoundingClientRect();
      const preview = findVisibleTourTarget("preview");
      const preferredBounds =
        !portalHost && viewport.width >= 1024 && preview
          ? (getVisibleTourRect(preview, viewport) ?? undefined)
          : undefined;
      const obstacles = !portalHost
        ? Array.from(
            document.querySelectorAll<HTMLElement>(
              '[data-tour="content"], [data-tour="layout"], [data-tour="generate"], [data-tour="zoom"], .preview-controls, [data-testid="preview-ruler"], aside, header, ' +
                popupSelector,
            ),
          ).flatMap((node) => {
            if (node.closest("[data-tour-overlay]")) return [];
            const style = getComputedStyle(node);
            if (style.display === "none" || style.visibility === "hidden")
              return [];
            const bounds = getVisibleTourRect(node, viewport);
            return bounds ? [bounds] : [];
          })
        : [];
      const next = placeTourCard(
        target ? getVisibleTourRect(target, viewport) : null,
        {
          width: Math.min(280, viewport.width - 24),
          height: card?.height || 240,
        },
        viewport,
        {
          preferredBounds,
          obstacles,
          cardBounds:
            portalHost && card
              ? { x: card.x, y: card.y, width: card.width, height: card.height }
              : undefined,
        },
      );
      setPlacement((previous) =>
        samePlacement(previous, next) ? previous : next,
      );
    }
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    }
    if (cardRef.current) resizeObserver?.observe(cardRef.current);
    const mutations = new MutationObserver((records) => {
      if (
        records.some((record) =>
          [...record.addedNodes, ...record.removedNodes].some(
            (node) =>
              node instanceof Element &&
              (node.matches(discoverySelector) ||
                node.querySelector(discoverySelector)),
          ),
        )
      ) {
        observeVisibility();
        schedule();
      }
    });
    mutations.observe(document.body, { childList: true, subtree: true });
    observeVisibility();
    function onMotionEnd(event: Event) {
      if (
        event.target instanceof Element &&
        (visibilityNodes.has(event.target) ||
          event.target.contains(portalHost ?? null))
      )
        schedule();
    }
    window.addEventListener("resize", schedule);
    document.addEventListener("scroll", schedule, true);
    document.addEventListener("transitionend", onMotionEnd, true);
    document.addEventListener("animationend", onMotionEnd, true);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(settleFrame);
      resizeObserver?.disconnect();
      mutations.disconnect();
      visibility.disconnect();
      window.removeEventListener("resize", schedule);
      document.removeEventListener("scroll", schedule, true);
      document.removeEventListener("transitionend", onMotionEnd, true);
      document.removeEventListener("animationend", onMotionEnd, true);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
    };
  }, [open, step, appMode, portalHost, language]);

  if (!open) return null;
  const titleKey =
    step === "content"
      ? (`tour_content_${appMode}_title` as const)
      : (`tour_${step}_title` as const);
  const bodyKey =
    step === "content"
      ? (`tour_content_${appMode}_body` as const)
      : step === "layout"
        ? (`tour_layout_${appMode}_body` as const)
        : (`tour_${step}_body` as const);
  const target = placement?.target;
  const arrow = placement?.arrow;
  const last = stepIndex === stepCount - 1;
  return (
    <>
      {createPortal(
        <svg
          className="pointer-events-none fixed inset-0 h-full w-full overflow-visible z-[70]"
          aria-hidden="true"
        >
          <defs>
            <mask id={`${id}-mask`}>
              <rect width="100%" height="100%" fill="white" />
              {portalHost && placement && (
                <rect
                  x={placement.card.x}
                  y={placement.card.y}
                  width={placement.card.width}
                  height={placement.card.height}
                  rx="8"
                  fill="black"
                />
              )}
              {target && (
                <rect
                  x={target.x - 4}
                  y={target.y - 4}
                  width={target.width + 8}
                  height={target.height + 8}
                  rx="8"
                  fill="black"
                />
              )}
            </mask>
            <marker
              id={`${id}-arrow`}
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="4"
              orient="auto"
            >
              <path
                d="M1 1 L6 4 L1 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </marker>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="black"
            fillOpacity="0.28"
            mask={`url(#${id}-mask)`}
          />
          {target && (
            <rect
              data-tour-highlight=""
              x={target.x - 4}
              y={target.y - 4}
              width={target.width + 8}
              height={target.height + 8}
              rx="8"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-brand-primary"
            />
          )}
          {arrow && (
            <line
              data-tour-arrow=""
              x1={arrow.from.x}
              y1={arrow.from.y}
              x2={arrow.to.x}
              y2={arrow.to.y}
              stroke="currentColor"
              strokeWidth="2"
              markerEnd={`url(#${id}-arrow)`}
              className="text-brand-primary"
            />
          )}
        </svg>,
        document.body,
      )}
      {createPortal(
        <div
          ref={overlayRef}
          data-tour-overlay=""
          className={
            portalHost
              ? "pointer-events-none relative"
              : "pointer-events-none fixed inset-0 z-[70]"
          }
        >
          <div
            ref={cardRef}
            data-tour-card=""
            role="dialog"
            aria-labelledby={`${id}-title`}
            aria-describedby={`${id}-body`}
            onFocusCapture={() => {
              cardHadFocus.current = true;
            }}
            onBlurCapture={(event) => {
              if (
                event.relatedTarget instanceof Node &&
                !event.currentTarget.contains(event.relatedTarget)
              )
                cardHadFocus.current = false;
            }}
            className={`elevated-panel pointer-events-auto flex min-h-0 flex-col overflow-hidden text-text-main ${portalHost ? "relative w-full" : "fixed max-w-[calc(100vw-24px)]"}`}
            style={
              portalHost
                ? { maxHeight: "min(240px, 50dvh)" }
                : {
                    left: placement?.card.x ?? 12,
                    top: placement?.card.y ?? 12,
                    width:
                      placement?.card.width ??
                      Math.min(
                        280,
                        (window.visualViewport?.width ?? window.innerWidth) -
                          24,
                      ),
                    maxHeight: window.visualViewport
                      ? window.visualViewport.height - 24
                      : "calc(100dvh - 24px)",
                  }
            }
          >
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
            >
              {t("tour_progress", { step: stepIndex + 1, total: stepCount })}.{" "}
              {t(titleKey)}. {t(bodyKey)}
            </div>
            <div className="flex shrink-0 items-center gap-2 border-b border-border-subtle py-1 pr-1 pl-4">
              <span className="flex-1 text-xs font-semibold text-text-muted">
                {t("tour_title")} ·{" "}
                {t("tour_progress", { step: stepIndex + 1, total: stepCount })}
              </span>
              <IconButton
                aria-label={t("tour_close")}
                onClick={onClose}
                className="min-h-11 min-w-11"
              >
                <X />
              </IconButton>
            </div>
            <DialogBody
              role="region"
              aria-labelledby={`${id}-title`}
              tabIndex={0}
              className="px-4 py-3"
              id={`${id}-body`}
            >
              <h2 id={`${id}-title`} className="mb-2 text-base font-bold">
                {t(titleKey)}
              </h2>
              <p className="text-sm leading-relaxed text-text-muted">
                {t(bodyKey)}
              </p>
              {placement && !target && (
                <p className="mt-2 text-xs text-text-muted">
                  {t("tour_missing_target")}
                </p>
              )}
            </DialogBody>
            <div className="flex shrink-0 flex-wrap items-center gap-1 border-t border-border-subtle p-2 [&>button]:shrink-0">
              <ActionButton
                variant="quiet"
                className="min-h-11 px-3"
                onClick={onClose}
              >
                {t("tour_skip")}
              </ActionButton>
              <span className="flex-1" />
              {stepIndex > 0 && (
                <ActionButton
                  variant="secondary"
                  className="min-h-11 px-3"
                  onClick={onBack}
                >
                  {t("tour_back")}
                </ActionButton>
              )}
              <ActionButton
                ref={nextRef}
                className="min-h-11 px-3"
                onClick={onNext}
              >
                {t(last ? "tour_done" : "tour_next")}
              </ActionButton>
            </div>
          </div>
        </div>,
        portalHost ?? document.body,
      )}
    </>
  );
}

function samePlacement(a: TourPlacement | null, b: TourPlacement): boolean {
  const rectEqual = (x: TourPlacement["target"], y: TourPlacement["target"]) =>
    x === y ||
    (!!x &&
      !!y &&
      x.x === y.x &&
      x.y === y.y &&
      x.width === y.width &&
      x.height === y.height);
  return (
    !!a &&
    a.side === b.side &&
    rectEqual(a.card, b.card) &&
    rectEqual(a.target, b.target) &&
    (a.arrow === b.arrow ||
      (!!a.arrow &&
        !!b.arrow &&
        a.arrow.from.x === b.arrow.from.x &&
        a.arrow.from.y === b.arrow.from.y &&
        a.arrow.to.x === b.arrow.to.x &&
        a.arrow.to.y === b.arrow.to.y))
  );
}
