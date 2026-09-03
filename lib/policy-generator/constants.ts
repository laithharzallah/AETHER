export const POLICY_TYPES = [
  'Information Security Policy',
  'Access Control Policy',
  'Data Protection & Privacy Policy',
  'Acceptable Use Policy',
  'Business Continuity Policy',
  'Incident Response Policy',
  'AI Governance Policy',
  'Third-Party Risk Management Policy',
  'Cloud Security Policy',
  'Cryptography & Key Management Policy',
] as const

/**
 * Static fallback used only when the regulatory library has not been seeded.
 * Codes must match `frameworks.code` in the database.
 */
export const FRAMEWORKS = [
  { code: 'SAMA-CSF', label: 'SAMA CSF', jurisdiction: 'SA' },
  { code: 'NCA-ECC', label: 'NCA ECC', jurisdiction: 'SA' },
  { code: 'KSA-PDPL', label: 'Saudi PDPL', jurisdiction: 'SA' },
  { code: 'UAE-IAS', label: 'UAE IA Standards', jurisdiction: 'AE' },
  { code: 'QCB-TRM', label: 'QCB Technology Risk', jurisdiction: 'QA' },
  { code: 'QA-NIA', label: 'Qatar NIA Policy', jurisdiction: 'QA' },
  { code: 'CBJ-CSF', label: 'CBJ Cyber Security', jurisdiction: 'JO' },
  { code: 'ISO-27001', label: 'ISO/IEC 27001:2022', jurisdiction: 'INTL' },
  { code: 'NIST-CSF', label: 'NIST CSF 2.0', jurisdiction: 'INTL' },
  { code: 'EU-AI-ACT', label: 'EU AI Act', jurisdiction: 'EU' },
] as const

export type PolicyType = (typeof POLICY_TYPES)[number]
export type FrameworkCode = (typeof FRAMEWORKS)[number]['code']
