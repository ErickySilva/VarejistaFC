-- Correção de dados: o histórico pré-sistema pertence à temporada FC 26, a
-- temporada atual do clube, e não à FC 25, onde a migration 0004 o colocou.
--
-- Nenhuma partida é criada. Os números do histórico não mudam; só a temporada
-- a que estão ligados.

-- 1. Move o histórico da FC 25 para a FC 26, quando as duas existem.
UPDATE legacy_stats AS l
SET season_id = current_season.id
FROM seasons AS current_season, seasons AS old_season
WHERE current_season.slug = 'fc-26'
  AND old_season.slug = 'fc-25'
  AND l.season_id = old_season.id;
--> statement-breakpoint

-- 2. A FC 25 foi criada pela migration 0004 só para abrigar o histórico. Se
--    ficou sem nenhum dado (sem histórico e sem gameplays), é removida, para
--    não aparecer como uma temporada vazia. Uma FC 25 com dados é preservada.
DELETE FROM seasons AS s
WHERE s.slug = 'fc-25'
  AND NOT s.is_active
  AND NOT EXISTS (SELECT 1 FROM legacy_stats l WHERE l.season_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM nights n WHERE n.season_id = s.id);
