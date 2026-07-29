/**
 * The controlled topic vocabulary shared by the control catalogue (as
 * `framework_controls.tags`) and by signal analysis.
 *
 * Correlation depends on both sides speaking the same language. If analysis
 * invented its own labels, a signal about "identity management" would never
 * reach the controls tagged `identity`, and the whole pipeline would silently
 * produce nothing. Keeping the vocabulary closed and asserting membership at the
 * boundary is what stops that failing quietly.
 */

export const TOPICS = [
  'access_control',
  'identity',
  'authentication',
  'privileged_access',
  'cryptography',
  'key_management',
  'data_protection',
  'data_classification',
  'dlp',
  'backup',
  'recovery',
  'continuity',
  'redundancy',
  'capacity',
  'incident_response',
  'forensics',
  'logging',
  'monitoring',
  'siem',
  'clock_sync',
  'threat_intel',
  'vulnerability',
  'patching',
  'pentest',
  'malware',
  'network_security',
  'segmentation',
  'web_filtering',
  'email_security',
  'endpoint',
  'mobile',
  'byod',
  'teleworking',
  'cloud',
  'third_party',
  'outsourcing',
  'supply_chain',
  'physical',
  'hr_security',
  'awareness',
  'training',
  'governance',
  'roles',
  'policy',
  'risk_management',
  'compliance',
  'audit',
  'asset_management',
  'change_management',
  'configuration',
  'architecture',
  'secure_development',
  'appsec',
  'web_security',
  'secure_disposal',
  'media',
  'ot_ics',
  'payments',
  'privacy',
  'consent',
  'data_subject_rights',
  'breach_notification',
  'cross_border_transfer',
  'dpia',
  'dpo',
  'records_of_processing',
  'ai_governance',
  'ai_transparency',
  'ai_risk_assessment',
  'human_oversight',
  'bias_fairness',
  'explainability',
  'deepfake',
  'gpai',
] as const

export type Topic = (typeof TOPICS)[number]

const TOPIC_SET: ReadonlySet<string> = new Set(TOPICS)

export function isTopic(value: string): value is Topic {
  return TOPIC_SET.has(value)
}

/** Drops anything outside the vocabulary and de-duplicates. */
export function normalizeTopics(values: readonly string[]): Topic[] {
  const seen = new Set<Topic>()
  for (const raw of values) {
    const value = raw.trim().toLowerCase().replace(/[\s-]+/g, '_')
    if (isTopic(value)) seen.add(value)
  }
  return [...seen]
}

/**
 * Phrase patterns used to derive topics from regulatory prose when no language
 * model is available, and to enrich model output when one is.
 *
 * Patterns are matched against lowercased text. They are intentionally phrase
 * based rather than single words: "access" alone appears in almost every
 * regulatory document and would tag everything as access control.
 */
