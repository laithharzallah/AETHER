export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_actions: {
        Row: {
          created_at: string
          description: string
          due_date: string | null
          evidence_id: string | null
          extension_count: number
          id: string
          implemented_at: string | null
          observation_id: string
          organization_id: string
          owner_id: string | null
          revised_due_date: string | null
          status: string
          updated_at: string
          verification_notes: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          description: string
          due_date?: string | null
          evidence_id?: string | null
          extension_count?: number
          id?: string
          implemented_at?: string | null
          observation_id: string
          organization_id: string
          owner_id?: string | null
          revised_due_date?: string | null
          status?: string
          updated_at?: string
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          due_date?: string | null
          evidence_id?: string | null
          extension_count?: number
          id?: string
          implemented_at?: string | null
          observation_id?: string
          organization_id?: string
          owner_id?: string | null
          revised_due_date?: string | null
          status?: string
          updated_at?: string
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_actions_evidence_id_fkey"
            columns: ["evidence_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_actions_observation_id_fkey"
            columns: ["observation_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "audit_observations"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_actions_owner_id_fkey"
            columns: ["owner_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_actions_verified_by_fkey"
            columns: ["verified_by", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      audit_engagements: {
        Row: {
          actual_days: number | null
          auditee_owner_id: string | null
          budget_days: number | null
          closed_at: string | null
          code: string
          created_at: string
          criteria: string | null
          executive_summary: string | null
          fieldwork_end: string | null
          fieldwork_start: string | null
          id: string
          lead_auditor_id: string | null
          objective: string | null
          opinion: string | null
          organization_id: string
          out_of_scope: string | null
          overall_rating: string | null
          plan_item_id: string | null
          report_issued_at: string | null
          report_target_date: string | null
          scope: string | null
          start_date: string | null
          status: string
          team: Json
          title: string
          type: string
          universe_id: string | null
          updated_at: string
        }
        Insert: {
          actual_days?: number | null
          auditee_owner_id?: string | null
          budget_days?: number | null
          closed_at?: string | null
          code: string
          created_at?: string
          criteria?: string | null
          executive_summary?: string | null
          fieldwork_end?: string | null
          fieldwork_start?: string | null
          id?: string
          lead_auditor_id?: string | null
          objective?: string | null
          opinion?: string | null
          organization_id: string
          out_of_scope?: string | null
          overall_rating?: string | null
          plan_item_id?: string | null
          report_issued_at?: string | null
          report_target_date?: string | null
          scope?: string | null
          start_date?: string | null
          status?: string
          team?: Json
          title: string
          type?: string
          universe_id?: string | null
          updated_at?: string
        }
        Update: {
          actual_days?: number | null
          auditee_owner_id?: string | null
          budget_days?: number | null
          closed_at?: string | null
          code?: string
          created_at?: string
          criteria?: string | null
          executive_summary?: string | null
          fieldwork_end?: string | null
          fieldwork_start?: string | null
          id?: string
          lead_auditor_id?: string | null
          objective?: string | null
          opinion?: string | null
          organization_id?: string
          out_of_scope?: string | null
          overall_rating?: string | null
          plan_item_id?: string | null
          report_issued_at?: string | null
          report_target_date?: string | null
          scope?: string | null
          start_date?: string | null
          status?: string
          team?: Json
          title?: string
          type?: string
          universe_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_engagements_auditee_owner_id_fkey"
            columns: ["auditee_owner_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_engagements_lead_auditor_id_fkey"
            columns: ["lead_auditor_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_engagements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_engagements_plan_item_id_fkey"
            columns: ["plan_item_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "audit_plan_items"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_engagements_universe_id_fkey"
            columns: ["universe_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "audit_universe"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_engagements_universe_id_fkey"
            columns: ["universe_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "audit_universe_scored"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      audit_observations: {
        Row: {
          agreed: boolean | null
          category: string
          cause: string | null
          closed_at: string | null
          condition: string | null
          created_at: string
          criteria: string | null
          effect: string | null
          engagement_id: string
          icfr_control_id: string | null
          id: string
          issued_at: string | null
          library_control_id: string | null
          management_response: string | null
          organization_id: string
          rating: string
          recommendation: string | null
          ref: string
          repeat_finding: boolean
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          agreed?: boolean | null
          category?: string
          cause?: string | null
          closed_at?: string | null
          condition?: string | null
          created_at?: string
          criteria?: string | null
          effect?: string | null
          engagement_id: string
          icfr_control_id?: string | null
          id?: string
          issued_at?: string | null
          library_control_id?: string | null
          management_response?: string | null
          organization_id: string
          rating?: string
          recommendation?: string | null
          ref: string
          repeat_finding?: boolean
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          agreed?: boolean | null
          category?: string
          cause?: string | null
          closed_at?: string | null
          condition?: string | null
          created_at?: string
          criteria?: string | null
          effect?: string | null
          engagement_id?: string
          icfr_control_id?: string | null
          id?: string
          issued_at?: string | null
          library_control_id?: string | null
          management_response?: string | null
          organization_id?: string
          rating?: string
          recommendation?: string | null
          ref?: string
          repeat_finding?: boolean
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_observations_engagement_id_fkey"
            columns: ["engagement_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "audit_engagement_summary"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_observations_engagement_id_fkey"
            columns: ["engagement_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "audit_engagements"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_observations_icfr_control_id_fkey"
            columns: ["icfr_control_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "icfr_controls"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_observations_library_control_id_fkey"
            columns: ["library_control_id"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_observations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_plan_items: {
        Row: {
          created_at: string
          engagement_id: string | null
          id: string
          organization_id: string
          plan_id: string
          planned_days: number
          priority: string
          quarter: string
          rationale: string | null
          sort_order: number
          status: string
          title: string | null
          universe_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          engagement_id?: string | null
          id?: string
          organization_id: string
          plan_id: string
          planned_days?: number
          priority?: string
          quarter?: string
          rationale?: string | null
          sort_order?: number
          status?: string
          title?: string | null
          universe_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          engagement_id?: string | null
          id?: string
          organization_id?: string
          plan_id?: string
          planned_days?: number
          priority?: string
          quarter?: string
          rationale?: string | null
          sort_order?: number
          status?: string
          title?: string | null
          universe_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_plan_items_engagement_id_fkey"
            columns: ["engagement_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "audit_engagement_summary"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_plan_items_engagement_id_fkey"
            columns: ["engagement_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "audit_engagements"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_plan_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_plan_items_plan_id_fkey"
            columns: ["plan_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "audit_plans"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_plan_items_universe_id_fkey"
            columns: ["universe_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "audit_universe"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_plan_items_universe_id_fkey"
            columns: ["universe_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "audit_universe_scored"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      audit_plans: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          period: string
          status: string
          total_capacity_days: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          period: string
          status?: string
          total_capacity_days?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          period?: string
          status?: string
          total_capacity_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_plans_approved_by_fkey"
            columns: ["approved_by", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_procedures: {
        Row: {
          area: string | null
          assigned_to: string | null
          conclusion: string | null
          control_ref: string | null
          created_at: string
          engagement_id: string
          hours: number | null
          id: string
          objective: string | null
          organization_id: string
          procedure: string
          ref: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          area?: string | null
          assigned_to?: string | null
          conclusion?: string | null
          control_ref?: string | null
          created_at?: string
          engagement_id: string
          hours?: number | null
          id?: string
          objective?: string | null
          organization_id: string
          procedure: string
          ref: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          area?: string | null
          assigned_to?: string | null
          conclusion?: string | null
          control_ref?: string | null
          created_at?: string
          engagement_id?: string
          hours?: number | null
          id?: string
          objective?: string | null
          organization_id?: string
          procedure?: string
          ref?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_procedures_assigned_to_fkey"
            columns: ["assigned_to", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_procedures_engagement_id_fkey"
            columns: ["engagement_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "audit_engagement_summary"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_procedures_engagement_id_fkey"
            columns: ["engagement_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "audit_engagements"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_procedures_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_program_template_steps: {
        Row: {
          area: string | null
          control_hint: string | null
          evidence: string | null
          id: string
          objective: string
          procedure: string
          ref: string
          sort_order: number
          template_id: string
        }
        Insert: {
          area?: string | null
          control_hint?: string | null
          evidence?: string | null
          id?: string
          objective: string
          procedure: string
          ref: string
          sort_order?: number
          template_id: string
        }
        Update: {
          area?: string | null
          control_hint?: string | null
          evidence?: string | null
          id?: string
          objective?: string
          procedure?: string
          ref?: string
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_program_template_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "audit_program_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_program_templates: {
        Row: {
          area: string
          code: string
          created_at: string
          description: string | null
          frameworks: string[]
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          area: string
          code: string
          created_at?: string
          description?: string | null
          frameworks?: string[]
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          area?: string
          code?: string
          created_at?: string
          description?: string | null
          frameworks?: string[]
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      audit_universe: {
        Row: {
          audit_frequency_months: number
          change_velocity: number
          code: string
          control_environment: number
          created_at: string
          description: string | null
          financial_materiality: number
          id: string
          inherent_risk: number
          last_audited_at: string | null
          name: string
          organization_id: string
          owner_id: string | null
          parent_id: string | null
          prior_findings: number
          regulatory_exposure: number
          risk_score: number | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          audit_frequency_months?: number
          change_velocity?: number
          code: string
          control_environment?: number
          created_at?: string
          description?: string | null
          financial_materiality?: number
          id?: string
          inherent_risk?: number
          last_audited_at?: string | null
          name: string
          organization_id: string
          owner_id?: string | null
          parent_id?: string | null
          prior_findings?: number
          regulatory_exposure?: number
          risk_score?: number | null
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          audit_frequency_months?: number
          change_velocity?: number
          code?: string
          control_environment?: number
          created_at?: string
          description?: string | null
          financial_materiality?: number
          id?: string
          inherent_risk?: number
          last_audited_at?: string | null
          name?: string
          organization_id?: string
          owner_id?: string | null
          parent_id?: string | null
          prior_findings?: number
          regulatory_exposure?: number
          risk_score?: number | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_universe_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_universe_owner_id_fkey"
            columns: ["owner_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_universe_parent_id_fkey"
            columns: ["parent_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "audit_universe"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_universe_parent_id_fkey"
            columns: ["parent_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "audit_universe_scored"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      audit_workpapers: {
        Row: {
          created_at: string
          description: string | null
          engagement_id: string
          evidence_id: string | null
          id: string
          kind: string
          organization_id: string
          prepared_at: string | null
          prepared_by: string | null
          procedure_id: string | null
          ref: string
          review_notes: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          engagement_id: string
          evidence_id?: string | null
          id?: string
          kind?: string
          organization_id: string
          prepared_at?: string | null
          prepared_by?: string | null
          procedure_id?: string | null
          ref: string
          review_notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          engagement_id?: string
          evidence_id?: string | null
          id?: string
          kind?: string
          organization_id?: string
          prepared_at?: string | null
          prepared_by?: string | null
          procedure_id?: string | null
          ref?: string
          review_notes?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_workpapers_engagement_id_fkey"
            columns: ["engagement_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "audit_engagement_summary"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_workpapers_engagement_id_fkey"
            columns: ["engagement_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "audit_engagements"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_workpapers_evidence_id_fkey"
            columns: ["evidence_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_workpapers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_workpapers_prepared_by_fkey"
            columns: ["prepared_by", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_workpapers_procedure_id_fkey"
            columns: ["procedure_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "audit_procedures"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_workpapers_reviewed_by_fkey"
            columns: ["reviewed_by", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      briefs: {
        Row: {
          client_workspace_id: string | null
          content: Json | null
          created_at: string | null
          id: string
          organization_id: string
          period_end: string | null
          period_start: string | null
          sent_at: string | null
          status: string | null
          title: string
        }
        Insert: {
          client_workspace_id?: string | null
          content?: Json | null
          created_at?: string | null
          id?: string
          organization_id: string
          period_end?: string | null
          period_start?: string | null
          sent_at?: string | null
          status?: string | null
          title: string
        }
        Update: {
          client_workspace_id?: string | null
          content?: Json | null
          created_at?: string | null
          id?: string
          organization_id?: string
          period_end?: string | null
          period_start?: string | null
          sent_at?: string | null
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "briefs_client_workspace_id_fkey"
            columns: ["client_workspace_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "client_workspaces"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "briefs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_workspaces: {
        Row: {
          applicable_frameworks: string[] | null
          country: string | null
          created_at: string | null
          id: string
          industry: string | null
          name: string
          organization_id: string
          risk_profile: Json | null
          updated_at: string | null
        }
        Insert: {
          applicable_frameworks?: string[] | null
          country?: string | null
          created_at?: string | null
          id?: string
          industry?: string | null
          name: string
          organization_id: string
          risk_profile?: Json | null
          updated_at?: string | null
        }
        Update: {
          applicable_frameworks?: string[] | null
          country?: string | null
          created_at?: string | null
          id?: string
          industry?: string | null
          name?: string
          organization_id?: string
          risk_profile?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_workspaces_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      control_implementations: {
        Row: {
          control_id: string
          created_at: string
          due_date: string | null
          id: string
          last_reviewed_at: string | null
          na_justification: string | null
          notes: string | null
          owner_id: string | null
          program_id: string
          status: string
          updated_at: string
        }
        Insert: {
          control_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          last_reviewed_at?: string | null
          na_justification?: string | null
          notes?: string | null
          owner_id?: string | null
          program_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          control_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          last_reviewed_at?: string | null
          na_justification?: string | null
          notes?: string | null
          owner_id?: string | null
          program_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "control_implementations_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_implementations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_implementations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "program_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "control_implementations_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      controls: {
        Row: {
          control_ref: string
          control_type: string | null
          created_at: string
          criticality: string | null
          domain_ar: string | null
          domain_en: string | null
          evidence_en: string | null
          fidelity: string
          framework_id: string
          id: string
          requirement_ar: string | null
          requirement_en: string
          search_text: string | null
          sort_order: number
          subdomain_ar: string | null
          subdomain_en: string | null
          title_ar: string | null
          title_en: string
          updated_at: string
          verified: boolean
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          control_ref: string
          control_type?: string | null
          created_at?: string
          criticality?: string | null
          domain_ar?: string | null
          domain_en?: string | null
          evidence_en?: string | null
          fidelity?: string
          framework_id: string
          id?: string
          requirement_ar?: string | null
          requirement_en: string
          search_text?: string | null
          sort_order?: number
          subdomain_ar?: string | null
          subdomain_en?: string | null
          title_ar?: string | null
          title_en: string
          updated_at?: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          control_ref?: string
          control_type?: string | null
          created_at?: string
          criticality?: string | null
          domain_ar?: string | null
          domain_en?: string | null
          evidence_en?: string | null
          fidelity?: string
          framework_id?: string
          id?: string
          requirement_ar?: string | null
          requirement_en?: string
          search_text?: string | null
          sort_order?: number
          subdomain_ar?: string | null
          subdomain_en?: string | null
          title_ar?: string | null
          title_en?: string
          updated_at?: string
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "controls_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "framework_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controls_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "frameworks"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      erm_appetite: {
        Row: {
          appetite_level: string
          approved_at: string | null
          approved_by: string | null
          category_id: string | null
          created_at: string
          id: string
          organization_id: string
          review_date: string | null
          statement_ar: string | null
          statement_en: string
          tolerance_threshold: number
          updated_at: string
        }
        Insert: {
          appetite_level?: string
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          organization_id: string
          review_date?: string | null
          statement_ar?: string | null
          statement_en: string
          tolerance_threshold?: number
          updated_at?: string
        }
        Update: {
          appetite_level?: string
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          review_date?: string | null
          statement_ar?: string | null
          statement_en?: string
          tolerance_threshold?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "erm_appetite_approved_by_fkey"
            columns: ["approved_by", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "erm_appetite_category_id_fkey"
            columns: ["category_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "erm_categories"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "erm_appetite_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      erm_assessments: {
        Row: {
          assessed_at: string
          assessed_by: string | null
          created_at: string
          id: string
          inherent_i: number | null
          inherent_l: number | null
          organization_id: string
          rationale: string | null
          residual_i: number | null
          residual_l: number | null
          risk_id: string
        }
        Insert: {
          assessed_at?: string
          assessed_by?: string | null
          created_at?: string
          id?: string
          inherent_i?: number | null
          inherent_l?: number | null
          organization_id: string
          rationale?: string | null
          residual_i?: number | null
          residual_l?: number | null
          risk_id: string
        }
        Update: {
          assessed_at?: string
          assessed_by?: string | null
          created_at?: string
          id?: string
          inherent_i?: number | null
          inherent_l?: number | null
          organization_id?: string
          rationale?: string | null
          residual_i?: number | null
          residual_l?: number | null
          risk_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "erm_assessments_assessed_by_fkey"
            columns: ["assessed_by", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "erm_assessments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erm_assessments_risk_id_fkey"
            columns: ["risk_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "erm_risk_summary"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "erm_assessments_risk_id_fkey"
            columns: ["risk_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "erm_risks"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      erm_categories: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          level: number
          name_ar: string | null
          name_en: string
          organization_id: string
          parent_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          level?: number
          name_ar?: string | null
          name_en: string
          organization_id: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          level?: number
          name_ar?: string | null
          name_en?: string
          organization_id?: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "erm_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erm_categories_parent_id_fkey"
            columns: ["parent_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "erm_categories"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      erm_kri_readings: {
        Row: {
          created_at: string
          id: string
          kri_id: string
          note: string | null
          organization_id: string
          period_date: string
          recorded_by: string | null
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          kri_id: string
          note?: string | null
          organization_id: string
          period_date: string
          recorded_by?: string | null
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          kri_id?: string
          note?: string | null
          organization_id?: string
          period_date?: string
          recorded_by?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "erm_kri_readings_kri_id_fkey"
            columns: ["kri_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "erm_kri_status"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "erm_kri_readings_kri_id_fkey"
            columns: ["kri_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "erm_kris"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "erm_kri_readings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erm_kri_readings_recorded_by_fkey"
            columns: ["recorded_by", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      erm_kris: {
        Row: {
          amber_threshold: number
          created_at: string
          data_source: string | null
          description: string | null
          direction: string
          frequency: string
          green_threshold: number | null
          id: string
          name: string
          organization_id: string
          owner_id: string | null
          red_threshold: number
          risk_id: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          amber_threshold: number
          created_at?: string
          data_source?: string | null
          description?: string | null
          direction?: string
          frequency?: string
          green_threshold?: number | null
          id?: string
          name: string
          organization_id: string
          owner_id?: string | null
          red_threshold: number
          risk_id: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          amber_threshold?: number
          created_at?: string
          data_source?: string | null
          description?: string | null
          direction?: string
          frequency?: string
          green_threshold?: number | null
          id?: string
          name?: string
          organization_id?: string
          owner_id?: string | null
          red_threshold?: number
          risk_id?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "erm_kris_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erm_kris_owner_id_fkey"
            columns: ["owner_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "erm_kris_risk_id_fkey"
            columns: ["risk_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "erm_risk_summary"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "erm_kris_risk_id_fkey"
            columns: ["risk_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "erm_risks"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      erm_links: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string | null
          organization_id: string
          risk_id: string
          target_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          label?: string | null
          organization_id: string
          risk_id: string
          target_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          organization_id?: string
          risk_id?: string
          target_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "erm_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erm_links_risk_id_fkey"
            columns: ["risk_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "erm_risk_summary"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "erm_links_risk_id_fkey"
            columns: ["risk_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "erm_risks"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      erm_risk_controls: {
        Row: {
          control_id: string | null
          control_type: string | null
          created_at: string
          description: string | null
          effectiveness: number | null
          icfr_control_id: string | null
          id: string
          name: string | null
          organization_id: string
          risk_id: string
          updated_at: string
        }
        Insert: {
          control_id?: string | null
          control_type?: string | null
          created_at?: string
          description?: string | null
          effectiveness?: number | null
          icfr_control_id?: string | null
          id?: string
          name?: string | null
          organization_id: string
          risk_id: string
          updated_at?: string
        }
        Update: {
          control_id?: string | null
          control_type?: string | null
          created_at?: string
          description?: string | null
          effectiveness?: number | null
          icfr_control_id?: string | null
          id?: string
          name?: string | null
          organization_id?: string
          risk_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "erm_risk_controls_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erm_risk_controls_icfr_control_id_fkey"
            columns: ["icfr_control_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "icfr_controls"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "erm_risk_controls_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erm_risk_controls_risk_id_fkey"
            columns: ["risk_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "erm_risk_summary"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "erm_risk_controls_risk_id_fkey"
            columns: ["risk_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "erm_risks"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      erm_risks: {
        Row: {
          category_id: string | null
          causes: string | null
          client_workspace_id: string | null
          code: string
          consequences: string | null
          created_at: string
          created_by: string | null
          description: string | null
          emerging: boolean
          id: string
          impact_dimensions: Json
          inherent_impact: number | null
          inherent_likelihood: number | null
          inherent_score: number | null
          last_assessed_at: string | null
          next_review_at: string | null
          organization_id: string
          owner_id: string | null
          residual_impact: number | null
          residual_likelihood: number | null
          residual_score: number | null
          source: string
          sponsor_id: string | null
          status: string
          target_impact: number | null
          target_likelihood: number | null
          target_score: number | null
          title: string
          trend: string
          updated_at: string
          velocity: number | null
        }
        Insert: {
          category_id?: string | null
          causes?: string | null
          client_workspace_id?: string | null
          code?: string
          consequences?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          emerging?: boolean
          id?: string
          impact_dimensions?: Json
          inherent_impact?: number | null
          inherent_likelihood?: number | null
          inherent_score?: number | null
          last_assessed_at?: string | null
          next_review_at?: string | null
          organization_id: string
          owner_id?: string | null
          residual_impact?: number | null
          residual_likelihood?: number | null
          residual_score?: number | null
          source?: string
          sponsor_id?: string | null
          status?: string
          target_impact?: number | null
          target_likelihood?: number | null
          target_score?: number | null
          title: string
          trend?: string
          updated_at?: string
          velocity?: number | null
        }
        Update: {
          category_id?: string | null
          causes?: string | null
          client_workspace_id?: string | null
          code?: string
          consequences?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          emerging?: boolean
          id?: string
          impact_dimensions?: Json
          inherent_impact?: number | null
          inherent_likelihood?: number | null
          inherent_score?: number | null
          last_assessed_at?: string | null
          next_review_at?: string | null
          organization_id?: string
          owner_id?: string | null
          residual_impact?: number | null
          residual_likelihood?: number | null
          residual_score?: number | null
          source?: string
          sponsor_id?: string | null
          status?: string
          target_impact?: number | null
          target_likelihood?: number | null
          target_score?: number | null
          title?: string
          trend?: string
          updated_at?: string
          velocity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "erm_risks_category_id_fkey"
            columns: ["category_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "erm_categories"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "erm_risks_client_workspace_id_fkey"
            columns: ["client_workspace_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "client_workspaces"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "erm_risks_created_by_fkey"
            columns: ["created_by", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "erm_risks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erm_risks_owner_id_fkey"
            columns: ["owner_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "erm_risks_sponsor_id_fkey"
            columns: ["sponsor_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      erm_taxonomy_templates: {
        Row: {
          code: string
          created_at: string
          description_ar: string | null
          description_en: string | null
          id: string
          name_ar: string
          name_en: string
          parent_code: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          id?: string
          name_ar: string
          name_en: string
          parent_code?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          id?: string
          name_ar?: string
          name_en?: string
          parent_code?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "erm_taxonomy_templates_parent_code_fkey"
            columns: ["parent_code"]
            isOneToOne: false
            referencedRelation: "erm_taxonomy_templates"
            referencedColumns: ["code"]
          },
        ]
      }
      erm_treatments: {
        Row: {
          completed_at: string | null
          cost_estimate: number | null
          created_at: string
          description: string | null
          due_date: string | null
          expected_residual_impact: number | null
          expected_residual_likelihood: number | null
          id: string
          organization_id: string
          owner_id: string | null
          risk_id: string
          status: string
          strategy: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          cost_estimate?: number | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          expected_residual_impact?: number | null
          expected_residual_likelihood?: number | null
          id?: string
          organization_id: string
          owner_id?: string | null
          risk_id: string
          status?: string
          strategy?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          cost_estimate?: number | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          expected_residual_impact?: number | null
          expected_residual_likelihood?: number | null
          id?: string
          organization_id?: string
          owner_id?: string | null
          risk_id?: string
          status?: string
          strategy?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "erm_treatments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erm_treatments_owner_id_fkey"
            columns: ["owner_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "erm_treatments_risk_id_fkey"
            columns: ["risk_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "erm_risk_summary"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "erm_treatments_risk_id_fkey"
            columns: ["risk_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "erm_risks"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      evidence: {
        Row: {
          created_at: string
          description: string | null
          external_url: string | null
          file_name: string | null
          id: string
          mime_type: string | null
          name: string
          organization_id: string
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          size_bytes: number | null
          source: string
          storage_path: string | null
          updated_at: string
          uploaded_by: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          external_url?: string | null
          file_name?: string | null
          id?: string
          mime_type?: string | null
          name: string
          organization_id: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes?: number | null
          source?: string
          storage_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          external_url?: string | null
          file_name?: string | null
          id?: string
          mime_type?: string | null
          name?: string
          organization_id?: string
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes?: number | null
          source?: string
          storage_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_reviewed_by_fkey"
            columns: ["reviewed_by", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "evidence_uploaded_by_fkey"
            columns: ["uploaded_by", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      evidence_links: {
        Row: {
          control_implementation_id: string
          created_at: string
          evidence_id: string
        }
        Insert: {
          control_implementation_id: string
          created_at?: string
          evidence_id: string
        }
        Update: {
          control_implementation_id?: string
          created_at?: string
          evidence_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_links_control_implementation_id_fkey"
            columns: ["control_implementation_id"]
            isOneToOne: false
            referencedRelation: "control_implementations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_links_evidence_id_fkey"
            columns: ["evidence_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id"]
          },
        ]
      }
      frameworks: {
        Row: {
          category: string
          code: string
          created_at: string
          description_ar: string | null
          description_en: string | null
          effective_date: string | null
          id: string
          jurisdiction: string
          mandatory: boolean
          name_ar: string | null
          name_en: string
          regulator_ar: string | null
          regulator_en: string
          short_name: string
          sort_order: number
          source_url: string | null
          updated_at: string
          version: string | null
        }
        Insert: {
          category: string
          code: string
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          effective_date?: string | null
          id?: string
          jurisdiction: string
          mandatory?: boolean
          name_ar?: string | null
          name_en: string
          regulator_ar?: string | null
          regulator_en: string
          short_name: string
          sort_order?: number
          source_url?: string | null
          updated_at?: string
          version?: string | null
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          effective_date?: string | null
          id?: string
          jurisdiction?: string
          mandatory?: boolean
          name_ar?: string | null
          name_en?: string
          regulator_ar?: string | null
          regulator_en?: string
          short_name?: string
          sort_order?: number
          source_url?: string | null
          updated_at?: string
          version?: string | null
        }
        Relationships: []
      }
      icfr_controls: {
        Row: {
          control_type: string
          coso_component: string
          created_at: string
          description: string | null
          evidence_description: string | null
          frequency: string
          id: string
          is_key: boolean
          level: string
          nature: string
          organization_id: string
          owner_id: string | null
          process_id: string
          ref: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          control_type: string
          coso_component?: string
          created_at?: string
          description?: string | null
          evidence_description?: string | null
          frequency: string
          id?: string
          is_key?: boolean
          level?: string
          nature: string
          organization_id: string
          owner_id?: string | null
          process_id: string
          ref: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          control_type?: string
          coso_component?: string
          created_at?: string
          description?: string | null
          evidence_description?: string | null
          frequency?: string
          id?: string
          is_key?: boolean
          level?: string
          nature?: string
          organization_id?: string
          owner_id?: string | null
          process_id?: string
          ref?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "icfr_controls_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "icfr_controls_owner_id_fkey"
            columns: ["owner_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "icfr_controls_process_id_fkey"
            columns: ["process_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "icfr_process_summary"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "icfr_controls_process_id_fkey"
            columns: ["process_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "icfr_processes"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      icfr_deficiencies: {
        Row: {
          closed_at: string | null
          control_id: string
          created_at: string
          description: string
          due_date: string | null
          id: string
          identified_at: string
          organization_id: string
          owner_id: string | null
          remediation_plan: string | null
          retest_result: string | null
          root_cause: string | null
          severity: string
          status: string
          test_id: string | null
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          control_id: string
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          identified_at?: string
          organization_id: string
          owner_id?: string | null
          remediation_plan?: string | null
          retest_result?: string | null
          root_cause?: string | null
          severity: string
          status?: string
          test_id?: string | null
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          control_id?: string
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          identified_at?: string
          organization_id?: string
          owner_id?: string | null
          remediation_plan?: string | null
          retest_result?: string | null
          root_cause?: string | null
          severity?: string
          status?: string
          test_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "icfr_deficiencies_control_id_fkey"
            columns: ["control_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "icfr_controls"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "icfr_deficiencies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "icfr_deficiencies_owner_id_fkey"
            columns: ["owner_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "icfr_deficiencies_test_id_fkey"
            columns: ["test_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "icfr_tests"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      icfr_processes: {
        Row: {
          client_workspace_id: string | null
          code: string
          created_at: string
          cycle: string | null
          description: string | null
          id: string
          name: string
          organization_id: string
          owner_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_workspace_id?: string | null
          code: string
          created_at?: string
          cycle?: string | null
          description?: string | null
          id?: string
          name: string
          organization_id: string
          owner_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_workspace_id?: string | null
          code?: string
          created_at?: string
          cycle?: string | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          owner_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "icfr_processes_client_workspace_id_fkey"
            columns: ["client_workspace_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "client_workspaces"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "icfr_processes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "icfr_processes_owner_id_fkey"
            columns: ["owner_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      icfr_risk_controls: {
        Row: {
          control_id: string
          created_at: string
          risk_id: string
        }
        Insert: {
          control_id: string
          created_at?: string
          risk_id: string
        }
        Update: {
          control_id?: string
          created_at?: string
          risk_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "icfr_risk_controls_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "icfr_controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "icfr_risk_controls_risk_id_fkey"
            columns: ["risk_id"]
            isOneToOne: false
            referencedRelation: "icfr_risks"
            referencedColumns: ["id"]
          },
        ]
      }
      icfr_risks: {
        Row: {
          assertions: string[]
          created_at: string
          description: string
          fraud_risk: boolean
          id: string
          impact: number | null
          likelihood: number | null
          organization_id: string
          process_id: string
          ref: string
          updated_at: string
        }
        Insert: {
          assertions?: string[]
          created_at?: string
          description: string
          fraud_risk?: boolean
          id?: string
          impact?: number | null
          likelihood?: number | null
          organization_id: string
          process_id: string
          ref: string
          updated_at?: string
        }
        Update: {
          assertions?: string[]
          created_at?: string
          description?: string
          fraud_risk?: boolean
          id?: string
          impact?: number | null
          likelihood?: number | null
          organization_id?: string
          process_id?: string
          ref?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "icfr_risks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "icfr_risks_process_id_fkey"
            columns: ["process_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "icfr_process_summary"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "icfr_risks_process_id_fkey"
            columns: ["process_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "icfr_processes"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      icfr_template_items: {
        Row: {
          assertions: string[] | null
          control_type: string | null
          coso_component: string | null
          description: string | null
          frequency: string | null
          id: string
          is_key: boolean | null
          kind: string
          level: string | null
          linked_risk_refs: string[] | null
          nature: string | null
          ref: string
          sort_order: number
          template_id: string
          title: string
        }
        Insert: {
          assertions?: string[] | null
          control_type?: string | null
          coso_component?: string | null
          description?: string | null
          frequency?: string | null
          id?: string
          is_key?: boolean | null
          kind: string
          level?: string | null
          linked_risk_refs?: string[] | null
          nature?: string | null
          ref: string
          sort_order?: number
          template_id: string
          title: string
        }
        Update: {
          assertions?: string[] | null
          control_type?: string | null
          coso_component?: string | null
          description?: string | null
          frequency?: string | null
          id?: string
          is_key?: boolean | null
          kind?: string
          level?: string | null
          linked_risk_refs?: string[] | null
          nature?: string | null
          ref?: string
          sort_order?: number
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "icfr_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "icfr_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      icfr_templates: {
        Row: {
          code: string
          created_at: string
          cycle: string
          description: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          cycle: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          cycle?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      icfr_tests: {
        Row: {
          control_id: string
          created_at: string
          exceptions: number
          id: string
          notes: string | null
          organization_id: string
          period: string
          population_size: number | null
          procedure: string | null
          result: string
          sample_size: number | null
          test_type: string
          tested_at: string | null
          tester_id: string | null
          updated_at: string
          workpaper_ref: string | null
        }
        Insert: {
          control_id: string
          created_at?: string
          exceptions?: number
          id?: string
          notes?: string | null
          organization_id: string
          period: string
          population_size?: number | null
          procedure?: string | null
          result?: string
          sample_size?: number | null
          test_type: string
          tested_at?: string | null
          tester_id?: string | null
          updated_at?: string
          workpaper_ref?: string | null
        }
        Update: {
          control_id?: string
          created_at?: string
          exceptions?: number
          id?: string
          notes?: string | null
          organization_id?: string
          period?: string
          population_size?: number | null
          procedure?: string | null
          result?: string
          sample_size?: number | null
          test_type?: string
          tested_at?: string | null
          tester_id?: string | null
          updated_at?: string
          workpaper_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "icfr_tests_control_id_fkey"
            columns: ["control_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "icfr_controls"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "icfr_tests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "icfr_tests_tester_id_fkey"
            columns: ["tester_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      intelligence_items: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          language: string | null
          published_at: string | null
          source_id: string | null
          status: string | null
          title: string
          url: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          language?: string | null
          published_at?: string | null
          source_id?: string | null
          status?: string | null
          title: string
          url?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          language?: string | null
          published_at?: string | null
          source_id?: string | null
          status?: string | null
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intelligence_items_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "intelligence_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      intelligence_sources: {
        Row: {
          active: boolean | null
          country: string | null
          created_at: string | null
          id: string
          last_checked_at: string | null
          name: string
          type: string
          url: string | null
        }
        Insert: {
          active?: boolean | null
          country?: string | null
          created_at?: string | null
          id?: string
          last_checked_at?: string | null
          name: string
          type: string
          url?: string | null
        }
        Update: {
          active?: boolean | null
          country?: string | null
          created_at?: string | null
          id?: string
          last_checked_at?: string | null
          name?: string
          type?: string
          url?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          citations: Json
          content: string
          conversation_id: string
          created_at: string
          id: string
          input_tokens: number | null
          model: string | null
          output_tokens: number | null
          role: string
          tool_activity: Json
        }
        Insert: {
          citations?: Json
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          role: string
          tool_activity?: Json
        }
        Update: {
          citations?: Json
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          role?: string
          tool_activity?: Json
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          slug: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          slug: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
          status?: string | null
        }
        Relationships: []
      }
      organization_modules: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          id: string
          module_id: string
          organization_id: string
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          module_id: string
          organization_id: string
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          module_id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_modules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          country: string | null
          created_at: string | null
          id: string
          industry: string | null
          name: string
          size: string | null
          slug: string
          type: string
          updated_at: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          id?: string
          industry?: string | null
          name: string
          size?: string | null
          slug: string
          type: string
          updated_at?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string | null
          id?: string
          industry?: string | null
          name?: string
          size?: string | null
          slug?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      policies: {
        Row: {
          client_workspace_id: string | null
          content_md: string
          created_at: string
          created_by: string | null
          frameworks: string[]
          id: string
          model: string | null
          org_context: string | null
          organization_id: string
          policy_type: string
          status: string
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          client_workspace_id?: string | null
          content_md: string
          created_at?: string
          created_by?: string | null
          frameworks?: string[]
          id?: string
          model?: string | null
          org_context?: string | null
          organization_id: string
          policy_type: string
          status?: string
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          client_workspace_id?: string | null
          content_md?: string
          created_at?: string
          created_by?: string | null
          frameworks?: string[]
          id?: string
          model?: string | null
          org_context?: string | null
          organization_id?: string
          policy_type?: string
          status?: string
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "policies_client_workspace_id_fkey"
            columns: ["client_workspace_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "client_workspaces"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "policies_created_by_fkey"
            columns: ["created_by", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_control_mappings: {
        Row: {
          control_id: string
          coverage: string
          created_at: string
          policy_id: string
        }
        Insert: {
          control_id: string
          coverage?: string
          created_at?: string
          policy_id: string
        }
        Update: {
          control_id?: string
          coverage?: string
          created_at?: string
          policy_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_control_mappings_control_id_fkey"
            columns: ["control_id"]
            isOneToOne: false
            referencedRelation: "controls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_control_mappings_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          organization_id: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          organization_id?: string | null
          role?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          organization_id?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          client_workspace_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          framework_id: string
          id: string
          name: string
          organization_id: string
          status: string
          target_date: string | null
          updated_at: string
        }
        Insert: {
          client_workspace_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          framework_id: string
          id?: string
          name: string
          organization_id: string
          status?: string
          target_date?: string | null
          updated_at?: string
        }
        Update: {
          client_workspace_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          framework_id?: string
          id?: string
          name?: string
          organization_id?: string
          status?: string
          target_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_client_workspace_id_fkey"
            columns: ["client_workspace_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "client_workspaces"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "programs_created_by_fkey"
            columns: ["created_by", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "programs_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "framework_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_signals: {
        Row: {
          category: string
          countries: string[] | null
          created_at: string | null
          frameworks_affected: string[] | null
          id: string
          impact_analysis: string | null
          intelligence_item_id: string | null
          recommended_action: string | null
          reviewed: boolean | null
          reviewed_at: string | null
          reviewed_by: string | null
          sectors: string[] | null
          severity: string | null
          summary: string
        }
        Insert: {
          category: string
          countries?: string[] | null
          created_at?: string | null
          frameworks_affected?: string[] | null
          id?: string
          impact_analysis?: string | null
          intelligence_item_id?: string | null
          recommended_action?: string | null
          reviewed?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sectors?: string[] | null
          severity?: string | null
          summary: string
        }
        Update: {
          category?: string
          countries?: string[] | null
          created_at?: string | null
          frameworks_affected?: string[] | null
          id?: string
          impact_analysis?: string | null
          intelligence_item_id?: string | null
          recommended_action?: string | null
          reviewed?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sectors?: string[] | null
          severity?: string | null
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_signals_intelligence_item_id_fkey"
            columns: ["intelligence_item_id"]
            isOneToOne: false
            referencedRelation: "intelligence_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_signals_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      audit_action_register: {
        Row: {
          age_days: number | null
          created_at: string | null
          days_past_due: number | null
          description: string | null
          due_date: string | null
          effective_due_date: string | null
          engagement_code: string | null
          engagement_id: string | null
          engagement_status: string | null
          engagement_title: string | null
          evidence_id: string | null
          extension_count: number | null
          id: string | null
          implemented_at: string | null
          is_overdue: boolean | null
          observation_id: string | null
          observation_rating: string | null
          observation_ref: string | null
          observation_repeat: boolean | null
          observation_status: string | null
          observation_title: string | null
          organization_id: string | null
          owner_id: string | null
          revised_due_date: string | null
          status: string | null
          updated_at: string | null
          verification_notes: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_actions_evidence_id_fkey"
            columns: ["evidence_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "evidence"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_actions_observation_id_fkey"
            columns: ["observation_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "audit_observations"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_actions_owner_id_fkey"
            columns: ["owner_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_actions_verified_by_fkey"
            columns: ["verified_by", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      audit_engagement_summary: {
        Row: {
          actual_days: number | null
          auditee_owner_id: string | null
          budget_days: number | null
          closed_at: string | null
          code: string | null
          created_at: string | null
          criteria: string | null
          executive_summary: string | null
          fieldwork_end: string | null
          fieldwork_start: string | null
          id: string | null
          lead_auditor_id: string | null
          objective: string | null
          observations_critical: number | null
          observations_draft: number | null
          observations_high: number | null
          observations_low: number | null
          observations_medium: number | null
          observations_total: number | null
          open_actions: number | null
          opinion: string | null
          organization_id: string | null
          out_of_scope: string | null
          overall_rating: string | null
          overdue_actions: number | null
          plan_item_id: string | null
          procedures_complete: number | null
          procedures_total: number | null
          report_issued_at: string | null
          report_target_date: string | null
          scope: string | null
          start_date: string | null
          status: string | null
          team: Json | null
          title: string | null
          type: string | null
          universe_code: string | null
          universe_id: string | null
          universe_name: string | null
          updated_at: string | null
          workpapers_reviewed: number | null
          workpapers_total: number | null
        }
        Insert: {
          actual_days?: number | null
          auditee_owner_id?: string | null
          budget_days?: number | null
          closed_at?: string | null
          code?: string | null
          created_at?: string | null
          criteria?: string | null
          executive_summary?: string | null
          fieldwork_end?: string | null
          fieldwork_start?: string | null
          id?: string | null
          lead_auditor_id?: string | null
          objective?: string | null
          observations_critical?: never
          observations_draft?: never
          observations_high?: never
          observations_low?: never
          observations_medium?: never
          observations_total?: never
          open_actions?: never
          opinion?: string | null
          organization_id?: string | null
          out_of_scope?: string | null
          overall_rating?: string | null
          overdue_actions?: never
          plan_item_id?: string | null
          procedures_complete?: never
          procedures_total?: never
          report_issued_at?: string | null
          report_target_date?: string | null
          scope?: string | null
          start_date?: string | null
          status?: string | null
          team?: Json | null
          title?: string | null
          type?: string | null
          universe_code?: never
          universe_id?: string | null
          universe_name?: never
          updated_at?: string | null
          workpapers_reviewed?: never
          workpapers_total?: never
        }
        Update: {
          actual_days?: number | null
          auditee_owner_id?: string | null
          budget_days?: number | null
          closed_at?: string | null
          code?: string | null
          created_at?: string | null
          criteria?: string | null
          executive_summary?: string | null
          fieldwork_end?: string | null
          fieldwork_start?: string | null
          id?: string | null
          lead_auditor_id?: string | null
          objective?: string | null
          observations_critical?: never
          observations_draft?: never
          observations_high?: never
          observations_low?: never
          observations_medium?: never
          observations_total?: never
          open_actions?: never
          opinion?: string | null
          organization_id?: string | null
          out_of_scope?: string | null
          overall_rating?: string | null
          overdue_actions?: never
          plan_item_id?: string | null
          procedures_complete?: never
          procedures_total?: never
          report_issued_at?: string | null
          report_target_date?: string | null
          scope?: string | null
          start_date?: string | null
          status?: string | null
          team?: Json | null
          title?: string | null
          type?: string | null
          universe_code?: never
          universe_id?: string | null
          universe_name?: never
          updated_at?: string | null
          workpapers_reviewed?: never
          workpapers_total?: never
        }
        Relationships: [
          {
            foreignKeyName: "audit_engagements_auditee_owner_id_fkey"
            columns: ["auditee_owner_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_engagements_lead_auditor_id_fkey"
            columns: ["lead_auditor_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_engagements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_engagements_plan_item_id_fkey"
            columns: ["plan_item_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "audit_plan_items"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_engagements_universe_id_fkey"
            columns: ["universe_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "audit_universe"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_engagements_universe_id_fkey"
            columns: ["universe_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "audit_universe_scored"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      audit_universe_scored: {
        Row: {
          audit_frequency_months: number | null
          change_velocity: number | null
          code: string | null
          control_environment: number | null
          created_at: string | null
          description: string | null
          effective_frequency_months: number | null
          engagement_count: number | null
          financial_materiality: number | null
          id: string | null
          inherent_risk: number | null
          is_due: boolean | null
          last_audited_at: string | null
          months_since_last_audit: number | null
          name: string | null
          open_observations: number | null
          organization_id: string | null
          owner_id: string | null
          parent_id: string | null
          prior_findings: number | null
          regulatory_exposure: number | null
          risk_score: number | null
          status: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          audit_frequency_months?: number | null
          change_velocity?: number | null
          code?: string | null
          control_environment?: number | null
          created_at?: string | null
          description?: string | null
          effective_frequency_months?: never
          engagement_count?: never
          financial_materiality?: number | null
          id?: string | null
          inherent_risk?: number | null
          is_due?: never
          last_audited_at?: string | null
          months_since_last_audit?: never
          name?: string | null
          open_observations?: never
          organization_id?: string | null
          owner_id?: string | null
          parent_id?: string | null
          prior_findings?: number | null
          regulatory_exposure?: number | null
          risk_score?: number | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          audit_frequency_months?: number | null
          change_velocity?: number | null
          code?: string | null
          control_environment?: number | null
          created_at?: string | null
          description?: string | null
          effective_frequency_months?: never
          engagement_count?: never
          financial_materiality?: number | null
          id?: string | null
          inherent_risk?: number | null
          is_due?: never
          last_audited_at?: string | null
          months_since_last_audit?: never
          name?: string | null
          open_observations?: never
          organization_id?: string | null
          owner_id?: string | null
          parent_id?: string | null
          prior_findings?: number | null
          regulatory_exposure?: number | null
          risk_score?: number | null
          status?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_universe_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_universe_owner_id_fkey"
            columns: ["owner_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_universe_parent_id_fkey"
            columns: ["parent_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "audit_universe"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "audit_universe_parent_id_fkey"
            columns: ["parent_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "audit_universe_scored"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      erm_heatmap: {
        Row: {
          basis: string | null
          impact: number | null
          likelihood: number | null
          organization_id: string | null
          risk_count: number | null
        }
        Relationships: []
      }
      erm_kri_status: {
        Row: {
          amber_threshold: number | null
          data_source: string | null
          direction: string | null
          frequency: string | null
          green_threshold: number | null
          id: string | null
          latest_period: string | null
          latest_value: number | null
          name: string | null
          organization_id: string | null
          owner_id: string | null
          reading_count: number | null
          red_threshold: number | null
          risk_id: string | null
          status: string | null
          unit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erm_kris_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erm_kris_owner_id_fkey"
            columns: ["owner_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "erm_kris_risk_id_fkey"
            columns: ["risk_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "erm_risk_summary"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "erm_kris_risk_id_fkey"
            columns: ["risk_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "erm_risks"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      erm_risk_summary: {
        Row: {
          appetite_breach: boolean | null
          appetite_level: string | null
          category_code: string | null
          category_id: string | null
          category_name_ar: string | null
          category_name_en: string | null
          client_workspace_id: string | null
          code: string | null
          control_count: number | null
          created_at: string | null
          description: string | null
          emerging: boolean | null
          id: string | null
          impact_dimensions: Json | null
          inherent_impact: number | null
          inherent_likelihood: number | null
          inherent_score: number | null
          kri_count: number | null
          kri_status: string | null
          last_assessed_at: string | null
          next_review_at: string | null
          open_treatments: number | null
          organization_id: string | null
          overdue_treatments: number | null
          owner_id: string | null
          owner_name: string | null
          parent_category_code: string | null
          parent_category_id: string | null
          parent_category_name_en: string | null
          residual_impact: number | null
          residual_likelihood: number | null
          residual_score: number | null
          source: string | null
          sponsor_id: string | null
          sponsor_name: string | null
          status: string | null
          target_impact: number | null
          target_likelihood: number | null
          target_score: number | null
          title: string | null
          tolerance_threshold: number | null
          trend: string | null
          updated_at: string | null
          velocity: number | null
        }
        Relationships: [
          {
            foreignKeyName: "erm_risks_category_id_fkey"
            columns: ["category_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "erm_categories"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "erm_risks_client_workspace_id_fkey"
            columns: ["client_workspace_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "client_workspaces"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "erm_risks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erm_risks_owner_id_fkey"
            columns: ["owner_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "erm_risks_sponsor_id_fkey"
            columns: ["sponsor_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      erm_treatment_summary: {
        Row: {
          completed_at: string | null
          cost_estimate: number | null
          created_at: string | null
          days_to_due: number | null
          description: string | null
          due_date: string | null
          expected_residual_impact: number | null
          expected_residual_likelihood: number | null
          expected_residual_score: number | null
          id: string | null
          is_overdue: boolean | null
          organization_id: string | null
          owner_id: string | null
          owner_name: string | null
          risk_code: string | null
          risk_id: string | null
          risk_residual_score: number | null
          risk_title: string | null
          status: string | null
          strategy: string | null
          title: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erm_treatments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erm_treatments_owner_id_fkey"
            columns: ["owner_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "erm_treatments_risk_id_fkey"
            columns: ["risk_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "erm_risk_summary"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "erm_treatments_risk_id_fkey"
            columns: ["risk_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "erm_risks"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      framework_summary: {
        Row: {
          category: string | null
          code: string | null
          control_count: number | null
          description_ar: string | null
          description_en: string | null
          domain_count: number | null
          effective_date: string | null
          id: string | null
          jurisdiction: string | null
          mandatory: boolean | null
          name_ar: string | null
          name_en: string | null
          regulator_ar: string | null
          regulator_en: string | null
          short_name: string | null
          sort_order: number | null
          source_url: string | null
          verified_count: number | null
          version: string | null
        }
        Relationships: []
      }
      icfr_process_summary: {
        Row: {
          client_workspace_id: string | null
          code: string | null
          control_count: number | null
          created_at: string | null
          cycle: string | null
          description: string | null
          effective_key_controls: number | null
          id: string | null
          key_control_count: number | null
          material_weaknesses: number | null
          name: string | null
          open_deficiencies: number | null
          organization_id: string | null
          owner_id: string | null
          risk_count: number | null
          status: string | null
          tested_key_controls: number | null
          updated_at: string | null
        }
        Insert: {
          client_workspace_id?: string | null
          code?: string | null
          control_count?: never
          created_at?: string | null
          cycle?: string | null
          description?: string | null
          effective_key_controls?: never
          id?: string | null
          key_control_count?: never
          material_weaknesses?: never
          name?: string | null
          open_deficiencies?: never
          organization_id?: string | null
          owner_id?: string | null
          risk_count?: never
          status?: string | null
          tested_key_controls?: never
          updated_at?: string | null
        }
        Update: {
          client_workspace_id?: string | null
          code?: string | null
          control_count?: never
          created_at?: string | null
          cycle?: string | null
          description?: string | null
          effective_key_controls?: never
          id?: string | null
          key_control_count?: never
          material_weaknesses?: never
          name?: string | null
          open_deficiencies?: never
          organization_id?: string | null
          owner_id?: string | null
          risk_count?: never
          status?: string | null
          tested_key_controls?: never
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "icfr_processes_client_workspace_id_fkey"
            columns: ["client_workspace_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "client_workspaces"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "icfr_processes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "icfr_processes_owner_id_fkey"
            columns: ["owner_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      program_summary: {
        Row: {
          client_workspace_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          framework_code: string | null
          framework_id: string | null
          framework_jurisdiction: string | null
          framework_name_en: string | null
          framework_short_name: string | null
          id: string | null
          implemented: number | null
          in_progress: number | null
          name: string | null
          not_applicable: number | null
          not_started: number | null
          organization_id: string | null
          readiness_pct: number | null
          status: string | null
          target_date: string | null
          total_controls: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programs_client_workspace_id_fkey"
            columns: ["client_workspace_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "client_workspaces"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "programs_created_by_fkey"
            columns: ["created_by", "organization_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "programs_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "framework_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_audit_plan_from_universe: {
        Args: { p_capacity_days: number; p_period: string }
        Returns: string
      }
      create_engagement_from_template: {
        Args: { p_engagement_id: string; p_template_code: string }
        Returns: number
      }
      create_program: {
        Args: {
          p_client_workspace_id?: string
          p_description?: string
          p_framework_id: string
          p_name: string
          p_target_date?: string
        }
        Returns: string
      }
      current_user_org_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      erm_assess_risk: {
        Args: {
          p_impact_dimensions?: Json
          p_inherent_i: number
          p_inherent_l: number
          p_rationale?: string
          p_residual_i: number
          p_residual_l: number
          p_risk_id: string
          p_target_i?: number
          p_target_l?: number
          p_trend?: string
          p_velocity?: number
        }
        Returns: string
      }
      erm_kri_rag: {
        Args: {
          p_amber: number
          p_direction: string
          p_red: number
          p_value: number
        }
        Returns: string
      }
      erm_mark_overdue_treatments: { Args: never; Returns: number }
      import_erm_taxonomy: { Args: never; Returns: number }
      import_icfr_template: {
        Args: { p_client_workspace_id?: string; p_template_code: string }
        Returns: string
      }
      next_risk_code: { Args: { p_org: string }; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
