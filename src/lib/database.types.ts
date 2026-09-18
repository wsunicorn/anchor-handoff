export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      answer_cache: {
        Row: {
          answer: Json
          created_at: string
          document_id: string
          key: string
          lang: string
        }
        Insert: {
          answer: Json
          created_at?: string
          document_id: string
          key: string
          lang: string
        }
        Update: {
          answer?: Json
          created_at?: string
          document_id?: string
          key?: string
          lang?: string
        }
        Relationships: [
          {
            foreignKeyName: "answer_cache_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          due_at: string
          fsrs_state: Json
          id: string
          owner: string
          question_id: string
          updated_at: string
        }
        Insert: {
          due_at: string
          fsrs_state: Json
          id?: string
          owner: string
          question_id: string
          updated_at?: string
        }
        Update: {
          due_at?: string
          fsrs_state?: Json
          id?: string
          owner?: string
          question_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      chunks: {
        Row: {
          bboxes: Json
          document_id: string
          embedding: string | null
          id: string
          ord: number
          page_no: number
          text: string
          token_count: number
          tsv: unknown
        }
        Insert: {
          bboxes: Json
          document_id: string
          embedding?: string | null
          id?: string
          ord: number
          page_no: number
          text: string
          token_count: number
          tsv?: unknown
        }
        Update: {
          bboxes?: Json
          document_id?: string
          embedding?: string | null
          id?: string
          ord?: number
          page_no?: number
          text?: string
          token_count?: number
          tsv?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          document_id: string
          id: string
          owner: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          owner: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          owner?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          error: string | null
          id: string
          lang: string | null
          owner: string
          page_count: number
          sha256: string
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          lang?: string | null
          owner: string
          page_count?: number
          sha256: string
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          lang?: string | null
          owner?: string
          page_count?: number
          sha256?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      essays: {
        Row: {
          body: string
          created_at: string
          document_id: string | null
          feedback: Json | null
          id: string
          owner: string
          rubric: Json
        }
        Insert: {
          body: string
          created_at?: string
          document_id?: string | null
          feedback?: Json | null
          id?: string
          owner: string
          rubric: Json
        }
        Update: {
          body?: string
          created_at?: string
          document_id?: string | null
          feedback?: Json | null
          id?: string
          owner?: string
          rubric?: Json
        }
        Relationships: [
          {
            foreignKeyName: "essays_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          citations: Json | null
          content: string
          conversation_id: string
          cost_usd: number | null
          created_at: string
          id: string
          role: string
          verdicts: Json | null
        }
        Insert: {
          citations?: Json | null
          content: string
          conversation_id: string
          cost_usd?: number | null
          created_at?: string
          id?: string
          role: string
          verdicts?: Json | null
        }
        Update: {
          citations?: Json | null
          content?: string
          conversation_id?: string
          cost_usd?: number | null
          created_at?: string
          id?: string
          role?: string
          verdicts?: Json | null
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
      pages: {
        Row: {
          document_id: string
          height: number
          id: string
          image_path: string
          page_no: number
          width: number
        }
        Insert: {
          document_id: string
          height: number
          id?: string
          image_path: string
          page_no: number
          width: number
        }
        Update: {
          document_id?: string
          height?: number
          id?: string
          image_path?: string
          page_no?: number
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "pages_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ai_consent_at: string | null
          created_at: string
          entitlement: string
          entitlement_updated_at: string | null
          id: string
          locale: string
          tier: string
          trial_ends_at: string | null
        }
        Insert: {
          ai_consent_at?: string | null
          created_at?: string
          entitlement?: string
          entitlement_updated_at?: string | null
          id: string
          locale?: string
          tier?: string
          trial_ends_at?: string | null
        }
        Update: {
          ai_consent_at?: string | null
          created_at?: string
          entitlement?: string
          entitlement_updated_at?: string | null
          id?: string
          locale?: string
          tier?: string
          trial_ends_at?: string | null
        }
        Relationships: []
      }
      questions: {
        Row: {
          answer_key: string
          citation: Json
          explanation: string
          id: string
          options: Json
          quality_score: number | null
          quiz_id: string
          stem: string
        }
        Insert: {
          answer_key: string
          citation: Json
          explanation: string
          id?: string
          options: Json
          quality_score?: number | null
          quiz_id: string
          stem: string
        }
        Update: {
          answer_key?: string
          citation?: Json
          explanation?: string
          id?: string
          options?: Json
          quality_score?: number | null
          quiz_id?: string
          stem?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          document_id: string
          generated_at: string
          id: string
          scope: Json
        }
        Insert: {
          document_id: string
          generated_at?: string
          id?: string
          scope: Json
        }
        Update: {
          document_id?: string
          generated_at?: string
          id?: string
          scope?: Json
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_costs: {
        Row: {
          cost_usd: number
          created_at: string
          feature: string
          id: string
          model: string
          owner: string
          tokens_in: number
          tokens_out: number
        }
        Insert: {
          cost_usd?: number
          created_at?: string
          feature: string
          id?: string
          model: string
          owner: string
          tokens_in?: number
          tokens_out?: number
        }
        Update: {
          cost_usd?: number
          created_at?: string
          feature?: string
          id?: string
          model?: string
          owner?: string
          tokens_in?: number
          tokens_out?: number
        }
        Relationships: []
      }
      verifications: {
        Row: {
          chunk_id: string | null
          claim: string
          created_at: string
          id: string
          message_id: string
          score: number
          verdict: string
        }
        Insert: {
          chunk_id?: string | null
          claim: string
          created_at?: string
          id?: string
          message_id: string
          score: number
          verdict: string
        }
        Update: {
          chunk_id?: string | null
          claim?: string
          created_at?: string
          id?: string
          message_id?: string
          score?: number
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "verifications_chunk_id_fkey"
            columns: ["chunk_id"]
            isOneToOne: false
            referencedRelation: "chunks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifications_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cost_dashboard: {
        Args: { p_days?: number }
        Returns: {
          active_users: number
          by_feature: Json
          calls: number
          cost_per_active_user: number
          cost_usd: number
          tier: string
        }[]
      }
      daily_cost_usd: { Args: { p_owner: string }; Returns: number }
      effective_tier: { Args: { p_owner: string }; Returns: string }
      my_entitlement: {
        Args: never
        Returns: {
          entitlement: string
          tier: string
          trial_ends_at: string
        }[]
      }
      my_question_quota: {
        Args: never
        Returns: {
          quota: number
          resets_at: string
          tier: string
          used: number
        }[]
      }
      question_quota: {
        Args: { p_owner: string }
        Returns: {
          quota: number
          resets_at: string
          tier: string
          used: number
        }[]
      }
      search_chunks: {
        Args: {
          p_document_id: string
          p_embedding: string
          p_limit?: number
          p_query: string
        }
        Returns: {
          bboxes: Json
          chunk_id: string
          page_no: number
          score: number
          text: string
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      start_trial: { Args: never; Returns: string }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