const TOPIC_PATTERNS: ReadonlyArray<readonly [Topic, readonly RegExp[]]> = [
  ['access_control', [/access control/, /least privilege/, /need[- ]to[- ]know/, /authoris?ation rules?/]],
  ['identity', [/identity management/, /identity lifecycle/, /joiner|mover|leaver/, /user provisioning/]],
  ['authentication', [/multi[- ]?factor/, /\bmfa\b/, /\b2fa\b/, /authentication/, /password polic/, /passwordless/]],
  ['privileged_access', [/privileged access/, /\bpam\b/, /administrative account/, /superuser|root account/]],
  ['cryptography', [/encryption/, /cryptograph/, /\btls\b/, /cipher suite/, /post[- ]quantum/]],
  ['key_management', [/key management/, /\bhsm\b/, /key rotation/, /certificate (?:management|lifecycle)/]],
  ['data_protection', [/data protection measures?/, /protection of (?:data|information)/, /data security/]],
  ['data_classification', [/data classification/, /information classification/, /labell?ing of (?:data|information)/]],
  ['dlp', [/data (?:loss|leakage) prevention/, /\bdlp\b/, /exfiltration prevention/]],
  ['backup', [/backup/, /restore (?:test|verification)/]],
  ['recovery', [/disaster recovery/, /recovery (?:time|point) objective/, /\brto\b/, /\brpo\b/]],
  ['continuity', [/business continuity/, /operational resilience/, /\bbcm\b/, /\bbcp\b/]],
  ['redundancy', [/redundanc/, /high availability/, /failover/]],
  ['capacity', [/capacity (?:management|planning)/]],
  ['incident_response', [/incident (?:response|management|handling)/, /security incident/, /\bcsirt\b/, /\bsoc\b team/]],
  ['forensics', [/forensic/, /chain of custody/, /evidence (?:collection|preservation)/]],
  ['logging', [/audit log/, /event log/, /\blogging\b/, /log retention/]],
  ['monitoring', [/continuous monitoring/, /security monitoring/, /anomaly detection/]],
  ['siem', [/\bsiem\b/, /security information and event management/]],
  ['clock_sync', [/clock synchroni[sz]ation/, /time synchroni[sz]ation/, /\bntp\b/]],
  ['threat_intel', [/threat intelligence/, /threat landscape/, /indicators? of compromise/, /\bioc\b/]],
  ['vulnerability', [/vulnerabilit/, /\bcve-\d{4}-\d+/, /\bcvss\b/, /zero[- ]day/]],
  ['patching', [/patch(?:ing|es| management)/, /security update/, /end[- ]of[- ](?:life|support)/]],
  ['pentest', [/penetration test/, /red team/, /threat[- ]led penetration/, /\btlpt\b/]],
  ['malware', [/malware/, /ransomware/, /anti[- ]?virus/, /trojan/, /wiper/]],
  ['network_security', [/network security/, /firewall/, /intrusion (?:detection|prevention)/, /\bids\b|\bips\b/]],
  ['segmentation', [/segmentation/, /segregation of networks/, /network zoning/, /micro[- ]segmentation/]],
  ['web_filtering', [/web filtering/, /url filtering/, /web proxy/]],
  ['email_security', [/email (?:security|protection)/, /\bdmarc\b/, /\bspf\b/, /\bdkim\b/, /business email compromise/, /phishing/]],
  ['endpoint', [/endpoint/, /workstation/, /\bedr\b/, /user device/]],
  ['mobile', [/mobile device/, /\bmdm\b/, /smartphone/, /tablet/]],
  ['byod', [/bring your own device/, /\bbyod\b/, /personal device/]],
  ['teleworking', [/telework/, /remote work/, /work from home/, /remote access/]],
  ['cloud', [/cloud (?:service|computing|provider|adoption)/, /\biaas\b|\bpaas\b|\bsaas\b/, /hyperscaler/, /data residency/]],
  ['third_party', [/third[- ]part/, /supplier/, /vendor/, /subprocessor/]],
  ['outsourcing', [/outsourc/, /material outsourcing/]],
  ['supply_chain', [/supply chain/, /\bsbom\b/, /software bill of materials/]],
  ['physical', [/physical security/, /physical access/, /data cent(?:re|er) access/, /\bcctv\b/]],
  ['hr_security', [/background (?:check|screening)/, /pre[- ]employment/, /personnel security/, /termination of employment/]],
  ['awareness', [/security awareness/, /awareness (?:programme|program|campaign)/, /phishing simulation/]],
  ['training', [/training (?:programme|program)/, /staff training/, /competency/, /ai literacy/]],
  ['governance', [/governance/, /board (?:oversight|responsibilit)/, /steering committee/, /management body/]],
  ['roles', [/roles and responsibilit/, /accountab(?:le|ility) (?:owner|person)/, /\bciso\b/]],
  ['policy', [/\bpolic(?:y|ies)\b/, /procedure/, /standard operating/]],
  ['risk_management', [/risk (?:management|assessment|appetite|register|treatment)/, /risk[- ]based approach/]],
  ['compliance', [/compliance/, /regulatory requirement/, /enforcement action/, /\bfine\b|\bpenalt/, /self[- ]assessment/]],
  ['audit', [/\baudit\b/, /independent review/, /assurance/, /\bcertification\b/]],
  ['asset_management', [/asset (?:management|inventory|register)/, /configuration management database/, /\bcmdb\b/]],
  ['change_management', [/change management/, /change control/, /release management/]],
  ['configuration', [/(?:secure |baseline )configuration/, /hardening/, /configuration drift/, /misconfiguration/]],
  ['architecture', [/security architecture/, /zero trust/, /reference architecture/]],
  ['secure_development', [/secure (?:development|coding|sdlc)/, /\bsdlc\b/, /devsecops/, /\bsast\b|\bdast\b/]],
  ['appsec', [/application security/, /\bapi security/, /\bowasp\b/]],
  ['web_security', [/web application/, /\bwaf\b/, /cross[- ]site scripting/, /sql injection/]],
  ['secure_disposal', [/secure (?:disposal|destruction)/, /sanitis(?:ation|ing)/, /data deletion/, /right to erasure/]],
  ['media', [/removable media/, /storage media/, /\busb\b/]],
  ['ot_ics', [/operational technology/, /\bot\b network/, /industrial control/, /\bics\b/, /\bscada\b/, /safety instrumented/]],
  ['payments', [/payment (?:system|card|service)/, /cardholder data/, /\bpci\b/, /\bswift\b/, /\biban\b/]],
  ['privacy', [/personal data/, /\bpii\b/, /privacy/, /data subject/, /\bgdpr\b|\bpdpl\b/]],
  ['consent', [/\bconsent\b/, /lawful basis/, /legitimate interest/, /opt[- ]in/]],
  ['data_subject_rights', [/data subject (?:right|request)/, /right of access/, /right to (?:erasure|rectification|portability)/, /\bdsar\b/]],
  ['breach_notification', [/breach notification/, /notify (?:the )?(?:regulator|authority|supervisory)/, /\b72[- ]hours?\b/, /\b24[- ]hours?\b/, /incident reporting/]],
  ['cross_border_transfer', [/cross[- ]border (?:transfer|data)/, /international transfer/, /data localis(?:ation|ing)/, /transfer outside the/, /adequacy decision/, /standard contractual clause/]],
  ['dpia', [/data protection impact assessment/, /\bdpia\b/, /privacy impact assessment/, /fundamental rights impact assessment/, /\bfria\b/]],
  ['dpo', [/data protection officer/, /\bdpo\b/, /privacy officer/]],
  ['records_of_processing', [/record of processing/, /records of processing/, /\bropa\b/, /processing inventory/, /register of information/]],
  ['ai_governance', [/\bai\b (?:governance|system|model)/, /artificial intelligence/, /machine learning/, /\bai act\b/, /algorithm(?:ic)? (?:governance|accountability)/]],
  ['ai_transparency', [/ai transparency/, /disclose (?:the use of )?ai/, /inform(?:ing)? users that/, /synthetic content/, /watermark/]],
  ['ai_risk_assessment', [/ai risk (?:assessment|management)/, /model risk/, /conformity assessment/, /high[- ]risk ai/]],
  ['human_oversight', [/human oversight/, /human[- ]in[- ]the[- ]loop/, /human review/, /meaningful human/, /automated decision/]],
  ['bias_fairness', [/\bbias\b/, /discriminat/, /fairness/, /protected (?:group|characteristic)/, /disparate impact/]],
  ['explainability', [/explainab/, /interpretab/, /\bxai\b/, /explanation of the decision/]],
  ['deepfake', [/deepfake/, /synthetic media/, /voice clon/, /face swap/]],
  ['gpai', [/general[- ]purpose ai/, /\bgpai\b/, /foundation model/, /frontier model/, /large language model/, /\bllm\b/]],
]

