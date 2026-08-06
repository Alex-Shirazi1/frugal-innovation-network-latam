import type { SelectHTMLAttributes } from 'react'

/**
 * A native `<select>` with the browser's chevron replaced by our own.
 *
 * The six selects on the site were bare natives, and Chrome sizes those to the
 * widest option *plus its own arrow gutter*, then draws the chevron inside that
 * gutter — on top of whatever padding-right we set. On the pill filters that
 * stacked up as a visible gap between the label and the arrow; on a `w-full`
 * form field it put the arrow at the far edge, a long way from the value.
 *
 * `appearance-none` drops the gutter so the spacing is ours to set: `pr-8`/`pr-10`
 * against a chevron pinned `right-3`/`right-4`. The element stays a real select,
 * so the native dropdown, keyboard behaviour and mobile pickers are untouched.
 */

type SelectVariant =
  /** Filter bars: intrinsic width, sits in a row of rounded controls. */
  | 'pill'
  /** Forms: full width, matching the text inputs stacked above and below it. */
  | 'field'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  variant?: SelectVariant
  /**
   * Applied to the wrapper, which is the positioning context for the chevron —
   * so width and layout classes belong here. Putting a `max-w-*` on the select
   * instead would shrink the control while leaving the chevron pinned to the
   * wrapper's edge, detached from it.
   */
  className?: string
  /** Applied to the select itself, for surface-level overrides like `bg-*`. */
  controlClassName?: string
}

const WRAPPER: Record<SelectVariant, string> = {
  pill: 'relative inline-flex',
  field: 'relative block w-full',
}

const CONTROL: Record<SelectVariant, string> = {
  pill: 'w-full appearance-none rounded-full border border-carbon/15 bg-white py-2 pl-3.5 pr-8 text-xs font-semibold text-carbon outline-none transition-colors hover:border-carbon/30 focus:border-teal',
  field:
    'w-full appearance-none rounded-xl border border-carbon/15 bg-white py-3 pl-4 pr-10 text-sm text-carbon outline-none transition-colors hover:border-carbon/30 focus:border-teal disabled:cursor-not-allowed disabled:bg-niebla/70 disabled:text-pizarra/60',
}

/** Chevron inset, matched to the padding-right of each variant. */
const CHEVRON: Record<SelectVariant, string> = {
  pill: 'right-3 size-3.5',
  field: 'right-4 size-4',
}

export function Select({
  variant = 'field',
  className = '',
  controlClassName = '',
  ...props
}: SelectProps) {
  return (
    <span className={`${WRAPPER[variant]} ${className}`}>
      {/*
        `peer` + `pointer-events-none`: the chevron picks up the select's focus
        state so the whole control reads as one thing, while every click still
        lands on the select underneath it.
      */}
      <select className={`peer ${CONTROL[variant]} ${controlClassName}`} {...props} />
      <svg
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-pizarra transition-colors peer-focus:text-teal peer-disabled:text-pizarra/40 ${CHEVRON[variant]}`}
      >
        <path
          d="M4 6.5 8 10.5l4-4"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
