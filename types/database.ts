export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; email: string | null; name: string | null; cnpj: string | null; role: "admin" | "user"; created_at: string };
        Insert: { id: string; email?: string | null; name?: string | null; cnpj?: string | null; role?: "admin" | "user" };
        Update: { email?: string | null; name?: string | null; cnpj?: string | null; role?: "admin" | "user" };
      };
      posts: {
        Row: { id: number; slug: string; title: string; content: string | null; excerpt: string | null; featured_image: string | null; category: string | null; region: string | null; author_id: string | null; published_at: string | null; is_exclusive: boolean; created_at: string; fonte_url: string | null; fonte_nome: string | null; is_auto: boolean };
        Insert: { slug: string; title: string; content?: string | null; excerpt?: string | null; featured_image?: string | null; category?: string | null; region?: string | null; author_id?: string | null; published_at?: string | null; is_exclusive?: boolean; fonte_url?: string | null; fonte_nome?: string | null; is_auto?: boolean };
        Update: { slug?: string; title?: string; content?: string | null; excerpt?: string | null; featured_image?: string | null; category?: string | null; region?: string | null; published_at?: string | null; is_exclusive?: boolean; fonte_url?: string | null; fonte_nome?: string | null; is_auto?: boolean };
      };
      classifieds: {
        Row: { id: number; user_id: string; title: string; description: string | null; price: number | null; photos: string[] | null; city: string | null; state: string | null; category: string | null; status: "pending" | "active" | "expired" | "paid"; expires_at: string | null; payment_intent_id: string | null; created_at: string };
        Insert: { user_id: string; title: string; description?: string | null; price?: number | null; photos?: string[] | null; city?: string | null; state?: string | null; category?: string | null; status?: "pending" | "active" | "expired" | "paid"; expires_at?: string | null; payment_intent_id?: string | null };
        Update: { title?: string; description?: string | null; price?: number | null; photos?: string[] | null; city?: string | null; state?: string | null; category?: string | null; status?: "pending" | "active" | "expired" | "paid"; expires_at?: string | null; payment_intent_id?: string | null };
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
    };
  };
};
