export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          plan: string;
          trial_ends_at: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name?: string | null;
          plan?: string;
          trial_ends_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
      };
      brands: {
        Row: {
          id: string;
          user_id: string;
          name: string | null;
          url: string | null;
          voice_profile: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name?: string | null;
          url?: string | null;
          voice_profile?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["brands"]["Insert"]>;
      };
      team_members: {
        Row: {
          id: string;
          brand_id: string;
          role: string;
          system_prompt: string;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          role: string;
          system_prompt: string;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["team_members"]["Insert"]>;
      };
      conversations: {
        Row: {
          id: string;
          user_id: string;
          agent_id: string;
          messages: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          agent_id: string;
          messages?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["conversations"]["Insert"]>;
      };
      content_ideas: {
        Row: {
          id: string;
          brand_id: string;
          title: string;
          status: string;
          platforms: string[];
          scheduled_at: string | null;
          content: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          title: string;
          status?: string;
          platforms?: string[];
          scheduled_at?: string | null;
          content?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["content_ideas"]["Insert"]>;
      };
      automations: {
        Row: {
          id: string;
          brand_id: string;
          type: string;
          config: Json;
          is_active: boolean;
          last_run: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          type: string;
          config?: Json;
          is_active?: boolean;
          last_run?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["automations"]["Insert"]>;
      };
      integrations: {
        Row: {
          id: string;
          brand_id: string;
          platform: string;
          credentials: Json;
          is_connected: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          platform: string;
          credentials?: Json;
          is_connected?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["integrations"]["Insert"]>;
      };
      generated_images: {
        Row: {
          id: string;
          brand_id: string;
          prompt: string;
          image_urls: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          prompt: string;
          image_urls?: string[];
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["generated_images"]["Insert"]>;
      };
      goals: {
        Row: {
          id: string;
          brand_id: string;
          title: string;
          description: string | null;
          target_value: number | null;
          current_value: number | null;
          unit: string | null;
          deadline: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          title: string;
          description?: string | null;
          target_value?: number | null;
          current_value?: number | null;
          unit?: string | null;
          deadline?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["goals"]["Insert"]>;
      };
      usage_limits: {
        Row: {
          id: string;
          user_id: string;
          feature: string;
          used_count: number;
          limit_count: number;
          reset_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          feature: string;
          used_count?: number;
          limit_count: number;
          reset_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["usage_limits"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type BrandPersona = {
  name: string;
  role: string;
  description: string;
  goals: string[];
  painPoints: string[];
};

export type BrandCompetitor = {
  name: string;
  description: string;
  strengths: string[];
  weaknesses: string[];
};

export type DigitalStrategyItem = {
  channel: string;
  recommendation: string;
};

export type VoiceProfile = {
  tone: string[];
  personality: string[];
  wordPreferences: { preferred: string[]; avoid: string[] };
  audience: string;
  colors: string[];
  fonts: string[];
  summary: string;
  // Brand-advisor (AI Görünürlük) extended analysis — optional for backward compatibility.
  industry?: string;
  tagline?: string;
  positioning?: string;
  valueProposition?: string;
  valuePropositionPoints?: string[];
  targetSegment?: string;
  segments?: string[];
  competitors?: BrandCompetitor[];
  personas?: BrandPersona[];
  digitalStrategy?: DigitalStrategyItem[];
};

export type AgentId = "ticos" | "social" | "blog" | "sales" | "email";

export type ContentStatus =
  | "pending_approval"
  | "approved"
  | "expanded"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed";

export type Plan = "trial" | "starter" | "pro" | "agency";
