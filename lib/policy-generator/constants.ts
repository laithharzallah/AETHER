export const POLICY_TYPES = [
  'Information Security Policy',
  'Access Control Policy',
  'Data Protection & Privacy Policy',
  'Acceptable Use Policy',
  'Business Continuity Policy',
  'AI Governance Policy',
  'Third-Party Risk Management Policy',
] as const

export const FRAMEWORKS = [
  'SAMA CSF',
  'NCA ECC',
  'SDAIA',
  'ISO 27001',
  'NIST CSF',
  'GDPR',
  'EU AI Act',
] as const

export type PolicyType = (typeof POLICY_TYPES)[number]
export type Framework = (typeof FRAMEWORKS)[number]
