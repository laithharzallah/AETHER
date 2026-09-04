/**
 * ICFR vocabulary (COSO 2013 / PCAOB AS 2201 / SOX 404). Shared between
 * server code, API routes and client components — keep this file free of
 * server-only imports.
 */

export const ASSERTIONS = [
  'existence_occurrence',
  'completeness',
  'accuracy',
  'valuation_allocation',
  'cutoff',
  'rights_obligations',
  'presentation_disclosure',
] as const
export type Assertion = (typeof ASSERTIONS)[number]

export const ASSERTION_LABEL: Record<Assertion, string> = {
  existence_occurrence: 'Existence / Occurrence',
  completeness: 'Completeness',
  accuracy: 'Accuracy',
  valuation_allocation: 'Valuation / Allocation',
  cutoff: 'Cut-off',
  rights_obligations: 'Rights & Obligations',
  presentation_disclosure: 'Presentation & Disclosure',
}

export const ASSERTION_SHORT: Record<Assertion, string> = {
  existence_occurrence: 'E/O',
  completeness: 'C',
  accuracy: 'A',
  valuation_allocation: 'V',
  cutoff: 'CO',
  rights_obligations: 'R&O',
  presentation_disclosure: 'P&D',
}

export const CONTROL_TYPES = ['preventive', 'detective'] as const
export type ControlType = (typeof CONTROL_TYPES)[number]
export const CONTROL_TYPE_LABEL: Record<ControlType, string> = {
  preventive: 'Preventive',
  detective: 'Detective',
}

export const NATURES = ['manual', 'automated', 'it_dependent'] as const
export type Nature = (typeof NATURES)[number]
export const NATURE_LABEL: Record<Nature, string> = {
  manual: 'Manual',
  automated: 'Automated',
  it_dependent: 'IT-dependent manual',
}

export const FREQUENCIES = [
  'multiple_daily',
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'annually',
  'event_driven',
] as const
export type Frequency = (typeof FREQUENCIES)[number]
export const FREQUENCY_LABEL: Record<Frequency, string> = {
  multiple_daily: 'Multiple times daily',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annually: 'Annually',
  event_driven: 'Event-driven',
}

/** Typical operating-effectiveness sample sizes by control frequency. */
export const SAMPLE_SIZE_GUIDE: Record<Frequency, { min: number; max: number }> = {
  multiple_daily: { min: 25, max: 60 },
  daily: { min: 20, max: 40 },
  weekly: { min: 5, max: 15 },
  monthly: { min: 2, max: 5 },
  quarterly: { min: 2, max: 2 },
  annually: { min: 1, max: 1 },
  event_driven: { min: 1, max: 25 },
}

export const LEVELS = ['entity', 'process', 'itgc'] as const
export type Level = (typeof LEVELS)[number]
export const LEVEL_LABEL: Record<Level, string> = {
  entity: 'Entity-level',
  process: 'Process-level',
  itgc: 'ITGC',
}

export const COSO_COMPONENTS = [
  'control_environment',
  'risk_assessment',
  'control_activities',
  'information_communication',
  'monitoring',
] as const
export type CosoComponent = (typeof COSO_COMPONENTS)[number]
export const COSO_LABEL: Record<CosoComponent, string> = {
  control_environment: 'Control Environment',
  risk_assessment: 'Risk Assessment',
  control_activities: 'Control Activities',
  information_communication: 'Information & Communication',
  monitoring: 'Monitoring Activities',
}

export const CONTROL_STATUSES = ['designed', 'implemented', 'retired'] as const
export type ControlStatus = (typeof CONTROL_STATUSES)[number]
export const CONTROL_STATUS_LABEL: Record<ControlStatus, string> = {
  designed: 'Designed',
  implemented: 'Implemented',
  retired: 'Retired',
}

export const PROCESS_STATUSES = ['active', 'inactive', 'archived'] as const
export type ProcessStatus = (typeof PROCESS_STATUSES)[number]

export const TEST_TYPES = ['design', 'operating'] as const
export type TestType = (typeof TEST_TYPES)[number]
export const TEST_TYPE_LABEL: Record<TestType, string> = {
  design: 'Design effectiveness',
  operating: 'Operating effectiveness',
}

export const TEST_RESULTS = [
  'effective',
  'effective_with_exceptions',
  'ineffective',
  'not_tested',
] as const
export type TestResult = (typeof TEST_RESULTS)[number]
export const TEST_RESULT_LABEL: Record<TestResult, string> = {
  effective: 'Effective',
  effective_with_exceptions: 'Effective with exceptions',
  ineffective: 'Ineffective',
  not_tested: 'Not tested',
}

export const SEVERITIES = [
  'deficiency',
  'significant_deficiency',
  'material_weakness',
] as const
export type Severity = (typeof SEVERITIES)[number]
export const SEVERITY_LABEL: Record<Severity, string> = {
  deficiency: 'Deficiency',
  significant_deficiency: 'Significant deficiency',
  material_weakness: 'Material weakness',
}

export const DEFICIENCY_STATUSES = [
  'open',
  'in_remediation',
  'remediated',
  'closed',
] as const
export type DeficiencyStatus = (typeof DEFICIENCY_STATUSES)[number]
export const DEFICIENCY_STATUS_LABEL: Record<DeficiencyStatus, string> = {
  open: 'Open',
  in_remediation: 'In remediation',
  remediated: 'Remediated',
  closed: 'Closed',
}

export function isOneOf<T extends readonly string[]>(
  list: T,
  value: unknown
): value is T[number] {
  return typeof value === 'string' && (list as readonly string[]).includes(value)
}
