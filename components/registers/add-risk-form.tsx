'use client'

import { createRisk } from '@/lib/actions/grc'
import { Label } from '@/components/ui/label'
import {
  AddRecordForm,
  fieldClass,
  textareaClass,
} from '@/components/registers/add-record-form'

export type RiskCategoryOption = {
  code: string
  name: string
  category: string
  default_likelihood: number | null
  default_impact: number | null
}

const SCALE = [1, 2, 3, 4, 5]

export function AddRiskForm({ categories }: { categories: RiskCategoryOption[] }) {
  return (
    <AddRecordForm
      action={createRisk}
      initialState={{}}
      label="Log a risk"
      title="Log a risk"
      description="Scored on inherent likelihood and impact first. Residual scoring comes after a treatment is in place, so the register shows what the controls are actually buying you."
      submitLabel="Add to register"
    >
      <div className="space-y-1.5">
        <Label htmlFor="risk-title">Title</Label>
        <input
          id="risk-title"
          name="title"
          required
          minLength={3}
          placeholder="e.g. Unpatched internet-facing VPN appliance"
          className={fieldClass}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="risk-category">Category</Label>
        <select id="risk-category" name="category" required className={fieldClass}>
          <option value="">Select a category…</option>
          {categories.map((category) => (
            <option key={category.code} value={category.code}>
              {category.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Drawn from the shared taxonomy, so risks raised by hand and risks raised from a
          regulatory signal reconcile against each other.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="risk-description">Description</Label>
        <textarea
          id="risk-description"
          name="description"
          rows={2}
          placeholder="What could happen, to what, and why it matters."
          className={textareaClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="risk-likelihood">Inherent likelihood</Label>
          <select
            id="risk-likelihood"
            name="inherentLikelihood"
            defaultValue="3"
            className={fieldClass}
          >
            {SCALE.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="risk-impact">Inherent impact</Label>
          <select
            id="risk-impact"
            name="inherentImpact"
            defaultValue="3"
            className={fieldClass}
          >
            {SCALE.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Inherent means before any control is applied. Scoring the post-control position
        here is the most common way a register understates exposure.
      </p>
    </AddRecordForm>
  )
}
