export type HyperFormFieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'number'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'date'

export type HyperFormField = {
  id: string
  label: string
  type: HyperFormFieldType
  required: boolean
  placeholder?: string
  options?: string[]
  maps_to?: 'first_name' | 'last_name' | 'email' | 'phone' | 'company' | null
}

export type HyperFormLayout = 'card' | 'single-page' | 'multi-step'

export type HyperFormBorderRadius = 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full'

export type HyperFormButtonStyle = 'solid' | 'outline' | 'soft'

export type HyperFormFontFamily =
  | 'Inter'
  | 'Open Sans'
  | 'Roboto'
  | 'Poppins'
  | 'Lora'
  | 'Playfair Display'
  | 'Space Grotesk'
  | 'system'

export type HyperFormTheme = {
  primaryColor: string
  backgroundColor: string
  textColor: string
  fontFamily: HyperFormFontFamily
  borderRadius: HyperFormBorderRadius
  buttonStyle: HyperFormButtonStyle
}

export type HyperFormBranding = {
  logoUrl: string | null
  coverUrl: string | null
  backgroundUrl: string | null
  submitText: string
  successTitle: string
  successMessage: string
  showBadge: boolean
}

export const DEFAULT_FORM_THEME: HyperFormTheme = {
  primaryColor: '#6366f1',
  backgroundColor: '#0b0b12',
  textColor: '#f4f4f5',
  fontFamily: 'Inter',
  borderRadius: 'lg',
  buttonStyle: 'solid',
}

export const DEFAULT_FORM_BRANDING: HyperFormBranding = {
  logoUrl: null,
  coverUrl: null,
  backgroundUrl: null,
  submitText: 'Submit',
  successTitle: 'Thank you!',
  successMessage: 'Your response has been submitted. We will be in touch soon.',
  showBadge: true,
}

// ── Email signature ──────────────────────────────────────────────────────────
export type SignatureStyle = 'minimal' | 'modern' | 'classic'
export type SignatureMode = 'structured' | 'image'

export type EmailSignature = {
  mode: SignatureMode
  fullName: string
  title: string
  company: string
  email: string
  phone: string
  website: string
  linkedinUrl: string
  twitterUrl: string
  style: SignatureStyle
  primaryColor: string
  imageUrl: string
  imageWidth: number
}

export const DEFAULT_EMAIL_SIGNATURE: EmailSignature = {
  mode: 'structured',
  fullName: '',
  title: '',
  company: '',
  email: '',
  phone: '',
  website: '',
  linkedinUrl: '',
  twitterUrl: '',
  style: 'modern',
  primaryColor: '#6366f1',
  imageUrl: '',
  imageWidth: 400,
}

// ── Communications (email / SMS / WhatsApp) ─────────────────────────────────
export type MessageChannel = 'email' | 'sms' | 'whatsapp'

export type MessageDirection = 'outbound' | 'inbound'

export type ConversationStatus = 'open' | 'closed'

export type EmailDomainStatus =
  | 'pending'
  | 'verified'
  | 'failed'
  | 'temporary_failure'

export type MessageStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'bounced'
  | 'failed'
  | 'received'

export type BroadcastStatus = 'draft' | 'sending' | 'sent' | 'partial_failure'

export type BroadcastRecipientStatus = 'pending' | 'sent' | 'failed'

