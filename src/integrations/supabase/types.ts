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
      app_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      dossier_editions: {
        Row: {
          created_at: string
          dossier_id: string
          edition_id: string
          id: string
          referentiel_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dossier_id: string
          edition_id: string
          id?: string
          referentiel_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dossier_id?: string
          edition_id?: string
          id?: string
          referentiel_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dossier_editions_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossier_editions_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossier_editions_referentiel_id_fkey"
            columns: ["referentiel_id"]
            isOneToOne: false
            referencedRelation: "referentiels"
            referencedColumns: ["id"]
          },
        ]
      }
      dossier_events: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          dossier_id: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          dossier_id: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          dossier_id?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dossier_events_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      dossier_snapshots: {
        Row: {
          created_at: string
          data: Json
          dossier_id: string
          id: string
          nom: string
          synthese: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          data: Json
          dossier_id: string
          id?: string
          nom: string
          synthese: Json
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          dossier_id?: string
          id?: string
          nom?: string
          synthese?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dossier_snapshots_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      dossiers: {
        Row: {
          created_at: string
          data: Json
          id: string
          organisation_id: string | null
          reference: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          organisation_id?: string | null
          reference?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          organisation_id?: string | null
          reference?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dossiers_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      editions: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          created_at: string
          created_by: string | null
          id: string
          libelle: string
          referentiel_id: string
          source: string | null
          statut: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          libelle: string
          referentiel_id: string
          source?: string | null
          statut?: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          libelle?: string
          referentiel_id?: string
          source?: string | null
          statut?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "editions_referentiel_id_fkey"
            columns: ["referentiel_id"]
            isOneToOne: false
            referencedRelation: "referentiels"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_audit: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          edition_id: string | null
          id: string
          referentiel_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          edition_id?: string | null
          id?: string
          referentiel_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          edition_id?: string | null
          id?: string
          referentiel_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_audit_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_audit_referentiel_id_fkey"
            columns: ["referentiel_id"]
            isOneToOne: false
            referencedRelation: "referentiels"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_membres: {
        Row: {
          created_at: string
          organisation_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organisation_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          organisation_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_membres_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          created_at: string
          id: string
          nom: string
        }
        Insert: {
          created_at?: string
          id?: string
          nom: string
        }
        Update: {
          created_at?: string
          id?: string
          nom?: string
        }
        Relationships: []
      }
      referentiels: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          kind: string
          libelle: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          kind: string
          libelle: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          libelle?: string
          updated_at?: string
        }
        Relationships: []
      }
      taux_legal: {
        Row: {
          created_at: string
          debut: string
          fin: string
          id: string
          reference: string | null
          taux_autres: number | null
          taux_particulier: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          debut: string
          fin: string
          id?: string
          reference?: string | null
          taux_autres?: number | null
          taux_particulier?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          debut?: string
          fin?: string
          id?: string
          reference?: string | null
          taux_autres?: number | null
          taux_particulier?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      valeurs: {
        Row: {
          cle: Json
          commentaire: string | null
          created_at: string
          edition_id: string
          id: string
          updated_at: string
          valeur: Json
        }
        Insert: {
          cle: Json
          commentaire?: string | null
          created_at?: string
          edition_id: string
          id?: string
          updated_at?: string
          valeur: Json
        }
        Update: {
          cle?: Json
          commentaire?: string | null
          created_at?: string
          edition_id?: string
          id?: string
          updated_at?: string
          valeur?: Json
        }
        Relationships: [
          {
            foreignKeyName: "valeurs_edition_id_fkey"
            columns: ["edition_id"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_referentiels: { Args: { _user: string }; Returns: boolean }
      create_organisation: {
        Args: { _nom: string }
        Returns: {
          created_at: string
          id: string
          nom: string
        }[]
      }
      has_org_role: {
        Args: { _org: string; _roles: string[]; _user: string }
        Returns: boolean
      }
      is_org_member: { Args: { _org: string; _user: string }; Returns: boolean }
      is_platform_admin: { Args: { _user: string }; Returns: boolean }
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
