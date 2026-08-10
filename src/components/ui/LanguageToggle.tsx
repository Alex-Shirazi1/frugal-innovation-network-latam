import { useI18n, type Lang } from '../../i18n/I18nContext'

const options: Lang[] = ['es', 'en', 'pt']

/**
 * The es/en/pt switch, shared by the public navbar and the admin header.
 *
 * Lives here rather than inside Navbar because the admin panel needs the same
 * control without the rest of the public bar — the two surfaces have nothing
 * else in common, and a second copy would drift the moment either changed.
 */
export function LanguageToggle() {
  const { lang, setLang, t } = useI18n()
  return (
    <div
      role="group"
      aria-label={t.common.languageLabel}
      className="flex items-center rounded-full border border-carbon/15 bg-blanco/70 p-0.5 text-xs font-semibold"
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLang(option)}
          aria-pressed={lang === option}
          className={`rounded-full px-2 py-1 uppercase tracking-wide transition-colors sm:px-2.5 ${
            lang === option ? 'bg-carbon text-blanco' : 'text-pizarra hover:text-carbon'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  )
}
