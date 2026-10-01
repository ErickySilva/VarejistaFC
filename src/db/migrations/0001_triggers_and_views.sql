-- Regras que o Drizzle não expressa: gatilhos e views.
-- Ver docs/adr/0002, 0006 e 0007.

-- ---------------------------------------------------------------------------
-- 1. Totais da partida
--
-- Os gols e as assistências dos jogadores não podem ultrapassar o placar do
-- Varejista (podem ser menores: gols de bots). Os gols da disputa de pênaltis
-- ficam fora desta conta porque não fazem parte de goals_for.
--
-- É um gatilho de constraint adiado: a verificação acontece no COMMIT, para
-- que a partida e todas as participações possam ser gravadas ou corrigidas
-- em qualquer ordem dentro da mesma transação.
-- ---------------------------------------------------------------------------
CREATE FUNCTION check_match_totals() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_match_id integer;
  v_goals_for integer;
  v_goals integer;
  v_assists integer;
  v_max_contributions integer;
BEGIN
  IF TG_TABLE_NAME = 'matches' THEN
    v_match_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    v_match_id := OLD.match_id;
  ELSE
    v_match_id := NEW.match_id;
  END IF;

  SELECT goals_for INTO v_goals_for FROM matches WHERE id = v_match_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT
    coalesce(sum(goals), 0),
    coalesce(sum(assists), 0),
    coalesce(max(goals + assists), 0)
  INTO v_goals, v_assists, v_max_contributions
  FROM match_players
  WHERE match_id = v_match_id;

  IF v_goals > v_goals_for THEN
    RAISE EXCEPTION
      'Partida %: os jogadores somam % gols, mas o placar do Varejista é %.',
      v_match_id, v_goals, v_goals_for
      USING ERRCODE = 'check_violation', CONSTRAINT = 'match_totals_goals';
  END IF;

  IF v_assists > v_goals_for THEN
    RAISE EXCEPTION
      'Partida %: os jogadores somam % assistências, mas o placar do Varejista é %.',
      v_match_id, v_assists, v_goals_for
      USING ERRCODE = 'check_violation', CONSTRAINT = 'match_totals_assists';
  END IF;

  IF v_max_contributions > v_goals_for THEN
    RAISE EXCEPTION
      'Partida %: um jogador tem % participações em gols, mas o placar do Varejista é %.',
      v_match_id, v_max_contributions, v_goals_for
      USING ERRCODE = 'check_violation', CONSTRAINT = 'match_totals_contributions';
  END IF;

  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER match_players_check_totals
  AFTER INSERT OR UPDATE OR DELETE ON match_players
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_match_totals();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER matches_check_totals
  AFTER UPDATE OF goals_for ON matches
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_match_totals();
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2. Noite fechada
--
-- Partidas e participações de uma noite fechada não podem ser criadas,
-- alteradas nem removidas. Corrigir exige reabrir a noite.
--
-- O FOR SHARE na noite impede que ela seja fechada por outra transação
-- enquanto uma partida está sendo gravada.
-- ---------------------------------------------------------------------------
CREATE FUNCTION assert_night_is_open(p_night_id integer) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_status night_status;
BEGIN
  SELECT status INTO v_status FROM nights WHERE id = p_night_id FOR SHARE;

  IF v_status = 'closed' THEN
    RAISE EXCEPTION
      'A noite % está fechada. Reabra a noite para alterar suas partidas.',
      p_night_id
      USING ERRCODE = 'check_violation', CONSTRAINT = 'night_is_closed';
  END IF;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION guard_closed_night_matches() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM assert_night_is_open(OLD.night_id);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.night_id <> OLD.night_id THEN
    PERFORM assert_night_is_open(NEW.night_id);
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER matches_guard_closed_night
  BEFORE INSERT OR UPDATE OR DELETE ON matches
  FOR EACH ROW EXECUTE FUNCTION guard_closed_night_matches();
