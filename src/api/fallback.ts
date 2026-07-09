import type { RelifDataSource } from './dataSource'
import type { IntakeResult, IntakeSubmission } from './types'

/**
 * Composite source: tries the primary (HTTP) and falls back to the secondary
 * (bundled) when the primary is unreachable. Validation failures are real
 * answers and are NOT retried against the fallback — only transport errors are.
 */
export function createFallbackDataSource(
  primary: RelifDataSource,
  fallback: RelifDataSource,
  onFallback: (method: string, error: unknown) => void = () => {},
): RelifDataSource {
  function withFallback<T>(method: keyof RelifDataSource, run: (s: RelifDataSource) => Promise<T>): Promise<T> {
    return run(primary).catch((error: unknown) => {
      onFallback(method, error)
      return run(fallback)
    })
  }

  return {
    getInstitutions: () => withFallback('getInstitutions', (s) => s.getInstitutions()),
    getMembers: () => withFallback('getMembers', (s) => s.getMembers()),
    getResources: () => withFallback('getResources', (s) => s.getResources()),
    getConference: () => withFallback('getConference', (s) => s.getConference()),
    getOnboardingOptions: () => withFallback('getOnboardingOptions', (s) => s.getOnboardingOptions()),
    submitIntake: (submission: IntakeSubmission): Promise<IntakeResult> =>
      withFallback('submitIntake', (s) => s.submitIntake(submission)),
  }
}
