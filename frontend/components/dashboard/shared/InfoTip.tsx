'use client';

import { useId, useState } from 'react';

/**
 * ⓘ with a hover / focus tooltip — the one InfoTip of the dashboard (06 §5.2 tooltip look: 12px, `shadow-md`,
 * radius 12). A real button, so keyboard and screen-reader users reach it; the text is its accessible description,
 * read without hovering. Esc hides the bubble until the pointer leaves or focus moves (WCAG 1.4.13 dismissible).
 * `align` keeps the bubble inside narrow screens.
 */
export function InfoTip({ text, align = 'left', label = 'More information' }: { text: string; align?: 'left' | 'right'; label?: string }) {
  const id = useId();
  const [dismissed, setDismissed] = useState(false);
  return (
    <span
      className="group relative inline-flex align-middle"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !dismissed) {
          setDismissed(true);
          e.stopPropagation();
        }
      }}
      onMouseLeave={() => setDismissed(false)}
      onBlur={() => setDismissed(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        className="focus-ring cursor-help rounded-full text-xs font-normal leading-none text-ink-tertiary hover:text-ink-secondary"
      >
        ⓘ
      </button>
      <span
        id={id}
        role="tooltip"
        className={`absolute top-full z-20 mt-1 hidden w-64 max-w-[80vw] rounded-xl border border-line bg-surface-card px-3 py-2 text-left text-xs font-normal normal-case leading-5 tracking-normal text-ink-secondary shadow-md ${
          dismissed ? '' : 'group-hover:block group-focus-within:block'
        } ${align === 'right' ? 'right-0' : 'left-0'}`}
      >
        {text}
      </span>
    </span>
  );
}