--> statement-breakpoint
CREATE FUNCTION guard_closed_night_match_players() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM assert_night_is_open(
      (SELECT night_id FROM matches WHERE id = OLD.match_id)
    );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' OR NEW.match_id <> OLD.match_id THEN
    PERFORM assert_night_is_open(
      (SELECT night_id FROM matches WHERE id = NEW.match_id)
    );
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER match_players_guard_closed_night
  BEFORE INSERT OR UPDATE OR DELETE ON match_players
  FOR EACH ROW EXECUTE FUNCTION guard_closed_night_match_players();
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 3. Auditoria imutável
-- ---------------------------------------------------------------------------
CREATE FUNCTION forbid_audit_log_changes() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log é somente de inserção: % não é permitido.', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_log_forbid_row_changes
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION forbid_audit_log_changes();
--> statement-breakpoint
CREATE TRIGGER audit_log_forbid_truncate
  BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_audit_log_changes();
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 4. Views
--
-- Toda estatística sai daqui. Nenhum total é armazenado em tabela.
-- ---------------------------------------------------------------------------

-- Uma linha por participação em partida não excluída. Cada linha vale um jogo
-- para o jogador, inclusive com zero gols e zero assistências.
CREATE VIEW v_player_match AS
SELECT
  mp.player_id,
  mp.match_id,
  m.night_id,
  n.season_id,
  n.reference_date,
  date_trunc('month', n.reference_date)::date AS reference_month,
  m.sequence,
  m.played_at,
  m.opponent_id,
  m.match_type,
  m.goals_for,
  m.goals_against,
  m.went_to_penalties,
  m.result,
  mp."position",
  mp.goals,
  mp.assists,
  mp.goals + mp.assists AS goal_contributions,
  mp.rating,
  mp.rating_version,
  mp."position" = 'GOL' AS is_goalkeeper,
  mp.saves,
  mp.penalties_saved,
  CASE WHEN mp."position" = 'GOL' THEN m.goals_against END AS goals_conceded,
  mp."position" = 'GOL' AND m.goals_against = 0 AS clean_sheet
FROM match_players mp
JOIN matches m ON m.id = mp.match_id AND m.deleted_at IS NULL
JOIN nights n ON n.id = m.night_id;
--> statement-breakpoint

-- Totais por jogador considerando apenas partidas registradas no sistema.
-- Jogadores sem nenhuma partida aparecem com zeros.
CREATE VIEW v_player_totals_system AS
SELECT
  p.id AS player_id,
  count(pm.match_id)::integer AS matches,
  coalesce(sum(pm.goals), 0)::integer AS goals,
  coalesce(sum(pm.assists), 0)::integer AS assists,
  coalesce(sum(pm.goal_contributions), 0)::integer AS goal_contributions,
  count(*) FILTER (WHERE pm.result = 'W')::integer AS wins,
  count(*) FILTER (WHERE pm.result = 'D')::integer AS draws,
  count(*) FILTER (WHERE pm.result = 'L')::integer AS losses,
  round(avg(pm.rating), 2) AS average_rating,
  count(*) FILTER (WHERE pm.is_goalkeeper)::integer AS goalkeeper_matches,
  coalesce(sum(pm.saves), 0)::integer AS saves,
  coalesce(sum(pm.penalties_saved), 0)::integer AS penalties_saved,
  coalesce(sum(pm.goals_conceded), 0)::integer AS goals_conceded,
  count(*) FILTER (WHERE pm.clean_sheet)::integer AS clean_sheets
FROM players p
LEFT JOIN v_player_match pm ON pm.player_id = p.id
GROUP BY p.id;
--> statement-breakpoint

-- Total geral: sistema + histórico pré-sistema, com as parcelas separadas.
-- legacy_clean_sheets nulo significa "não anotado" e soma como zero no total.
CREATE VIEW v_player_totals_overall AS
SELECT
  s.player_id,
  s.matches AS system_matches,
  coalesce(l.matches, 0) AS legacy_matches,
  s.matches + coalesce(l.matches, 0) AS total_matches,
  s.goals AS system_goals,
  coalesce(l.goals, 0) AS legacy_goals,
  s.goals + coalesce(l.goals, 0) AS total_goals,
  s.assists AS system_assists,
  coalesce(l.assists, 0) AS legacy_assists,
  s.assists + coalesce(l.assists, 0) AS total_assists,
  s.goal_contributions AS system_goal_contributions,
  coalesce(l.goals + l.assists, 0) AS legacy_goal_contributions,
  s.goal_contributions + coalesce(l.goals + l.assists, 0) AS total_goal_contributions,
  s.clean_sheets AS system_clean_sheets,
  l.clean_sheets AS legacy_clean_sheets,
  s.clean_sheets + coalesce(l.clean_sheets, 0) AS total_clean_sheets
FROM v_player_totals_system s
LEFT JOIN legacy_stats l ON l.player_id = s.player_id;
