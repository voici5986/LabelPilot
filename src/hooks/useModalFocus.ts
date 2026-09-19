import { useEffect, useRef } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from "react";

interface UseModalFocusOptions<T extends HTMLElement> {
  open: boolean;
  containerRef: RefObject<T | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onDismiss: () => void;
}

const FOCUSABLE_SELECTOR =
  "button, input, select, textarea, a[href], [tabindex]";

function isVisibleFocusable(element: HTMLElement): boolean {
  if (
    element.hasAttribute("disabled") ||
    element.getAttribute("aria-disabled") === "true" ||
    element.getAttribute("aria-hidden") === "true" ||
    element.hasAttribute("hidden") ||
    element.hasAttribute("inert") ||
    element.tabIndex < 0
  ) {
    return false;
  }

  for (
    let current: HTMLElement | null = element;
    current;
    current = current.parentElement
  ) {
    if (
      current.hasAttribute("hidden") ||
      current.getAttribute("aria-hidden") === "true" ||
      current.getAttribute("aria-disabled") === "true" ||
      current.hasAttribute("inert") ||
      (current.tagName === "FIELDSET" &&
        (current as HTMLFieldSetElement).disabled)
    ) {
      return false;
    }
    const style = window.getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
  }
  return true;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(isVisibleFocusable);
}

export function useModalFocus<T extends HTMLElement>({
  open,
  containerRef,
  initialFocusRef,
  onDismiss,
}: UseModalFocusOptions<T>) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const frame = requestAnimationFrame(() => {
      const initial = initialFocusRef?.current;
      if (initial && isVisibleFocusable(initial)) {
        initial.focus();
        return;
      }
      const container = containerRef.current;
      if (container) getFocusableElements(container)[0]?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [containerRef, initialFocusRef, open]);

  useEffect(() => {
    if (open) return;
    previousFocusRef.current?.focus();
    previousFocusRef.current = null;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss, open]);

  const handleKeyDown = (event: ReactKeyboardEvent<T>) => {
    if (event.key !== "Tab" || !containerRef.current) return;
    const focusable = getFocusableElements(containerRef.current);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return { handleKeyDown };
}
