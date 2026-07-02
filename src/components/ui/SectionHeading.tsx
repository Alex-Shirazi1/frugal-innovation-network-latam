interface SectionHeadingProps {
  kicker: string
  title: string
  subtitle?: string
  align?: 'left' | 'center'
  id?: string
  tone?: 'light' | 'dark'
}

/**
 * Prod-style section heading: Oswald uppercase title with the site's
 * signature underline bar (teal on light, orange on dark).
 */
export function SectionHeading({
  kicker,
  title,
  subtitle,
  align = 'left',
  id,
  tone = 'light',
}: SectionHeadingProps) {
  const isCenter = align === 'center'
  const isDark = tone === 'dark'
  return (
    <header className={`max-w-3xl ${isCenter ? 'mx-auto text-center' : ''} mb-10 md:mb-14`}>
      <p
        className={`text-xs md:text-sm font-bold uppercase tracking-[0.22em] mb-2.5 ${
          isDark ? 'text-naranja' : 'text-rojo'
        }`}
      >
        {kicker}
      </p>
      <h2
        id={id}
        className={`font-display font-medium uppercase leading-[1.08] text-(length:--text-section) ${
          isDark ? 'text-blanco' : 'text-carbon'
        }`}
      >
        {title}
      </h2>
      <span
        aria-hidden="true"
        className={`mt-4 block h-1 w-16 rounded-full ${isCenter ? 'mx-auto' : ''} ${
          isDark ? 'bg-naranja' : 'bg-teal'
        }`}
      />
      {subtitle ? (
        <p
          className={`mt-4 text-base md:text-lg leading-relaxed ${
            isDark ? 'text-blanco/70' : 'text-pizarra'
          }`}
        >
          {subtitle}
        </p>
      ) : null}
    </header>
  )
}
