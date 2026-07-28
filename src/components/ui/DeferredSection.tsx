import { useEffect, useRef, useState, type ReactNode } from 'react'

interface DeferredSectionProps {
  /** Reserved height while the section is not yet mounted, to avoid layout shift. */
  minHeight: number
  /** How far ahead of the viewport to start loading. */
  rootMargin?: string
  children: ReactNode
}

/**
 * Mounts its children only once they are near the viewport.
 *
 * Used to keep below-the-fold code out of the initial bundle: the map alone
 * pulls in d3-geo, topojson-client and a 108kb world topology, which is most of
 * the landing-page JS budget for something nobody sees until they scroll.
 *
 * The placeholder reserves height so deferring costs no CLS, and clients
 * without IntersectionObserver render immediately rather than never.
 */
export function DeferredSection({
  minHeight,
  rootMargin = '300px',
  children,
}: DeferredSectionProps) {
  const holderRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (visible) return
    const node = holderRef.current
    if (!node) return

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [visible, rootMargin])

  if (visible) return <>{children}</>

  return <div ref={holderRef} style={{ minHeight }} aria-hidden="true" />
}
