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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      hbs_profiles: {
        Row: { id: string; nome: string | null; role: string; created_at: string }
        Insert: { id: string; nome?: string | null; role?: string; created_at?: string }
        Update: { id?: string; nome?: string | null; role?: string; created_at?: string }
        Relationships: []
      }
      hbs_app_settings: {
        Row: { key: string; value: Json; updated_at: string }
        Insert: { key: string; value: Json; updated_at?: string }
        Update: { key?: string; value?: Json; updated_at?: string }
        Relationships: []
      }
      hbs_clients: {
        Row: {
          id: string
          nome: string
          tipo: string | null
          documento: string | null
          telefone: Json | null
          endereco: Json | null
          descricao: string | null
          qualificacao: Json | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          nome: string
          tipo?: string | null
          documento?: string | null
          telefone?: Json | null
          endereco?: Json | null
          descricao?: string | null
          qualificacao?: Json | null
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          nome?: string
          tipo?: string | null
          documento?: string | null
          telefone?: Json | null
          endereco?: Json | null
          descricao?: string | null
          qualificacao?: Json | null
          created_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      hbs_processes: {
        Row: {
          id: string
          cliente_id: string
          objeto: string
          status: string
          etapa: string | null
          tipo_trabalho: string | null
          endereco: string | null
          prazo: string | null
          protocolo: string | null
          data_protocolo: string | null
          valor_contrato: number | null
          drive_link: string | null
          is_archived: boolean
          notas: Json
          tecnico: Json | null
          contrato_id: string | null
          averbacao: Json | null
          procuracao: Json | null
          carta_reforma: Json | null
          anuencia: Json | null
          descarte_entulhos: Json | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          cliente_id: string
          objeto: string
          status: string
          etapa?: string | null
          tipo_trabalho?: string | null
          endereco?: string | null
          prazo?: string | null
          protocolo?: string | null
          data_protocolo?: string | null
          valor_contrato?: number | null
          drive_link?: string | null
          is_archived?: boolean
          notas?: Json
          tecnico?: Json | null
          contrato_id?: string | null
          averbacao?: Json | null
          procuracao?: Json | null
          carta_reforma?: Json | null
          anuencia?: Json | null
          descarte_entulhos?: Json | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          cliente_id?: string
          objeto?: string
          status?: string
          etapa?: string | null
          tipo_trabalho?: string | null
          endereco?: string | null
          prazo?: string | null
          protocolo?: string | null
          data_protocolo?: string | null
          valor_contrato?: number | null
          drive_link?: string | null
          is_archived?: boolean
          notas?: Json
          tecnico?: Json | null
          contrato_id?: string | null
          averbacao?: Json | null
          procuracao?: Json | null
          carta_reforma?: Json | null
          anuencia?: Json | null
          descarte_entulhos?: Json | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      hbs_tasks: {
        Row: {
          id: string
          titulo: string
          descricao: string | null
          status: string
          prioridade: string
          prazo: string | null
          process_id: string | null
          cliente_id: string | null
          created_at: string
          updated_at: string
          completed_at: string | null
          created_by: string | null
        }
        Insert: {
          id?: string
          titulo: string
          descricao?: string | null
          status?: string
          prioridade?: string
          prazo?: string | null
          process_id?: string | null
          cliente_id?: string | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
          created_by?: string | null
        }
        Update: {
          id?: string
          titulo?: string
          descricao?: string | null
          status?: string
          prioridade?: string
          prazo?: string | null
          process_id?: string | null
          cliente_id?: string | null
          created_at?: string
          updated_at?: string
          completed_at?: string | null
          created_by?: string | null
        }
        Relationships: []
      }
      hbs_accounts: {
        Row: { id: string; nome: string; tipo: string; saldo: number; ativo: boolean; created_at: string; created_by: string | null }
        Insert: { id?: string; nome: string; tipo: string; saldo?: number; ativo?: boolean; created_at?: string; created_by?: string | null }
        Update: { id?: string; nome?: string; tipo?: string; saldo?: number; ativo?: boolean; created_at?: string; created_by?: string | null }
        Relationships: []
      }
      hbs_partners: {
        Row: { id: string; nome: string; documento: string | null; contato: string | null; observacao: string | null; created_at: string; created_by: string | null }
        Insert: { id?: string; nome: string; documento?: string | null; contato?: string | null; observacao?: string | null; created_at?: string; created_by?: string | null }
        Update: { id?: string; nome?: string; documento?: string | null; contato?: string | null; observacao?: string | null; created_at?: string; created_by?: string | null }
        Relationships: []
      }
      hbs_documents: {
        Row: {
          id: string
          nome: string
          cliente_id: string | null
          process_id: string | null
          tipo_tecnico: string | null
          versao: string | null
          situacao: string
          link: string | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          nome: string
          cliente_id?: string | null
          process_id?: string | null
          tipo_tecnico?: string | null
          versao?: string | null
          situacao: string
          link?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          nome?: string
          cliente_id?: string | null
          process_id?: string | null
          tipo_tecnico?: string | null
          versao?: string | null
          situacao?: string
          link?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      hbs_transactions: {
        Row: {
          id: string
          data: string
          tipo: string
          categoria: string
          descricao: string
          valor: number
          status: string
          is_repasse: boolean
          parent_id: string | null
          partner_id: string | null
          cliente_id: string | null
          process_id: string | null
          previsao_data: string | null
          original_total: number | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          data: string
          tipo: string
          categoria: string
          descricao: string
          valor: number
          status?: string
          is_repasse?: boolean
          parent_id?: string | null
          partner_id?: string | null
          cliente_id?: string | null
          process_id?: string | null
          previsao_data?: string | null
          original_total?: number | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          data?: string
          tipo?: string
          categoria?: string
          descricao?: string
          valor?: number
          status?: string
          is_repasse?: boolean
          parent_id?: string | null
          partner_id?: string | null
          cliente_id?: string | null
          process_id?: string | null
          previsao_data?: string | null
          original_total?: number | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      hbs_propostas: {
        Row: {
          id: string
          codigo: string
          cliente_id: string
          trabalho_id: string | null
          titulo: string
          itens: Json
          custo_hora_base: number
          lucro_percent: number
          impostos_percent: number
          comissao_percent: number
          custos_protocolo: Json | null
          resultado: Json
          prazo_dias: number | null
          forma_pagamento: string | null
          parcelas_pagamento: Json | null
          status: string
          enviada_em: string | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          codigo: string
          cliente_id: string
          trabalho_id?: string | null
          titulo: string
          itens?: Json
          custo_hora_base?: number
          lucro_percent?: number
          impostos_percent?: number
          comissao_percent?: number
          custos_protocolo?: Json | null
          resultado?: Json
          prazo_dias?: number | null
          forma_pagamento?: string | null
          parcelas_pagamento?: Json | null
          status?: string
          enviada_em?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          codigo?: string
          cliente_id?: string
          trabalho_id?: string | null
          titulo?: string
          itens?: Json
          custo_hora_base?: number
          lucro_percent?: number
          impostos_percent?: number
          comissao_percent?: number
          custos_protocolo?: Json | null
          resultado?: Json
          prazo_dias?: number | null
          forma_pagamento?: string | null
          parcelas_pagamento?: Json | null
          status?: string
          enviada_em?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      hbs_contratos: {
        Row: {
          id: string
          codigo: string
          proposta_id: string
          cliente_id: string
          trabalho_id: string | null
          valor: number
          parcelas: Json
          status: string
          assinado_em: string | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          codigo: string
          proposta_id: string
          cliente_id: string
          trabalho_id?: string | null
          valor: number
          parcelas?: Json
          status?: string
          assinado_em?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          codigo?: string
          proposta_id?: string
          cliente_id?: string
          trabalho_id?: string | null
          valor?: number
          parcelas?: Json
          status?: string
          assinado_em?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      hbs_historico_events: {
        Row: {
          id: string
          modulo: string
          texto: string
          cliente_id: string | null
          trabalho_id: string | null
          proposta_id: string | null
          contrato_id: string | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          modulo: string
          texto: string
          cliente_id?: string | null
          trabalho_id?: string | null
          proposta_id?: string | null
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          modulo?: string
          texto?: string
          cliente_id?: string | null
          trabalho_id?: string | null
          proposta_id?: string | null
          contrato_id?: string | null
          created_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      hbs_compromissos: {
        Row: {
          id: string
          titulo: string
          data: string
          hora_inicio: string | null
          hora_fim: string | null
          com_quem: string | null
          cliente_id: string | null
          process_id: string | null
          cor: string
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          titulo: string
          data: string
          hora_inicio?: string | null
          hora_fim?: string | null
          com_quem?: string | null
          cliente_id?: string | null
          process_id?: string | null
          cor?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          titulo?: string
          data?: string
          hora_inicio?: string | null
          hora_fim?: string | null
          com_quem?: string | null
          cliente_id?: string | null
          process_id?: string | null
          cor?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      hbs_avaliacoes: {
        Row: {
          id: string
          logo_url: string | null
          entidade_solicitante: string | null
          secretaria_solicitante: string | null
          secretaria_destinataria: string | null
          tipo_laudo: string | null
          finalidade: string | null
          endereco_imovel: string | null
          municipio_uf: string | null
          grau_fundamentacao: string | null
          proprietario: string | null
          metodologia_aplicada: string | null
          tipo_imovel: string | null
          area_construida: number | null
          data_referencia: string | null
          destinacao_uso: string | null
          uso_predominante: string | null
          tipologia: string | null
          numero_pavimentos: number | null
          padrao_construtivo: string | null
          estado_conservacao: string | null
          observacoes_adicionais: string | null
          responsavel_nome: string | null
          responsavel_registro: string | null
          colaborador_nome: string | null
          colaborador_registro: string | null
          avaliador_nome: string | null
          avaliador_registro: string | null
          fator_redutor_percent: number
          comparaveis: Json
          fotos: Json
          fotos_por_pagina: string
          cidade_assinatura: string | null
          data_assinatura: string | null
          status: string
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          logo_url?: string | null
          entidade_solicitante?: string | null
          secretaria_solicitante?: string | null
          secretaria_destinataria?: string | null
          tipo_laudo?: string | null
          finalidade?: string | null
          endereco_imovel?: string | null
          municipio_uf?: string | null
          grau_fundamentacao?: string | null
          proprietario?: string | null
          metodologia_aplicada?: string | null
          tipo_imovel?: string | null
          area_construida?: number | null
          data_referencia?: string | null
          destinacao_uso?: string | null
          uso_predominante?: string | null
          tipologia?: string | null
          numero_pavimentos?: number | null
          padrao_construtivo?: string | null
          estado_conservacao?: string | null
          observacoes_adicionais?: string | null
          responsavel_nome?: string | null
          responsavel_registro?: string | null
          colaborador_nome?: string | null
          colaborador_registro?: string | null
          avaliador_nome?: string | null
          avaliador_registro?: string | null
          fator_redutor_percent?: number
          comparaveis?: Json
          fotos?: Json
          fotos_por_pagina?: string
          cidade_assinatura?: string | null
          data_assinatura?: string | null
          status?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          logo_url?: string | null
          entidade_solicitante?: string | null
          secretaria_solicitante?: string | null
          secretaria_destinataria?: string | null
          tipo_laudo?: string | null
          finalidade?: string | null
          endereco_imovel?: string | null
          municipio_uf?: string | null
          grau_fundamentacao?: string | null
          proprietario?: string | null
          metodologia_aplicada?: string | null
          tipo_imovel?: string | null
          area_construida?: number | null
          data_referencia?: string | null
          destinacao_uso?: string | null
          uso_predominante?: string | null
          tipologia?: string | null
          numero_pavimentos?: number | null
          padrao_construtivo?: string | null
          estado_conservacao?: string | null
          observacoes_adicionais?: string | null
          responsavel_nome?: string | null
          responsavel_registro?: string | null
          colaborador_nome?: string | null
          colaborador_registro?: string | null
          avaliador_nome?: string | null
          avaliador_registro?: string | null
          fator_redutor_percent?: number
          comparaveis?: Json
          fotos?: Json
          fotos_por_pagina?: string
          cidade_assinatura?: string | null
          data_assinatura?: string | null
          status?: string
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      hbs_check_invite_code: {
        Args: { code: string }
        Returns: boolean
      }
      hbs_next_proposta_codigo: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      hbs_next_contrato_codigo: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      hbs_profiles_count: {
        Args: Record<PropertyKey, never>
        Returns: number
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
