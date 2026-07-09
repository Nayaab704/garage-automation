import { useEffect } from "react";

function isEventInsideRefs(event, refs) {
  return refs.some((ref) => {
    const element = ref?.current;
    return element && element.contains(event.target);
  });
}

function useDismissableLayer({ enabled = true, onDismiss, refs = [] }) {
  useEffect(() => {
    if (!enabled || typeof onDismiss !== "function") {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!isEventInsideRefs(event, refs)) {
        onDismiss();
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onDismiss();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, onDismiss, refs]);
}

export default useDismissableLayer;
