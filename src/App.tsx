import { I18nProvider } from './i18n/I18nContext'
import { DirectoryProvider } from './store/DirectoryContext'
import { Navbar } from './components/layout/Navbar'
import { Hero } from './components/hero/Hero'
import { OriginSection } from './components/sections/OriginSection'
import { ConferenceArchive } from './components/conference/ConferenceArchive'
import { FrugalSection } from './components/sections/FrugalSection'
import { InitiativesSection } from './components/sections/InitiativesSection'
import { NetworkMap } from './components/map/NetworkMap'
import { MemberDirectory } from './components/directory/MemberDirectory'
import { ResourceLibrary } from './components/library/ResourceLibrary'
import { OnboardingForm } from './components/onboarding/OnboardingForm'
import { Footer } from './components/layout/Footer'

export default function App() {
  return (
    <I18nProvider>
      <DirectoryProvider>
        <div className="grain">
          <Navbar />
          <main>
            <Hero />
            <OriginSection />
            {/* Conference archive sits between Origin and Frugal Innovation per spec */}
            <ConferenceArchive />
            <FrugalSection />
            <InitiativesSection />
            <NetworkMap />
            <MemberDirectory />
            <ResourceLibrary />
            <OnboardingForm />
          </main>
          <Footer />
        </div>
      </DirectoryProvider>
    </I18nProvider>
  )
}
