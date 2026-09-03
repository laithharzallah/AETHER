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
            columns: ["client_workspace_id"]
            isOneToOne: false
            referencedRelation: "client_workspaces"
            referencedColumns: ["id"]
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
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
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
          sort_order?: number
          subdomain_ar?: string | null
          subdomain_en?: string | null
          title_ar?: string | null
          title_en: string
          updated_at?: string
          verified?: boolean
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
          sort_order?: number
          subdomain_ar?: string | null
          subdomain_en?: string | null
          title_ar?: string | null
          title_en?: string
          updated_at?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "controls_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "frameworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controls_framework_id_fkey"
            columns: ["framework_id"]
            isOneToOne: false
            referencedRelation: "framework_summary"
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
            columns: ["client_workspace_id"]
            isOneToOne: false
            referencedRelation: "client_workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
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
    }
    Functions: {
      current_user_org_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      current_user_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
