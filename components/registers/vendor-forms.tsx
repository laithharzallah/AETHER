'use client'

import { useActionState } from 'react'
import { Loader2 } from 'lucide-react'
import { createVendor, updateVendorAssessment, type GrcActionState } from '@/lib/actions/grc'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  AddRecordForm,
  CheckboxField,
  fieldClass,
} from '@/components/registers/add-record-form'

export function AddVendorForm() {
  return (
    <AddRecordForm
      action={createVendor}
      initialState={{}}
      label="Add third party"
      title="Add a third party"
      description="Criticality drives how deep the due diligence has to go and how often the relationship is reviewed, so set it honestly."
      submitLabel="Add"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="vendor-name">Name</Label>
          <input
            id="vendor-name"
            name="name"
            required
            minLength={2}
            placeholder="e.g. Regional Cloud Provider"
            className={fieldClass}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vendor-category">Category</Label>
          <input
            id="vendor-category"
            name="category"
            placeholder="e.g. Infrastructure, Payroll, Managed SOC"
            className={fieldClass}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vendor-criticality">Criticality</Label>
          <select
            id="vendor-criticality"
            name="criticality"
            defaultValue="medium"
            className={fieldClass}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vendor-country">Country</Label>
          <input
            id="vendor-country"
            name="country"
            placeholder="e.g. SA"
            className={fieldClass}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="vendor-residency">Data residency</Label>
          <input
            id="vendor-residency"
            name="dataResidency"
            placeholder="e.g. Data remains in-Kingdom (Riyadh region)"
            className={fieldClass}
          />
          <p className="text-xs text-muted-foreground">
            Where the data physically sits, which is what the cross-border transfer rules
            turn on.
          </p>
        </div>
      </div>

      <CheckboxField
        name="isCloudProvider"
        label="Cloud service provider"
        hint="Engages the shared-responsibility obligations in NCA CCC and ISO 27001 A.5.23."
      />
    </AddRecordForm>
  )
}

export function VendorAssessment({
  vendorId,
  assessmentStatus,
  residualRisk,
}: {
  vendorId: string
  assessmentStatus: string
  residualRisk: string | null
}) {
  const [state, action, pending] = useActionState<GrcActionState, FormData>(
    updateVendorAssessment,
    {}
  )

  return (
    <form action={action} className="flex flex-col items-start gap-2 sm:items-end">
      <input type="hidden" name="vendorId" value={vendorId} />

      <div className="flex flex-wrap gap-2">
        <select
          name="assessmentStatus"
          defaultValue={assessmentStatus}
          aria-label="Assessment status"
          className="flex h-8 rounded-lg border border-input bg-transparent px-2 text-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          <option value="not_started">Not started</option>
          <option value="questionnaire_sent">Questionnaire sent</option>
          <option value="under_review">Under review</option>
          <option value="approved">Approved</option>
          <option value="approved_with_conditions">Approved with conditions</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
        </select>

        <select
          name="residualRisk"
          defaultValue={residualRisk ?? ''}
          aria-label="Residual risk"
          className="flex h-8 rounded-lg border border-input bg-transparent px-2 text-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          <option value="">Residual: not set</option>
          <option value="low">Residual: low</option>
          <option value="medium">Residual: medium</option>
          <option value="high">Residual: high</option>
          <option value="critical">Residual: critical</option>
        </select>

        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Save
        </Button>
      </div>

      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-xs text-emerald-600 dark:text-emerald-400">
          {state.success}
        </p>
      )}
    </form>
  )
}
