'use client'

import { createAiSystem } from '@/lib/actions/grc'
import { Label } from '@/components/ui/label'
import {
  AddRecordForm,
  CheckboxField,
  fieldClass,
  textareaClass,
} from '@/components/registers/add-record-form'

export function AddAiSystemForm() {
  return (
    <AddRecordForm
      action={createAiSystem}
      initialState={{}}
      label="Add AI system"
      title="Add an AI system"
      description="The classification is driven by the purpose and the flags below, so describe the system as it actually operates rather than as intended."
      submitLabel="Add and classify"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ai-name">Name</Label>
          <input
            id="ai-name"
            name="name"
            required
            minLength={2}
            placeholder="e.g. Talent Screener"
            className={fieldClass}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ai-provider">Model provider</Label>
          <input
            id="ai-provider"
            name="modelProvider"
            placeholder="e.g. In-house, OpenAI, Anthropic"
            className={fieldClass}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ai-purpose">Purpose</Label>
        <textarea
          id="ai-purpose"
          name="purpose"
          rows={2}
          required
          minLength={10}
          placeholder="e.g. Screens CVs and ranks candidates for open vacancies in the recruitment portal."
          className={textareaClass}
        />
        <p className="text-xs text-muted-foreground">
          Be specific. A vague purpose produces the wrong tier, and the tier decides
          which obligations apply.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="ai-stage">Lifecycle stage</Label>
          <select id="ai-stage" name="lifecycleStage" defaultValue="design" className={fieldClass}>
            <option value="design">Design</option>
            <option value="development">Development</option>
            <option value="testing">Testing</option>
            <option value="pilot">Pilot</option>
            <option value="production">Production</option>
            <option value="monitoring">Monitoring</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ai-role">Your role</Label>
          <select id="ai-role" name="role" defaultValue="deployer" className={fieldClass}>
            <option value="deployer">Deployer</option>
            <option value="provider">Provider</option>
            <option value="importer">Importer</option>
            <option value="distributor">Distributor</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ai-context">Deployment context</Label>
          <input
            id="ai-context"
            name="deploymentContext"
            placeholder="e.g. HR recruitment portal"
            className={fieldClass}
          />
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium">Characteristics</legend>
        <p className="text-xs text-muted-foreground">
          These flags feed the classifier directly. Each one can move the system into a
          higher tier.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <CheckboxField
            name="human_in_the_loop"
            label="Human in the loop"
            hint="A person can review or override the output before it takes effect."
            defaultChecked
          />
          <CheckboxField
            name="eu_market_exposure"
            label="EU market exposure"
            hint="Placed on the EU market, or its output is used in the EU."
          />
          <CheckboxField
            name="is_generative"
            label="Generates content"
            hint="Produces text, images, audio or video."
          />
          <CheckboxField
            name="is_general_purpose"
            label="General-purpose model"
            hint="A foundation model rather than a task-specific system."
          />
          <CheckboxField name="processes_personal_data" label="Processes personal data" />
          <CheckboxField
            name="processes_special_category"
            label="Processes special category data"
            hint="Health, biometrics, beliefs, or similar."
          />
          <CheckboxField name="processes_biometric_data" label="Processes biometric data" />
          <CheckboxField
            name="makes_automated_decisions"
            label="Makes automated decisions"
            hint="Produces a decision affecting a person without human input."
          />
          <CheckboxField name="affects_legal_rights" label="Affects legal rights" />
          <CheckboxField name="publicly_accessible" label="Publicly accessible" />
          <CheckboxField
            name="used_in_critical_infrastructure"
            label="Used in critical infrastructure"
          />
        </div>
      </fieldset>
    </AddRecordForm>
  )
}
