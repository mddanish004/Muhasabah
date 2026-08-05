"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(node: HTMLElement) {
  return Array.from(
    node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => !el.hasAttribute("hidden") && el.offsetParent !== null);
}

/**
 * Traps Tab/Shift+Tab focus inside the referenced dialog while `active`.
 * Returns a ref to attach to the dialog element.
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    const trapNode = node as HTMLElement;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const items = getFocusable(trapNode);
      if (items.length === 0) return;
      const current = document.activeElement;
      if (event.shiftKey) {
        if (current === items[0] || !trapNode.contains(current)) {
          event.preventDefault();
          items[items.length - 1].focus();
        }
      } else if (current === items[items.length - 1] || !trapNode.contains(current)) {
        event.preventDefault();
        items[0].focus();
      }
    }

    trapNode.addEventListener("keydown", handleKeyDown);
    return () => trapNode.removeEventListener("keydown", handleKeyDown);
  }, [active]);

  return ref;
}
