import { useCallback, useEffect, useRef } from "react";

export function useNavigation({ page, selected, setPage, setSelected, setNavStack, setShowSearch }) {
  const pageRef = useRef(page);
  const selectedRef = useRef(selected);
  const pendingScrollRestore = useRef(null);

  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  const navigateBack = useCallback(() => {
    setNavStack((previous) => {
      if (previous.length === 0) return previous;
      const last = previous[previous.length - 1];
      setPage(last.page);
      setSelected(last.selected);
      pendingScrollRestore.current = { page: last.page, scrollTop: last.scrollTop || 0 };
      if (typeof gc === "function") requestIdleCallback(() => gc(), { timeout: 2000 });
      return previous.slice(0, -1);
    });
  }, [setNavStack, setPage, setSelected]);

  const navigate = useCallback((nextPage, data = null) => {
    const scrollContainer = document.querySelector(".app-content");
    const currentScroll = scrollContainer ? scrollContainer.scrollTop : 0;
    setNavStack((previous) => [
      ...previous,
      { page: pageRef.current, selected: selectedRef.current, scrollTop: currentScroll },
    ]);
    setSelected(data);
    setPage(nextPage);
    setShowSearch(false);
    requestAnimationFrame(() => {
      const container = document.querySelector(".app-content");
      if (container) container.scrollTop = 0;
    });
    if (typeof gc === "function") requestIdleCallback(() => gc(), { timeout: 2000 });
  }, [setNavStack, setPage, setSelected, setShowSearch]);

  useEffect(() => {
    if (!pendingScrollRestore.current || pendingScrollRestore.current.page !== page) return undefined;
    const targetScroll = pendingScrollRestore.current.scrollTop;
    pendingScrollRestore.current = null;
    const restore = () => {
      const container = document.querySelector(".app-content");
      if (container) container.scrollTop = targetScroll;
    };
    restore();
    const timers = [30, 100, 300].map((delay) => setTimeout(restore, delay));
    return () => timers.forEach(clearTimeout);
  }, [page]);

  return { navigate, navigateBack, pageRef };
}
