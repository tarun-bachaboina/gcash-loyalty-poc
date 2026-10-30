import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  count?: number;
}

interface TabsProps<T extends string> {
  tabs: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
  className?: string;
}

/** Segmented tablist (working surface). Arrow keys move between tabs. */
export function Tabs<T extends string>({ tabs, value, onChange, label, className }: TabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  // On narrow screens the tabs scroll; fade whichever edge has more tabs so clipping reads as "scroll".
  const [fade, setFade] = useState({ left: false, right: false });

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const update = () => setFade({ left: el.scrollLeft > 2, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    refs.current[tabs.findIndex((t) => t.id === value)]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [value, tabs]);

  const mask = `linear-gradient(to right, ${fade.left ? 'transparent, #000 24px' : '#000'}, ${fade.right ? '#000 calc(100% - 32px), transparent' : '#000'})`;
  function onKey(e: KeyboardEvent, i: number) {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (i + dir + tabs.length) % tabs.length;
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  }
  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      className={`flex gap-1 overflow-x-auto rounded-full bg-surface-2 p-1 [scrollbar-width:none] ${className ?? ''}`}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      {tabs.map((t, i) => {
        const selected = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={`min-h-11 flex-1 shrink-0 rounded-full px-2.5 text-[0.8125rem] font-bold whitespace-nowrap transition-colors duration-150 ${
              selected ? 'bg-surface-1 text-brand shadow-e1' : 'text-text-2 hover:text-text-1'
            }`}
          >
            {t.label}
            {t.count !== undefined && <span className={`ml-1.5 tabular ${selected ? 'text-brand' : 'text-text-2'}`}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
