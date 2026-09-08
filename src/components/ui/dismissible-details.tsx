"use client";

import {
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type RefObject,
} from "react";

type DismissibleDetailsProps = ComponentPropsWithoutRef<"details"> &
  Readonly<{
    closeKey?: string;
    detailsRef?: RefObject<HTMLDetailsElement | null>;
  }>;

export function DismissibleDetails({
  children,
  closeKey,
  detailsRef,
  ...props
}: DismissibleDetailsProps) {
  const localRef = useRef<HTMLDetailsElement>(null);
  const resolvedRef = detailsRef ?? localRef;

  useEffect(() => {
    const details = resolvedRef.current;
    if (!details) return;
    details.open = false;
  }, [closeKey, resolvedRef]);

  useEffect(() => {
    function close(restoreFocus: boolean) {
      const details = resolvedRef.current;
      if (!details?.open) return;
      details.open = false;
      if (restoreFocus) {
        details.querySelector<HTMLElement>(":scope > summary")?.focus();
      }
    }

    function handlePointerDown(event: PointerEvent) {
      const details = resolvedRef.current;
      if (
        details &&
        event.target instanceof Node &&
        !details.contains(event.target)
      ) {
        close(false);
      }
    }

    function handleFocusIn(event: FocusEvent) {
      const details = resolvedRef.current;
      if (
        details &&
        event.target instanceof Node &&
        !details.contains(event.target)
      ) {
        close(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close(true);
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [resolvedRef]);

  return (
    <details {...props} ref={resolvedRef}>
      {children}
    </details>
  );
}