/**
 * Derives topics from free text. Deliberately generous: a false positive costs a
 * slightly wider correlation, whereas a false negative means the tenant is never
 * told about a change that affects them.
 */
export function extractTopics(...texts: Array<string | null | undefined>): Topic[] {
  const haystack = texts
    .filter((t): t is string => typeof t === 'string' && t.length > 0)
    .join('\n')
    .toLowerCase()

  if (!haystack) return []

  const found = new Set<Topic>()
  for (const [topic, patterns] of TOPIC_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(haystack))) {
      found.add(topic)
    }
  }
  return [...found]
}

/**
 * Regulator and framework mentions, used to decide which frameworks a document
 * touches when the model does not say, or to sanity-check what it did say.
 */
const FRAMEWORK_PATTERNS: ReadonlyArray<readonly [string, readonly RegExp[]]> = [
  ['NCA-ECC', [/essential cybersecurity controls/, /\becc-?\d?\b/, /\bnca\b/]],
  ['NCA-CCC', [/cloud cybersecurity controls/, /\bccc-1\b/]],
  ['NCA-DCC', [/data cybersecurity controls/, /\bdcc-1\b/]],
  ['NCA-OTCC', [/operational technology cybersecurity controls/, /\botcc\b/]],
  ['NCA-CSCC', [/critical systems cybersecurity controls/, /\bcscc\b/]],
  ['NCA-TCC', [/telework cybersecurity controls/, /\btcc-1\b/]],
  ['SAMA-CSF', [/\bsama\b/, /saudi central bank/, /saudi arabian monetary/]],
  ['SA-PDPL', [/personal data protection law/, /\bpdpl\b/, /\bsdaia\b/]],
  ['SDAIA-AI-ETHICS', [/ai ethics principles/, /sdaia ai/]],
  ['SDAIA-GENAI', [/generative ai guidelines/]],
  ['QA-NIA', [/national information assurance/, /\bncsa\b/]],
  ['QCB-TRC', [/qatar central bank/, /\bqcb\b/]],
  ['QA-PDPPL', [/personal data privacy protection law/, /\bpdppl\b/]],
  ['AE-IA', [/information assurance regulation/, /\btdra\b/, /uae cybersecurity council/]],
  ['AE-PDPL', [/federal decree[- ]law no\.? 45/]],
  ['AE-DIFC-DPL', [/\bdifc\b/]],
  ['AE-ADGM-DPR', [/\badgm\b/]],
  ['CBUAE-ISS', [/central bank of the uae/, /\bcbuae\b/]],
  ['AE-DESC-DCS', [/dubai (?:cyber security standard|electronic security)/, /\bdesc\b/]],
  ['CBJ-CSF', [/central bank of jordan/, /\bcbj\b/]],
  ['JO-PDPL', [/law no\.? 24 of 2023/]],
  ['JO-NCSF', [/jordan.{0,30}cyber/, /\bncsc\b/]],
  ['KW-CITRA-CSF', [/\bcitra\b/]],
  ['CBB-OM5', [/central bank of bahrain/, /\bcbb\b/]],
  ['BH-PDPL', [/law no\.? 30 of 2018/]],
  ['OM-PDPL', [/royal decree 6\/2022/]],
  ['ISO-27001', [/iso\/?iec ?27001/, /\bisms\b/]],
  ['ISO-27701', [/iso\/?iec ?27701/]],
  ['ISO-42001', [/iso\/?iec ?42001/]],
  ['ISO-22301', [/iso ?22301/]],
  ['NIST-CSF', [/nist (?:cybersecurity framework|csf)/]],
  ['NIST-AI-RMF', [/ai risk management framework/, /nist ai/]],
  ['PCI-DSS', [/\bpci ?dss\b/, /payment card industry/]],
  ['SOC2', [/\bsoc ?2\b/, /trust services criteria/]],
  ['EU-GDPR', [/\bgdpr\b/, /regulation \(eu\) 2016\/679/]],
  ['EU-AI-ACT', [/\bai act\b/, /regulation \(eu\) 2024\/1689/]],
  ['EU-DORA', [/\bdora\b/, /digital operational resilience/]],
  ['EU-NIS2', [/\bnis ?2\b/, /directive \(eu\) 2022\/2555/]],
]

