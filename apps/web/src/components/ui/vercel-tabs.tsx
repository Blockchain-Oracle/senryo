"use client";

// 21st: yadwinder/vercel-tabs (#1597) — https://21st.dev/@yadwinder/components/vercel-tabs
// D2 re-tokenized: foreground/muted tokens, hover pill on --accent, 2-hairline active underline, 160 ms desk easing.
// Adds link mode: pass `renderTab` (e.g. next/link) so the shell drives the active tab from the pathname.
import {
  type CSSProperties,
  type FocusEvent,
  forwardRef,
  type HTMLAttributes,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";

export interface Tab {
  id: string;
  label: string;
  href?: string;
}

export interface RenderTabArgs {
  tab: Tab;
  active: boolean;
  className: string;
  children: ReactNode;
}

interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  tabs: readonly Tab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  /** Renders each tab as a custom element (a link). The element must forward its props/className. */
  renderTab?: (args: RenderTabArgs) => ReactNode;
  label?: string;
}

type Box = { left: number; width: number };
const HIDDEN: Box = { left: 0, width: 0 };

/** Measured offsets are CSS pixels; styles are written in rem against the root size. */
const PX_PER_REM = 16;
const toStyle = (box: Box): CSSProperties => ({
  left: `${box.left / PX_PER_REM}rem`,
  width: `${box.width / PX_PER_REM}rem`,
});

const ROW = "relative flex items-center gap-1.5";

/** Link mode is site navigation (`<nav>` + aria-current links); button mode is an ARIA tablist. */
function TabRow({ asNav, label, children }: { asNav: boolean; label: string; children: ReactNode }) {
  return asNav ? (
    <nav aria-label={label} className={ROW}>
      {children}
    </nav>
  ) : (
    <div role="tablist" aria-label={label} className={ROW}>
      {children}
    </div>
  );
}

const Tabs = forwardRef<HTMLDivElement, TabsProps>(
  ({ className, tabs, activeTab, onTabChange, renderTab, label = "Sections", ...props }, ref) => {
    const found = tabs.findIndex((t) => t.id === activeTab);
    const [localIndex, setLocalIndex] = useState(Math.max(0, found));
    // Controlled with an id that is not a tab (e.g. /account on the desk) → no tab is active, not the first one.
    const activeIndex = activeTab !== undefined ? found : localIndex;
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [hoverBox, setHoverBox] = useState<Box>(HIDDEN);
    const [activeBox, setActiveBox] = useState<Box>(HIDDEN);
    const tabRefs = useRef<(HTMLElement | null)[]>([]);

    const measure = useCallback((index: number): Box => {
      const el = tabRefs.current[index];
      return el ? { left: el.offsetLeft, width: el.offsetWidth } : HIDDEN;
    }, []);

    useLayoutEffect(() => {
      if (hoveredIndex !== null) setHoverBox(measure(hoveredIndex));
    }, [hoveredIndex, measure]);

    useLayoutEffect(() => {
      const update = () => setActiveBox(measure(activeIndex));
      update();
      window.addEventListener("resize", update);
      document.fonts?.ready.then(update);
      return () => window.removeEventListener("resize", update);
    }, [activeIndex, measure]);

    return (
      <div ref={ref} className={cn("relative", className)} {...props}>
        <div className="relative">
          <div
            aria-hidden
            className="absolute top-1/2 h-8 -translate-y-1/2 rounded-md bg-accent transition-[left,width,opacity] duration-(--motion-base) ease-desk"
            style={{ ...toStyle(hoverBox), opacity: hoveredIndex !== null ? 1 : 0 }}
          />
          <div
            aria-hidden
            className="absolute -bottom-1 h-0.5 bg-foreground transition-[left,width] duration-(--motion-base) ease-desk"
            style={toStyle(activeBox)}
          />
          <TabRow asNav={Boolean(renderTab)} label={label}>
            {tabs.map((tab, index) => {
              const active = index === activeIndex;
              const tabClass = cn(
                "flex h-11 cursor-pointer items-center justify-center whitespace-nowrap px-3 text-body font-medium outline-none transition-colors duration-(--motion-base) ease-desk focus-visible:ring-2 focus-visible:ring-ring rounded-md",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              );
              const common = {
                ref: (el: HTMLElement | null) => {
                  tabRefs.current[index] = el;
                },
                onPointerEnter: (e: PointerEvent<HTMLElement>) => e.pointerType === "mouse" && setHoveredIndex(index),
                onPointerLeave: () => setHoveredIndex(null),
                onFocus: (e: FocusEvent<HTMLElement>) => e.target.matches(":focus-visible") && setHoveredIndex(index),
                onBlur: () => setHoveredIndex(null),
              };
              if (renderTab) {
                return (
                  <span key={tab.id} {...common} className="flex">
                    {renderTab({ tab, active, className: tabClass, children: tab.label })}
                  </span>
                );
              }
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  tabIndex={active ? 0 : -1}
                  className={tabClass}
                  {...common}
                  onClick={() => {
                    setLocalIndex(index);
                    onTabChange?.(tab.id);
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </TabRow>
        </div>
      </div>
    );
  },
);
Tabs.displayName = "Tabs";

export { Tabs };
