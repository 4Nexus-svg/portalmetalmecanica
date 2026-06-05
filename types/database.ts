export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; email: string | null; name: string | null; cnpj: string | null; role: "admin" | "editor" | "comercial" | "colunista" | "user"; created_at: string };
        Insert: { id: string; email?: string | null; name?: string | null; cnpj?: string | null; role?: "admin" | "editor" | "comercial" | "colunista" | "user" };
        Update: { email?: string | null; name?: string | null; cnpj?: string | null; role?: "admin" | "editor" | "comercial" | "colunista" | "user" };
      };
      posts: {
        Row: { id: number; slug: string; title: string; content: string | null; excerpt: string | null; featured_image: string | null; category: string | null; region: string | null; author_id: string | null; published_at: string | null; is_exclusive: boolean; created_at: string; fonte_url: string | null; fonte_nome: string | null; is_auto: boolean };
        Insert: { slug: string; title: string; content?: string | null; excerpt?: string | null; featured_image?: string | null; category?: string | null; region?: string | null; author_id?: string | null; published_at?: string | null; is_exclusive?: boolean; fonte_url?: string | null; fonte_nome?: string | null; is_auto?: boolean };
        Update: { slug?: string; title?: string; content?: string | null; excerpt?: string | null; featured_image?: string | null; category?: string | null; region?: string | null; published_at?: string | null; is_exclusive?: boolean; fonte_url?: string | null; fonte_nome?: string | null; is_auto?: boolean };
      };
      classifieds: {
        Row: { id: number; user_id: string; title: string; description: string | null; price: number | null; photos: string[] | null; city: string | null; state: string | null; category: string | null; status: "pending" | "active" | "expired" | "paid" | "rejected"; expires_at: string | null; payment_intent_id: string | null; created_at: string; phone: string | null; whatsapp: string | null };
        Insert: { user_id: string; title: string; description?: string | null; price?: number | null; photos?: string[] | null; city?: string | null; state?: string | null; category?: string | null; status?: "pending" | "active" | "expired" | "paid" | "rejected"; expires_at?: string | null; payment_intent_id?: string | null; phone?: string | null; whatsapp?: string | null };
        Update: { title?: string; description?: string | null; price?: number | null; photos?: string[] | null; city?: string | null; state?: string | null; category?: string | null; status?: "pending" | "active" | "expired" | "paid" | "rejected"; expires_at?: string | null; payment_intent_id?: string | null; phone?: string | null; whatsapp?: string | null };
      };
      subscriptions: {
        Row: { id: string; user_id: string; status: "active" | "canceled" | "past_due" | "trialing"; plan: "monthly" | "yearly"; current_period_end: string; created_at: string };
        Insert: { id: string; user_id: string; status: "active" | "canceled" | "past_due" | "trialing"; plan: "monthly" | "yearly"; current_period_end: string };
        Update: { status?: "active" | "canceled" | "past_due" | "trialing"; plan?: "monthly" | "yearly"; current_period_end?: string };
      };
      ads: {
        Row: { id: number; name: string | null; image_url: string | null; link: string | null; position: "top" | "sidebar" | "between" | "footer" | null; start_date: string | null; end_date: string | null; impressions: number; clicks: number };
        Insert: { name?: string | null; image_url?: string | null; link?: string | null; position?: "top" | "sidebar" | "between" | "footer" | null; start_date?: string | null; end_date?: string | null };
        Update: { name?: string | null; image_url?: string | null; link?: string | null; position?: "top" | "sidebar" | "between" | "footer" | null; start_date?: string | null; end_date?: string | null; impressions?: number; clicks?: number };
      };
      subscribers: {
        Row: { email: string; created_at: string };
        Insert: { email: string };
        Update: never;
      };
      events: {
        Row: { id: number; slug: string; title: string; description: string | null; type: 'feira' | 'congresso' | 'seminario' | 'workshop' | 'treinamento'; date_start: string; date_end: string | null; city: string | null; state: string | null; organizer: string | null; image_url: string | null; is_auto: boolean; created_at: string };
        Insert: { slug: string; title: string; description?: string | null; type: 'feira' | 'congresso' | 'seminario' | 'workshop' | 'treinamento'; date_start: string; date_end?: string | null; city?: string | null; state?: string | null; organizer?: string | null; image_url?: string | null; is_auto?: boolean };
        Update: { title?: string; description?: string | null; type?: 'feira' | 'congresso' | 'seminario' | 'workshop' | 'treinamento'; date_start?: string; date_end?: string | null; city?: string | null; state?: string | null; organizer?: string | null; image_url?: string | null };
      };
      columnists: {
        Row: { id: number; nome: string; slug: string; cargo: string | null; especialidade: string | null; bio: string | null; iniciais: string | null; cor: string | null; foto_url: string | null; ativo: boolean; profile_id: string | null; created_at: string };
        Insert: { nome: string; slug: string; cargo?: string | null; especialidade?: string | null; bio?: string | null; iniciais?: string | null; cor?: string | null; foto_url?: string | null; ativo?: boolean; profile_id?: string | null };
        Update: { nome?: string; slug?: string; cargo?: string | null; especialidade?: string | null; bio?: string | null; iniciais?: string | null; cor?: string | null; foto_url?: string | null; ativo?: boolean; profile_id?: string | null };
      };
      indicadores_snapshots: {
        Row: { id: number; slug: string; value: number; variation: number | null; raw_data: Record<string, unknown> | null; captured_at: string };
        Insert: { slug: string; value: number; variation?: number | null; raw_data?: Record<string, unknown> | null; captured_at?: string };
        Update: { value?: number; variation?: number | null; raw_data?: Record<string, unknown> | null };
      };
      indicadores_config: {
        Row: { slug: string; name: string; group_name: string; unit: string; decimals: number; frequency: string; source_label: string; source_url: string | null; description: string | null; active: boolean };
        Insert: { slug: string; name: string; group_name: string; unit: string; decimals?: number; frequency: string; source_label: string; source_url?: string | null; description?: string | null; active?: boolean };
        Update: { name?: string; group_name?: string; unit?: string; decimals?: number; frequency?: string; source_label?: string; source_url?: string | null; description?: string | null; active?: boolean };
      };
      featured_companies: {
        Row: { id: number; name: string; logo_url: string | null; link: string | null; description: string | null; ordem: number; ativo: boolean; start_date: string | null; end_date: string | null; created_at: string };
        Insert: { name: string; logo_url?: string | null; link?: string | null; description?: string | null; ordem?: number; ativo?: boolean; start_date?: string | null; end_date?: string | null };
        Update: { name?: string; logo_url?: string | null; link?: string | null; description?: string | null; ordem?: number; ativo?: boolean; start_date?: string | null; end_date?: string | null };
      };
    };
  };
};
