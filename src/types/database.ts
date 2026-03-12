export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          agency_name: string | null
          onboarding_completed: boolean
          onboarding_step: number
          dedup_rule: string
          scan_keywords: string[] | null
          scan_locations: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          agency_name?: string | null
          onboarding_completed?: boolean
          onboarding_step?: number
          dedup_rule?: string
          scan_keywords?: string[] | null
          scan_locations?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          agency_name?: string | null
          onboarding_completed?: boolean
          onboarding_step?: number
          dedup_rule?: string
          scan_keywords?: string[] | null
          scan_locations?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_connections: {
        Row: {
          id: string
          user_id: string
          provider: string
          access_token: string
          refresh_token: string | null
          provider_metadata: Json
          connected_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          provider: string
          access_token: string
          refresh_token?: string | null
          provider_metadata?: Json
          connected_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          provider?: string
          access_token?: string
          refresh_token?: string | null
          provider_metadata?: Json
          connected_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          id: string
          user_id: string
          name: string
          domain: string | null
          industry: string | null
          size_range: string | null
          location: string | null
          website: string | null
          salesforce_account_id: string | null
          source: 'salesforce' | 'manual' | 'scraped'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          domain?: string | null
          industry?: string | null
          size_range?: string | null
          location?: string | null
          website?: string | null
          salesforce_account_id?: string | null
          source: 'salesforce' | 'manual' | 'scraped'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          domain?: string | null
          industry?: string | null
          size_range?: string | null
          location?: string | null
          website?: string | null
          salesforce_account_id?: string | null
          source?: 'salesforce' | 'manual' | 'scraped'
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          id: string
          user_id: string
          company_id: string | null
          first_name: string | null
          last_name: string | null
          email: string | null
          phone: string | null
          title: string | null
          seniority: string | null
          linkedin_url: string | null
          salesforce_contact_id: string | null
          apollo_id: string | null
          source: 'salesforce' | 'apollo' | 'hunter' | 'manual'
          enriched_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_id?: string | null
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          phone?: string | null
          title?: string | null
          seniority?: string | null
          linkedin_url?: string | null
          salesforce_contact_id?: string | null
          apollo_id?: string | null
          source: 'salesforce' | 'apollo' | 'hunter' | 'manual'
          enriched_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_id?: string | null
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          phone?: string | null
          title?: string | null
          seniority?: string | null
          linkedin_url?: string | null
          salesforce_contact_id?: string | null
          apollo_id?: string | null
          source?: 'salesforce' | 'apollo' | 'manual'
          enriched_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      job_posts: {
        Row: {
          id: string
          user_id: string
          company_id: string | null
          title: string
          description: string | null
          url: string | null
          location: string | null
          source: 'serpapi' | 'manual'
          posted_date: string | null
          detected_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          company_id?: string | null
          title: string
          description?: string | null
          url?: string | null
          location?: string | null
          source: 'serpapi' | 'manual'
          posted_date?: string | null
          detected_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          company_id?: string | null
          title?: string
          description?: string | null
          url?: string | null
          location?: string | null
          source?: 'serpapi' | 'manual'
          posted_date?: string | null
          detected_at?: string
          created_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          id: string
          user_id: string
          contact_id: string | null
          company_id: string | null
          job_post_id: string | null
          score: number
          score_reasons: Json
          priority_rank: number | null
          status: 'new' | 'contacted' | 'replied' | 'qualified' | 'disqualified'
          is_duplicate: boolean
          duplicate_of: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          contact_id?: string | null
          company_id?: string | null
          job_post_id?: string | null
          score: number
          score_reasons: Json
          priority_rank?: number | null
          status: 'new' | 'contacted' | 'replied' | 'qualified' | 'disqualified'
          is_duplicate?: boolean
          duplicate_of?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          contact_id?: string | null
          company_id?: string | null
          job_post_id?: string | null
          score?: number
          score_reasons?: Json
          priority_rank?: number | null
          status?: 'new' | 'contacted' | 'replied' | 'qualified' | 'disqualified'
          is_duplicate?: boolean
          duplicate_of?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_drafts: {
        Row: {
          id: string
          user_id: string
          lead_id: string
          subject: string
          body: string
          template_used: string | null
          status: 'draft' | 'sent' | 'opened' | 'replied' | 'bounced'
          sent_at: string | null
          opened_at: string | null
          replied_at: string | null
          gmail_message_id: string | null
          gmail_thread_id: string | null
          salesforce_task_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          lead_id: string
          subject: string
          body: string
          template_used?: string | null
          status?: 'draft' | 'sent' | 'opened' | 'replied' | 'bounced'
          sent_at?: string | null
          opened_at?: string | null
          replied_at?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          salesforce_task_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          lead_id?: string
          subject?: string
          body?: string
          template_used?: string | null
          status?: 'draft' | 'sent' | 'opened' | 'replied' | 'bounced'
          sent_at?: string | null
          opened_at?: string | null
          replied_at?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          salesforce_task_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// Convenience row types
export type UserRow = Database['public']['Tables']['users']['Row']
export type CrmConnectionRow = Database['public']['Tables']['crm_connections']['Row']
export type CompanyRow = Database['public']['Tables']['companies']['Row']
export type ContactRow = Database['public']['Tables']['contacts']['Row']
export type JobPostRow = Database['public']['Tables']['job_posts']['Row']
export type LeadRow = Database['public']['Tables']['leads']['Row']
export type EmailDraftRow = Database['public']['Tables']['email_drafts']['Row']

// Lead with joined relations (for hit list view)
export type LeadWithRelations = LeadRow & {
  contact: ContactRow | null
  company: CompanyRow | null
  job_post: JobPostRow | null
  email_drafts: EmailDraftRow[]
}
