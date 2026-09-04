export type ImplementationStatus =
  | 'not_started'
  | 'in_progress'
  | 'implemented'
  | 'not_applicable'

export type ProgramStatus = 'active' | 'paused' | 'completed' | 'archived'

export const IMPLEMENTATION_STATUSES: {
  value: ImplementationStatus
  label: string
}[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'implemented', label: 'Implemented' },
  { value: 'not_applicable', label: 'Not applicable' },
]

export const PROGRAM_STATUSES: { value: ProgramStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
]
