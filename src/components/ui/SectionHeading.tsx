interface SectionHeadingProps {
  kicker: string
  title: string
  subtitle?: string
  align?: 'left' | 'center'
  id?: string
  tone?: 'light' | 'dark'
}

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
        className={`text-xs md:text-sm font-semibold uppercase tracking-[0.22em] mb-3 ${
          isDark ? 'text-ambar' : 'text-terracota'
        }`}
      >
        {kicker}
      </p>
      <h2
        id={id}
        className={`font-display font-semibold leading-[1.05] text-(length:--text-section) ${
          isDark ? 'text-crema' : 'text-tinta'
        }`}
      >
        {title}
      </h2>
      {subtitle ? (
        <p
          className={`mt-4 text-base md:text-lg leading-relaxed ${
            isDark ? 'text-crema/70' : 'text-tinta-suave'
          }`}
        >
          {subtitle}
        </p>
      ) : null}
    </header>
  )
}
