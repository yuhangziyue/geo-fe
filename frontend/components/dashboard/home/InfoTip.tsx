'use client';

import { useId } from 'react';

/**
 * ⓘ with a hover / focus tooltip (06 §5.2 tooltip look: 12px, `shadow-md`, radius 12). The text is also the
 * accessible description, so it is read without hovering. `align` keeps the bubble inside narrow screens.
 */
export function InfoTip({ text, align = 'left' }: { text: string; align?: 'left' | 'right' }) {
  const id = useId();
  return (
    <span className="group relative inline-flex align-middle">
      <span
        tabIndex={0}
        role="img"
        aria-label="More information"
        aria-describedby={id}
        className="focus-ring cursor-help rounded-full text-xs leading-none text-ink-tertiary"
      >
        ⓘ
      </span>
      <span
        id={id}
        role="tooltip"
        className={`absolute top-full z-20 mt-1 hidden w-64 max-w-[80vw] rounded-xl border border-line bg-surface-card px-3 py-2 text-xs font-normal leading-5 text-ink-secondary shadow-md group-hover:block group-focus-within:block ${
          align === 'right' ? 'right-0' : 'left-0'
        }`}
      >
        {text}
      </span>
    </span>
  );
}
