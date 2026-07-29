import { Suspense, lazy } from 'react'
import { I18nProvider } from './i18n/I18nContext'
import { ApiDataProvider } from './api/ApiDataContext'
import { Navbar } from './components/layout/Navbar'
import { Hero } from './components/hero/Hero'
import { OriginSection } from './components/sections/OriginSection'
import { ConferenceArchive } from './components/conference/ConferenceArchive'
import { FrugalSection } from './components/sections/FrugalSection'
import { InitiativesSection } from './components/sections/InitiativesSection'
import { AboutSection } from './components/sections/AboutSection'
import { ContactSection } from './components/sections/ContactSection'
import { MemberDirectory } from './components/directory/MemberDirectory'
import { ResourceLibrary } from './components/library/ResourceLibrary'
import { OnboardingForm } from './components/onboarding/OnboardingForm'
import { Footer } from './components/layout/Footer'
import { DeferredSection } from './components/ui/DeferredSection'

/**
 * The map carries d3-geo, topojson-client and a 108kb world topology — far too
 * much to ship eagerly for a section below the fold. Split into its own chunk
 * and mounted only as the reader approaches it.
 */
const NetworkMap = lazy(() =>
  import('./components/map/NetworkMap').then((m) => ({ default: m.NetworkMap })),
)

/** Approximates the rendered map height so deferring costs no layout shift. */
const MAP_PLACEHOLDER_HEIGHT = 760

export default function App() {
  return (
    <I18nProvider>
      <ApiDataProvider>
        <div className="grain">
          <Navbar />
          <main>
            <Hero />
            <OriginSection />
            {/* Conference archive sits between Origin and Frugal Innovation per spec */}
            <ConferenceArchive />
            <FrugalSection />
            <AboutSection />
            <InitiativesSection />
            <DeferredSection anchorId="mapa" minHeight={MAP_PLACEHOLDER_HEIGHT}>
              <Suspense fallback={<div style={{ minHeight: MAP_PLACEHOLDER_HEIGHT }} />}>
                <NetworkMap />
              </Suspense>
            </DeferredSection>
            <MemberDirectory />
            <ResourceLibrary />
            <OnboardingForm />
            <ContactSection />
          </main>
          <Footer />
        </div>
      </ApiDataProvider>
    </I18nProvider>
  )
}
