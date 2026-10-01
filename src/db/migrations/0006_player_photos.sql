-- Fotos reais dos quatro jogadores iniciais. Os arquivos ficam em
-- public/players/. Só preenche quem ainda não tem foto: uma foto trocada
-- depois por um admin não é sobrescrita.
UPDATE players SET photo_url = '/players/ericky.webp' WHERE slug = 'ericky' AND photo_url IS NULL;
--> statement-breakpoint
UPDATE players SET photo_url = '/players/lucao.webp' WHERE slug = 'lucao' AND photo_url IS NULL;
--> statement-breakpoint
UPDATE players SET photo_url = '/players/felp.webp' WHERE slug = 'felp' AND photo_url IS NULL;
--> statement-breakpoint
UPDATE players SET photo_url = '/players/heit.webp' WHERE slug = 'heit' AND photo_url IS NULL;
