export type Database = {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string
          name: string
          slug: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          email: string
          workspace_id: string
          role: 'MASTER' | 'ADMIN' | 'ASSOCIATE'
          first_name: string | null
          last_name: string | null
          avatar_url: string | null
          password_change_required: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          workspace_id: string
          role?: 'MASTER' | 'ADMIN' | 'ASSOCIATE'
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          password_change_required?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          workspace_id?: string
          role?: 'MASTER' | 'ADMIN' | 'ASSOCIATE'
          first_name?: string | null
          last_name?: string | null
          avatar_url?: string | null
          password_change_required?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      contacts: {
        Row: {
          id: string
          workspace_id: string
          first_name: string
          last_name: string
          email: string
          phone: string | null
          company: string | null
          status: 'Lead' | 'Prospect' | 'Customer' | 'Churned'
          custom_fields: Record<string, any>
          created_at: string
          updated_at: string
          created_by: string | null
          assigned_to: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          first_name: string
          last_name: string
          email: string
          phone?: string | null
          company?: string | null
          status?: 'Lead' | 'Prospect' | 'Customer' | 'Churned'
          custom_fields?: Record<string, any>
          created_at?: string
          updated_at?: string
          created_by?: string | null
          assigned_to?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string
          first_name?: string
          last_name?: string
          email?: string
          phone?: string | null
          company?: string | null
          status?: 'Lead' | 'Prospect' | 'Customer' | 'Churned'
          custom_fields?: Record<string, any>
          created_at?: string
          updated_at?: string
          created_by?: string | null
          assigned_to?: string | null
        }
      }
      activities: {
        Row: {
          id: string
          contact_id: string
          workspace_id: string
          type: 'note' | 'email' | 'call' | 'meeting' | 'document' | 'status_change' | 'creation'
          title: string
          content: string | null
          metadata: Record<string, any>
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          contact_id: string
          workspace_id: string
          type: 'note' | 'email' | 'call' | 'meeting' | 'document' | 'status_change' | 'creation'
          title: string
          content?: string | null
          metadata?: Record<string, any>
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          contact_id?: string
          workspace_id?: string
          type?: 'note' | 'email' | 'call' | 'meeting' | 'document' | 'status_change' | 'creation'
          title?: string
          content?: string | null
          metadata?: Record<string, any>
          created_by?: string | null
          created_at?: string
        }
      }
      dashboard_layouts: {
        Row: {
          id: string
          user_id: string
          workspace_id: string
          widgets: any[]
          hidden_widgets: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          workspace_id: string
          widgets?: any[]
          hidden_widgets?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          workspace_id?: string
          widgets?: any[]
          hidden_widgets?: string[]
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: 'MASTER' | 'ADMIN' | 'ASSOCIATE'
      contact_status: 'Lead' | 'Prospect' | 'Customer' | 'Churned'
      activity_type: 'note' | 'email' | 'call' | 'meeting' | 'document' | 'status_change' | 'creation'
    }
  }
}