export type Database = {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string
          name: string
          slug: string
          email_signature: Record<string, any>
          inbound_email: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          email_signature?: Record<string, any>
          inbound_email?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          email_signature?: Record<string, any>
          inbound_email?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      meta_integrations: {
        Row: {
          id: string
          workspace_id: string
          page_id: string
          page_access_token: string
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          page_id: string
          page_access_token: string
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          page_id?: string
          page_access_token?: string
          created_at?: string
        }
        Relationships: []
      }
      meta_webhook_failures: {
        Row: {
          id: string
          leadgen_id: string
          page_id: string | null
          attempts: number
          last_error: string | null
          next_retry_at: string
          resolved: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          leadgen_id: string
          page_id?: string | null
          attempts?: number
          last_error?: string | null
          next_retry_at?: string
          resolved?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          leadgen_id?: string
          page_id?: string | null
          attempts?: number
          last_error?: string | null
          next_retry_at?: string
          resolved?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          id: string
          user_id: string
          workspace_id: string
          role: 'MASTER' | 'ADMIN' | 'ASSOCIATE'
          joined_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          user_id: string
          workspace_id: string
          role: 'MASTER' | 'ADMIN' | 'ASSOCIATE'
          joined_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          workspace_id?: string
          role?: 'MASTER' | 'ADMIN' | 'ASSOCIATE'
          joined_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'workspace_members_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'workspace_members_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          workspace_id: string
          type: 'workspace_invitation' | 'role_changed' | 'workspace_created' | 'mention' | 'system' | 'inbound_email'
          title: string
          content: string
          link: string | null
          read: boolean
          created_at: string
          read_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          workspace_id: string
          type: 'workspace_invitation' | 'role_changed' | 'workspace_created' | 'mention' | 'system' | 'inbound_email'
          title: string
          content: string
          link?: string | null
          read?: boolean
          created_at?: string
          read_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          workspace_id?: string
          type?: 'workspace_invitation' | 'role_changed' | 'workspace_created' | 'mention' | 'system' | 'inbound_email'
          title?: string
          content?: string
          link?: string | null
          read?: boolean
          created_at?: string
          read_at?: string | null
        }
        Relationships: []
      }
      invitations: {
        Row: {
          id: string
          workspace_id: string
          invited_by: string
          email: string
          role: 'MASTER' | 'ADMIN' | 'ASSOCIATE'
          token: string
          accepted_at: string | null
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          invited_by: string
          email: string
          role?: 'MASTER' | 'ADMIN' | 'ASSOCIATE'
          token?: string
          accepted_at?: string | null
          expires_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          invited_by?: string
          email?: string
          role?: 'MASTER' | 'ADMIN' | 'ASSOCIATE'
          token?: string
          accepted_at?: string | null
          expires_at?: string
          created_at?: string
        }
        Relationships: []
      }
      hyperforms: {
        Row: {
          id: string
          workspace_id: string
          name: string
          description: string | null
          fields: HyperFormField[]
          is_active: boolean
          theme: HyperFormTheme
          layout: HyperFormLayout
          branding: HyperFormBranding
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          description?: string | null
          fields?: HyperFormField[]
          is_active?: boolean
          theme?: HyperFormTheme
          layout?: HyperFormLayout
          branding?: HyperFormBranding
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          description?: string | null
          fields?: HyperFormField[]
          is_active?: boolean
          theme?: HyperFormTheme
          layout?: HyperFormLayout
          branding?: HyperFormBranding
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      hyperform_submissions: {
        Row: {
          id: string
          form_id: string
          workspace_id: string
          contact_id: string | null
          answers: Record<string, any>
          status: 'Lead' | 'Prospect' | 'Customer' | 'Churned'
          submitted_at: string
        }
        Insert: {
          id?: string
          form_id: string
          workspace_id: string
          contact_id?: string | null
          answers: Record<string, any>
          status?: 'Lead' | 'Prospect' | 'Customer' | 'Churned'
          submitted_at?: string
        }
        Update: {
          id?: string
          form_id?: string
          workspace_id?: string
          contact_id?: string | null
          answers?: Record<string, any>
          status?: 'Lead' | 'Prospect' | 'Customer' | 'Churned'
          submitted_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          id: string
          workspace_id: string
          contact_id: string
          channel: MessageChannel
          subject: string | null
          status: ConversationStatus
          last_message_at: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          contact_id: string
          channel?: MessageChannel
          subject?: string | null
          status?: ConversationStatus
          last_message_at?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          contact_id?: string
          channel?: MessageChannel
          subject?: string | null
          status?: ConversationStatus
          last_message_at?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          workspace_id: string
          contact_id: string | null
          channel: MessageChannel
          direction: MessageDirection
          from_addr: string | null
          to_addr: string | null
          subject: string | null
          body_html: string | null
          body_text: string | null
          provider: string | null
          provider_message_id: string | null
          status: MessageStatus
          error: string | null
          metadata: Record<string, any>
          attachments: Record<string, any>[]
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          workspace_id: string
          contact_id?: string | null
          channel?: MessageChannel
          direction: MessageDirection
          from_addr?: string | null
          to_addr?: string | null
          subject?: string | null
          body_html?: string | null
          body_text?: string | null
          provider?: string | null
          provider_message_id?: string | null
          status?: MessageStatus
          error?: string | null
          metadata?: Record<string, any>
          attachments?: Record<string, any>[]
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          workspace_id?: string
          contact_id?: string | null
          channel?: MessageChannel
          direction?: MessageDirection
          from_addr?: string | null
          to_addr?: string | null
          subject?: string | null
          body_html?: string | null
          body_text?: string | null
          provider?: string | null
          provider_message_id?: string | null
          status?: MessageStatus
          error?: string | null
          metadata?: Record<string, any>
          attachments?: Record<string, any>[]
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      workspace_email_domains: {
        Row: {
          id: string
          workspace_id: string
          domain: string
          resend_domain_id: string
          region: string
          from_name: string | null
          from_email: string
          status: EmailDomainStatus
          dns_records: any[]
          is_default: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          domain: string
          resend_domain_id: string
          region?: string
          from_name?: string | null
          from_email: string
          status?: EmailDomainStatus
          dns_records?: any[]
          is_default?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          domain?: string
          resend_domain_id?: string
          region?: string
          from_name?: string | null
          from_email?: string
          status?: EmailDomainStatus
          dns_records?: any[]
          is_default?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      broadcasts: {
        Row: {
          id: string
          workspace_id: string
          subject: string
          body_html: string
          body_text: string
          recipient_count: number
          sent_count: number
          failed_count: number
          status: BroadcastStatus
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          subject: string
          body_html: string
          body_text?: string
          recipient_count?: number
          sent_count?: number
          failed_count?: number
          status?: BroadcastStatus
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          subject?: string
          body_html?: string
          body_text?: string
          recipient_count?: number
          sent_count?: number
          failed_count?: number
          status?: BroadcastStatus
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      broadcast_recipients: {
        Row: {
          id: string
          broadcast_id: string
          workspace_id: string
          contact_id: string
          message_id: string | null
          status: BroadcastRecipientStatus
          error: string | null
          sent_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          broadcast_id: string
          workspace_id: string
          contact_id: string
          message_id?: string | null
          status?: BroadcastRecipientStatus
          error?: string | null
          sent_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          broadcast_id?: string
          workspace_id?: string
          contact_id?: string
          message_id?: string | null
          status?: BroadcastRecipientStatus
          error?: string | null
          sent_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      checklists: {
        Row: {
          id: string
          workspace_id: string
          name: string
          description: string | null
          banner_image: string | null
          passcode: string
          is_active: boolean
          allow_editing: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          description?: string | null
          banner_image?: string | null
          passcode: string
          is_active?: boolean
          allow_editing?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          description?: string | null
          banner_image?: string | null
          passcode?: string
          is_active?: boolean
          allow_editing?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      checklist_items: {
        Row: {
          id: string
          checklist_id: string
          label: string
          quantity: string | null
          fields: Record<string, any>[]
          sort_order: number
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          checklist_id: string
          label: string
          quantity?: string | null
          fields?: Record<string, any>[]
          sort_order?: number
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          checklist_id?: string
          label?: string
          quantity?: string | null
          fields?: Record<string, any>[]
          sort_order?: number
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      checklist_participants: {
        Row: {
          id: string
          checklist_id: string
          display_name: string
          avatar_color: string
          created_at: string
        }
        Insert: {
          id?: string
          checklist_id: string
          display_name: string
          avatar_color?: string
          created_at?: string
        }
        Update: {
          id?: string
          checklist_id?: string
          display_name?: string
          avatar_color?: string
          created_at?: string
        }
        Relationships: []
      }
      checklist_checks: {
        Row: {
          id: string
          item_id: string
          participant_id: string
          checked_at: string
        }
        Insert: {
          id?: string
          item_id: string
          participant_id: string
          checked_at?: string
        }
        Update: {
          id?: string
          item_id?: string
          participant_id?: string
          checked_at?: string
        }
        Relationships: []
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
