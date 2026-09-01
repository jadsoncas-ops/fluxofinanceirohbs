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
      hbs_accounts: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          id: string
          nome: string
          saldo: number
          tipo: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
          saldo?: number
          tipo: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
          saldo?: number
          tipo?: string
        }
        Relationships: []
      }
      hbs_app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      hbs_clients: {
        Row: {
          created_at: string
          created_by: string | null
          descricao: string | null
          documento: string | null
          endereco: Json | null
          id: string
          nome: string
          qualificacao: Json | null
          telefone: Json | null
          tipo: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          documento?: string | null
          endereco?: Json | null
          id?: string
          nome: string
          qualificacao?: Json | null
          telefone?: Json | null
          tipo?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          documento?: string | null
          endereco?: Json | null
          id?: string
          nome?: string
          qualificacao?: Json | null
          telefone?: Json | null
          tipo?: string | null
        }
        Relationships: []
      }
      hbs_contratos: {
        Row: {
          assinado_em: string | null
          cliente_id: string
          codigo: string
          created_at: string
          created_by: string | null
          id: string
          parcelas: Json
          proposta_id: string
          status: string
          trabalho_id: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          assinado_em?: string | null
          cliente_id: string
          codigo: string
          created_at?: string
          created_by?: string | null
          id?: string
          parcelas?: Json
          proposta_id: string
          status?: string
          trabalho_id?: string | null
          updated_at?: string
          valor: number
        }
        Update: {
          assinado_em?: string | null
          cliente_id?: string
          codigo?: string
          created_at?: string
          created_by?: string | null
          id?: string
          parcelas?: Json
          proposta_id?: string
          status?: string
          trabalho_id?: string | null
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "hbs_contratos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "hbs_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hbs_contratos_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "hbs_propostas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hbs_contratos_trabalho_id_fkey"
            columns: ["trabalho_id"]
            isOneToOne: false
            referencedRelation: "hbs_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      hbs_documents: {
        Row: {
          cliente_id: string | null
          created_at: string
          created_by: string | null
          id: string
          link: string | null
          nome: string
          process_id: string | null
          situacao: string
          tipo_tecnico: string | null
          updated_at: string
          versao: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          link?: string | null
          nome: string
          process_id?: string | null
          situacao: string
          tipo_tecnico?: string | null
          updated_at?: string
          versao?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          link?: string | null
          nome?: string
          process_id?: string | null
          situacao?: string
          tipo_tecnico?: string | null
          updated_at?: string
          versao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hbs_documents_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "hbs_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hbs_documents_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "hbs_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      hbs_historico_events: {
        Row: {
          cliente_id: string | null
          contrato_id: string | null
          created_at: string
          created_by: string | null
          id: string
          modulo: string
          proposta_id: string | null
          texto: string
          trabalho_id: string | null
        }
        Insert: {
          cliente_id?: string | null
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          modulo: string
          proposta_id?: string | null
          texto: string
          trabalho_id?: string | null
        }
        Update: {
          cliente_id?: string | null
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          modulo?: string
          proposta_id?: string | null
          texto?: string
          trabalho_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hbs_historico_events_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "hbs_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hbs_historico_events_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "hbs_contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hbs_historico_events_proposta_id_fkey"
            columns: ["proposta_id"]
            isOneToOne: false
            referencedRelation: "hbs_propostas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hbs_historico_events_trabalho_id_fkey"
            columns: ["trabalho_id"]
            isOneToOne: false
            referencedRelation: "hbs_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      hbs_partners: {
        Row: {
          contato: string | null
          created_at: string
          created_by: string | null
          documento: string | null
          id: string
          nome: string
          observacao: string | null
        }
        Insert: {
          contato?: string | null
          created_at?: string
          created_by?: string | null
          documento?: string | null
          id?: string
          nome: string
          observacao?: string | null
        }
        Update: {
          contato?: string | null
          created_at?: string
          created_by?: string | null
          documento?: string | null
          id?: string
          nome?: string
          observacao?: string | null
        }
        Relationships: []
      }
      hbs_processes: {
        Row: {
          averbacao: Json | null
          cliente_id: string
          contrato_id: string | null
          created_at: string
          created_by: string | null
          data_protocolo: string | null
          drive_link: string | null
          endereco: string | null
          etapa: string | null
          id: string
          is_archived: boolean
          notas: Json
          objeto: string
          prazo: string | null
          protocolo: string | null
          status: string
          tecnico: Json | null
          tipo_trabalho: string | null
          updated_at: string
          valor_contrato: number | null
        }
        Insert: {
          averbacao?: Json | null
          cliente_id: string
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          data_protocolo?: string | null
          drive_link?: string | null
          endereco?: string | null
          etapa?: string | null
          id?: string
          is_archived?: boolean
          notas?: Json
          objeto: string
          prazo?: string | null
          protocolo?: string | null
          status: string
          tecnico?: Json | null
          tipo_trabalho?: string | null
          updated_at?: string
          valor_contrato?: number | null
        }
        Update: {
          averbacao?: Json | null
          cliente_id?: string
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
          data_protocolo?: string | null
          drive_link?: string | null
          endereco?: string | null
          etapa?: string | null
          id?: string
          is_archived?: boolean
          notas?: Json
          objeto?: string
          prazo?: string | null
          protocolo?: string | null
          status?: string
          tecnico?: Json | null
          tipo_trabalho?: string | null
          updated_at?: string
          valor_contrato?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hbs_processes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "hbs_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      hbs_profiles: {
        Row: {
          created_at: string
          id: string
          nome: string | null
          role: string
        }
        Insert: {
          created_at?: string
          id: string
          nome?: string | null
          role?: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string | null
          role?: string
        }
        Relationships: []
      }
      hbs_propostas: {
        Row: {
          cliente_id: string
          codigo: string
          comissao_percent: number
          created_at: string
          created_by: string | null
          custo_hora_base: number
          custos_protocolo: Json | null
          enviada_em: string | null
          forma_pagamento: string | null
          id: string
          impostos_percent: number
          itens: Json
          lucro_percent: number
          parcelas_pagamento: Json | null
          prazo_dias: number | null
          resultado: Json
          status: string
          titulo: string
          trabalho_id: string | null
          updated_at: string
        }
        Insert: {
          cliente_id: string
          codigo: string
          comissao_percent?: number
          created_at?: string
          created_by?: string | null
          custo_hora_base?: number
          custos_protocolo?: Json | null
          enviada_em?: string | null
          forma_pagamento?: string | null
          id?: string
          impostos_percent?: number
          itens?: Json
          lucro_percent?: number
          parcelas_pagamento?: Json | null
          prazo_dias?: number | null
          resultado?: Json
          status?: string
          titulo: string
          trabalho_id?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          codigo?: string
          comissao_percent?: number
          created_at?: string
          created_by?: string | null
          custo_hora_base?: number
          custos_protocolo?: Json | null
          enviada_em?: string | null
          forma_pagamento?: string | null
          id?: string
          impostos_percent?: number
          itens?: Json
          lucro_percent?: number
          parcelas_pagamento?: Json | null
          prazo_dias?: number | null
          resultado?: Json
          status?: string
          titulo?: string
          trabalho_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hbs_propostas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "hbs_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hbs_propostas_trabalho_id_fkey"
            columns: ["trabalho_id"]
            isOneToOne: false
            referencedRelation: "hbs_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      hbs_tasks: {
        Row: {
          cliente_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          prazo: string | null
          prioridade: string
          process_id: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          prazo?: string | null
          prioridade?: string
          process_id?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          prazo?: string | null
          prioridade?: string
          process_id?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hbs_tasks_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "hbs_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hbs_tasks_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "hbs_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      hbs_transactions: {
        Row: {
          categoria: string
          cliente_id: string | null
          created_at: string
          created_by: string | null
          data: string
          descricao: string
          id: string
          is_repasse: boolean
          original_total: number | null
          parent_id: string | null
          partner_id: string | null
          previsao_data: string | null
          process_id: string | null
          status: string
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          categoria: string
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          data: string
          descricao: string
          id?: string
          is_repasse?: boolean
          original_total?: number | null
          parent_id?: string | null
          partner_id?: string | null
          previsao_data?: string | null
          process_id?: string | null
          status?: string
          tipo: string
          updated_at?: string
          valor: number
        }
        Update: {
          categoria?: string
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          descricao?: string
          id?: string
          is_repasse?: boolean
          original_total?: number | null
          parent_id?: string | null
          partner_id?: string | null
          previsao_data?: string | null
          process_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "hbs_transactions_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "hbs_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hbs_transactions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "hbs_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hbs_transactions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "hbs_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hbs_transactions_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "hbs_processes"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          categoria: string
          created_at: string
          data: string
          descricao: string
          id: string
          is_repasse: boolean
          status: string
          tipo: string
          updated_at: string
          user_id: string
          valor: number
        }
        Insert: {
          categoria: string
          created_at?: string
          data: string
          descricao: string
          id?: string
          is_repasse?: boolean
          status?: string
          tipo: string
          updated_at?: string
          user_id: string
          valor: number
        }
        Update: {
          categoria?: string
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          is_repasse?: boolean
          status?: string
          tipo?: string
          updated_at?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      hbs_check_invite_code: { Args: { code: string }; Returns: boolean }
      hbs_next_contrato_codigo: { Args: never; Returns: string }
      hbs_next_proposta_codigo: { Args: never; Returns: string }
      hbs_profiles_count: { Args: never; Returns: number }
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