export function extractFrameworkCodes(
  ...texts: Array<string | null | undefined>
): string[] {
  const haystack = texts
    .filter((t): t is string => typeof t === 'string' && t.length > 0)
    .join('\n')
    .toLowerCase()

  if (!haystack) return []

  const found = new Set<string>()
  for (const [code, patterns] of FRAMEWORK_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(haystack))) {
      found.add(code)
    }
  }
  return [...found]
}

/** Jurisdictions inferred from text, as ISO 3166-1 alpha-2 or a bloc code. */
const COUNTRY_PATTERNS: ReadonlyArray<readonly [string, readonly RegExp[]]> = [
  ['SA', [/saudi/, /\bksa\b/, /riyadh/, /\bsama\b/, /\bnca\b/, /\bsdaia\b/]],
  ['QA', [/qatar/, /doha/, /\bqcb\b/, /\bncsa\b/]],
  ['AE', [/\buae\b/, /united arab emirates/, /dubai/, /abu dhabi/, /\btdra\b/, /\bcbuae\b/]],
  ['JO', [/jordan/, /amman/, /\bcbj\b/]],
  ['KW', [/kuwait/, /\bcitra\b/, /\bcbk\b/]],
  ['BH', [/bahrain/, /manama/, /\bcbb\b/]],
  ['OM', [/\boman\b/, /muscat/, /\bcbo\b/]],
  ['EU', [/european union/, /\beu\b/, /european commission/, /\bedpb\b/, /\benisa\b/]],
  ['GLOBAL', [/\biso\/?iec\b/, /\bnist\b/, /\bpci ?dss\b/]],
]

export function extractCountries(
  ...texts: Array<string | null | undefined>
): string[] {
  const haystack = texts
    .filter((t): t is string => typeof t === 'string' && t.length > 0)
    .join('\n')
    .toLowerCase()

  if (!haystack) return []

  const found = new Set<string>()
  for (const [code, patterns] of COUNTRY_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(haystack))) {
      found.add(code)
    }
  }
  return [...found]
}
