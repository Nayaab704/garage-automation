import { useEffect, useRef } from "react";

function useActiveTabScroll(activeKey) {
  const tabRefs = useRef({});
  const hasMountedRef = useRef(false);

  useEffect(() => {
    const activeTab = tabRefs.current[activeKey];

    if (!activeTab) {
      return undefined;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      activeTab.scrollIntoView({
        behavior: hasMountedRef.current ? "smooth" : "auto",
        block: "nearest",
        inline: "center",
      });
      hasMountedRef.current = true;
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [activeKey]);

  return tabRefs;
}

export default useActiveTabScroll;
