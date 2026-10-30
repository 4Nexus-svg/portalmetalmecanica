/**
 * Colunas de `posts` usadas nos cards e listagens. Não inclui `content` (o
 * corpo da matéria), que é o campo pesado — buscar com select("*") em listas
 * multiplicava o egress do Supabase.
 */
export const POST_CARD_COLUNAS =
  "id, slug, title, excerpt, featured_image, category, region, published_at, is_exclusive, fonte_nome";
