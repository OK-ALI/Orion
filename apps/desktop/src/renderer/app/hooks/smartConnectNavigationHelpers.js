export const SIDEBAR_PAGES = [
  "home",
  "search",
  "discover",
  "constellation",
  "library",
  "downloads",
  "music-home",
  "settings",
];

export function getScrollContainer() {
  return (
    document.querySelector(".app-content") ||
    document.querySelector(".music-planet-container") ||
    document.querySelector(".page-content") ||
    document.scrollingElement ||
    window
  );
}

export function getHorizontalScrollContainer(hoveredElement = null) {
  if (hoveredElement) {
    const el = hoveredElement.closest?.(
      "[data-horizontal-scroll], .row-scroll, .shelf-scroll, .carousel-track, .music-scroll-row, .horizontal-scroll, .constellation-grid"
    );
    if (el) return el;
  }
  const focused = document.querySelector(".spatial-remote-focused");
  if (focused) {
    const el = focused.closest?.(
      "[data-horizontal-scroll], .row-scroll, .shelf-scroll, .carousel-track, .music-scroll-row, .horizontal-scroll"
    );
    if (el) return el;
  }
  const anyHScroll = document.querySelector(
    "[data-horizontal-scroll], .row-scroll, .carousel-track, .music-scroll-row, .horizontal-scroll"
  );
  if (anyHScroll && anyHScroll.scrollWidth > anyHScroll.clientWidth) return anyHScroll;
  return getScrollContainer();
}

let carouselAccumulatedDeltaX = 0;
let carouselSwipeResetTimer = null;

export function advanceMediaCarousel(element, deltaX) {
  carouselAccumulatedDeltaX += deltaX;
  if (carouselSwipeResetTimer) clearTimeout(carouselSwipeResetTimer);
  carouselSwipeResetTimer = setTimeout(() => {
    carouselAccumulatedDeltaX = 0;
  }, 350);

  if (Math.abs(carouselAccumulatedDeltaX) >= 28) {
    const isNext = carouselAccumulatedDeltaX > 0;
    carouselAccumulatedDeltaX = 0;

    const wrapper =
      element.classList.contains("media-carousel-wrapper")
        ? element
        : element.querySelector?.(".media-carousel-wrapper") || element;

    const nextBtn = wrapper.querySelector?.(".media-carousel-btn.right");
    const prevBtn = wrapper.querySelector?.(".media-carousel-btn.left");

    if (isNext && nextBtn) {
      nextBtn.click();
    } else if (!isNext && prevBtn) {
      prevBtn.click();
    } else if (typeof window !== "undefined" && window.WheelEvent) {
      wrapper.dispatchEvent(
        new window.WheelEvent("wheel", {
          deltaX: isNext ? 120 : -120,
          deltaY: 0,
          bubbles: true,
          cancelable: true,
        })
      );
    }
  }
}

export function applyHorizontalScroll(deltaX, deltaY, hoveredElement = null) {
  if (hoveredElement) {
    const carousel = hoveredElement.closest?.(".media-carousel-section, .media-carousel-wrapper");
    if (carousel) {
      advanceMediaCarousel(carousel, deltaX);
      return;
    }
    const scrollable = hoveredElement.closest?.(
      "[data-horizontal-scroll], .row-scroll, .shelf-scroll, .carousel-track, .music-scroll-row, .horizontal-scroll, .constellation-grid"
    );
    if (scrollable) {
      scrollable.scrollBy?.({ left: deltaX, top: deltaY, behavior: "auto" });
      return;
    }
  }

  const focused = document.querySelector(".spatial-remote-focused");
  if (focused) {
    const carousel = focused.closest?.(".media-carousel-section, .media-carousel-wrapper");
    if (carousel) {
      advanceMediaCarousel(carousel, deltaX);
      return;
    }
    const scrollable = focused.closest?.(
      "[data-horizontal-scroll], .row-scroll, .shelf-scroll, .carousel-track, .music-scroll-row, .horizontal-scroll, .constellation-grid"
    );
    if (scrollable) {
      scrollable.scrollBy?.({ left: deltaX, top: deltaY, behavior: "auto" });
      return;
    }
  }

  const viewportHeight = (typeof window !== "undefined" ? window.innerHeight : 0) || document.documentElement?.clientHeight || 800;
  const viewportCenter = viewportHeight / 2;

  const candidates = Array.from(
    document.querySelectorAll(
      ".media-carousel-section, .media-carousel-wrapper, [data-horizontal-scroll], .row-scroll, .shelf-scroll, .music-scroll-row, .horizontal-scroll, .constellation-grid"
    )
  );

  let bestTarget = null;
  let minDistance = Infinity;

  for (const el of candidates) {
    const rect = el.getBoundingClientRect();
    if (rect.bottom > 80 && rect.top < viewportHeight - 80) {
      const elCenter = (rect.top + rect.bottom) / 2;
      const dist = Math.abs(elCenter - viewportCenter);
      if (dist < minDistance) {
        minDistance = dist;
        bestTarget = el;
      }
    }
  }

  if (bestTarget) {
    const isCarousel =
      bestTarget.classList.contains("media-carousel-section") ||
      bestTarget.classList.contains("media-carousel-wrapper");
    if (isCarousel) {
      advanceMediaCarousel(bestTarget, deltaX);
      return;
    }
    bestTarget.scrollBy?.({ left: deltaX, top: deltaY, behavior: "auto" });
    return;
  }

  const anyCarousel = document.querySelector(".media-carousel-wrapper, .media-carousel-section");
  if (anyCarousel) {
    advanceMediaCarousel(anyCarousel, deltaX);
    return;
  }

  getScrollContainer()?.scrollBy?.({ left: deltaX, top: deltaY, behavior: "auto" });
}

export function setNativeInputValue(element, value) {
  if (!element) return;
  if (element.isContentEditable) {
    element.textContent = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  const valueSetter = Object.getOwnPropertyDescriptor(element, "value")?.set;
  const prototype = Object.getPrototypeOf(element);
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(element, value);
  } else if (valueSetter) {
    valueSetter.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

export function moveSpatialFocus(action) {
  const selector =
    ".media-card, [role='button'], .poster-container, .card, .search-media-result";
  let cards = Array.from(document.querySelectorAll(selector));
  if (cards.length === 0) {
    cards = Array.from(document.querySelectorAll("button, [tabindex='0']"));
  }
  if (cards.length === 0) return;
  cards.forEach((element) => {
    if (!element.hasAttribute("tabindex")) element.setAttribute("tabindex", "0");
  });
  const focused = document.querySelector(".spatial-remote-focused");
  let index = focused ? cards.indexOf(focused) : cards.indexOf(document.activeElement);
  const nextIndex =
    action === "focus_card_next"
      ? index === -1
        ? 0
        : (index + 1) % cards.length
      : index === -1
        ? cards.length - 1
        : (index - 1 + cards.length) % cards.length;
  document
    .querySelectorAll(".spatial-remote-focused")
    .forEach((element) => element.classList.remove("spatial-remote-focused"));
  const target = cards[nextIndex];
  target?.classList.add("spatial-remote-focused");
  target?.focus?.();
  target?.scrollIntoView?.({
    behavior: "smooth",
    block: "center",
    inline: "center",
  });
}
