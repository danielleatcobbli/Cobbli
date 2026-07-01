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
      addresses: {
        Row: {
          city: string
          created_at: string
          id: string
          is_default: boolean
          state: string
          street: string
          street2: string | null
          updated_at: string
          user_id: string
          zip: string
        }
        Insert: {
          city: string
          created_at?: string
          id?: string
          is_default?: boolean
          state: string
          street: string
          street2?: string | null
          updated_at?: string
          user_id: string
          zip: string
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          is_default?: boolean
          state?: string
          street?: string
          street2?: string | null
          updated_at?: string
          user_id?: string
          zip?: string
        }
        Relationships: []
      }
      assessments: {
        Row: {
          created_at: string
          deposit_amount_cents: number | null
          deposit_paid_at: string | null
          deposit_status: string
          description: string | null
          guest_email: string | null
          id: string
          pairs: Json
          proposal_token: string
          proposed_services: Json
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          deposit_amount_cents?: number | null
          deposit_paid_at?: string | null
          deposit_status?: string
          description?: string | null
          guest_email?: string | null
          id?: string
          pairs?: Json
          proposal_token?: string
          proposed_services?: Json
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          deposit_amount_cents?: number | null
          deposit_paid_at?: string | null
          deposit_status?: string
          description?: string | null
          guest_email?: string | null
          id?: string
          pairs?: Json
          proposal_token?: string
          proposed_services?: Json
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      bag_items: {
        Row: {
          created_at: string
          id: string
          pair_id: string
          price_at_add_cents: number
          service_id: string
          service_name_at_add: string
          shoe_type_at_add: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pair_id: string
          price_at_add_cents: number
          service_id: string
          service_name_at_add: string
          shoe_type_at_add: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pair_id?: string
          price_at_add_cents?: number
          service_id?: string
          service_name_at_add?: string
          shoe_type_at_add?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bag_items_pair_id_fkey"
            columns: ["pair_id"]
            isOneToOne: false
            referencedRelation: "pairs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bag_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string | null
          body: string
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          published_at: string
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      coverage_requests: {
        Row: {
          created_at: string
          email: string | null
          id: string
          zip_code: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          zip_code: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          zip_code?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          pair_snapshot: Json
          price_cents: number
          service_snapshot: Json
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          pair_snapshot: Json
          price_cents: number
          service_snapshot: Json
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          pair_snapshot?: Json
          price_cents?: number
          service_snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          contact_email: string
          contact_phone: string
          courier_fee_cents: number
          created_at: string
          delivery_address: Json | null
          delivery_method: string
          id: string
          order_number: string
          paid_at: string | null
          payment_method_snapshot: Json | null
          payment_status: string
          placed_at: string
          repairs_subtotal_cents: number
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          tax_cents: number
          total_cents: number
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_email: string
          contact_phone: string
          courier_fee_cents?: number
          created_at?: string
          delivery_address?: Json | null
          delivery_method: string
          id?: string
          order_number?: string
          paid_at?: string | null
          payment_method_snapshot?: Json | null
          payment_status?: string
          placed_at?: string
          repairs_subtotal_cents: number
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          tax_cents?: number
          total_cents: number
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_email?: string
          contact_phone?: string
          courier_fee_cents?: number
          created_at?: string
          delivery_address?: Json | null
          delivery_method?: string
          id?: string
          order_number?: string
          paid_at?: string | null
          payment_method_snapshot?: Json | null
          payment_status?: string
          placed_at?: string
          repairs_subtotal_cents?: number
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          tax_cents?: number
          total_cents?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pairs: {
        Row: {
          brand: string | null
          colors: string[]
          created_at: string
          description: string | null
          id: string
          shoe_type: string
          user_id: string
        }
        Insert: {
          brand?: string | null
          colors?: string[]
          created_at?: string
          description?: string | null
          id?: string
          shoe_type: string
          user_id: string
        }
        Update: {
          brand?: string | null
          colors?: string[]
          created_at?: string
          description?: string | null
          id?: string
          shoe_type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          billing_address_id: string | null
          card_brand: string
          card_last4: string
          cardholder_name: string | null
          created_at: string
          exp_month: number
          exp_year: number
          id: string
          is_default: boolean
          stripe_payment_method_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_address_id?: string | null
          card_brand: string
          card_last4: string
          cardholder_name?: string | null
          created_at?: string
          exp_month: number
          exp_year: number
          id?: string
          is_default?: boolean
          stripe_payment_method_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_address_id?: string | null
          card_brand?: string
          card_last4?: string
          cardholder_name?: string | null
          created_at?: string
          exp_month?: number
          exp_year?: number
          id?: string
          is_default?: boolean
          stripe_payment_method_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_billing_address_id_fkey"
            columns: ["billing_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reworks: {
        Row: {
          created_at: string
          description: string
          id: string
          order_id: string
          services_in_scope: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          order_id: string
          services_in_scope?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          order_id?: string
          services_in_scope?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reworks_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_pricing: {
        Row: {
          id: string
          price_cents: number
          service_id: string
          shoe_type: string
        }
        Insert: {
          id?: string
          price_cents: number
          service_id: string
          shoe_type: string
        }
        Update: {
          id?: string
          price_cents?: number
          service_id?: string
          shoe_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_pricing_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_variants: {
        Row: {
          created_at: string
          id: string
          premium_cents: number | null
          rank: number
          service_id: string
          standard_cents: number
          variant_key: string
          variant_label: string
        }
        Insert: {
          created_at?: string
          id?: string
          premium_cents?: number | null
          rank?: number
          service_id: string
          standard_cents: number
          variant_key: string
          variant_label?: string
        }
        Update: {
          created_at?: string
          id?: string
          premium_cents?: number | null
          rank?: number
          service_id?: string
          standard_cents?: number
          variant_key?: string
          variant_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_variants_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_votes: {
        Row: {
          created_at: string
          id: string
          service_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          service_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          service_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_votes_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          base_price_cents: number | null
          card_name: string | null
          card_price_label: string | null
          categories: string[]
          created_at: string
          eligible_shoe_types: string[]
          full_description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_coming_soon: boolean
          name: string
          notes: string | null
          popularity_rank: number
          qa_config: Json | null
          short_description: string | null
          slug: string
          turnaround_days: number | null
          updated_at: string
        }
        Insert: {
          base_price_cents?: number | null
          card_name?: string | null
          card_price_label?: string | null
          categories?: string[]
          created_at?: string
          eligible_shoe_types?: string[]
          full_description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_coming_soon?: boolean
          name: string
          notes?: string | null
          popularity_rank?: number
          qa_config?: Json | null
          short_description?: string | null
          slug: string
          turnaround_days?: number | null
          updated_at?: string
        }
        Update: {
          base_price_cents?: number | null
          card_name?: string | null
          card_price_label?: string | null
          categories?: string[]
          created_at?: string
          eligible_shoe_types?: string[]
          full_description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_coming_soon?: boolean
          name?: string
          notes?: string | null
          popularity_rank?: number
          qa_config?: Json | null
          short_description?: string | null
          slug?: string
          turnaround_days?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_security: {
        Row: {
          failed_attempts: number
          last_failed_at: string | null
          locked_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          failed_attempts?: number
          last_failed_at?: string | null
          locked_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          failed_attempts?: number
          last_failed_at?: string | null
          locked_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _invoke_edge_function: {
        Args: { _name: string; _payload: Json }
        Returns: number
      }
      generate_order_number: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_account_locked: { Args: { _email: string }; Returns: boolean }
      record_failed_signin: { Args: { _email: string }; Returns: Json }
      reset_failed_attempts: { Args: { _user_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
