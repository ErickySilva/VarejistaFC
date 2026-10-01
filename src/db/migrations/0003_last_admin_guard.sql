-- Proteção do último admin (ADR 0011).
--
-- Nenhuma transação que altere `users` pode terminar sem pelo menos um admin
-- ativo (papel 'admin' e conta não desativada). Vale para qualquer caminho:
-- rebaixar, desativar, apagar, ou criar contas antes de existir um admin.
--
-- É um gatilho de constraint adiado: a verificação acontece no COMMIT. Assim
-- uma única transação pode promover um novo admin e rebaixar o anterior, em
-- qualquer ordem.
--
-- O advisory lock serializa as verificações. Sem ele, duas transações
-- simultâneas poderiam rebaixar um admin cada uma, cada qual enxergando o
-- outro ainda como admin, e o sistema ficaria sem nenhum.
CREATE FUNCTION assert_active_admin_exists() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('users_at_least_one_admin'));

  IF NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin' AND NOT banned) THEN
    RAISE EXCEPTION 'O sistema precisa de pelo menos um administrador ativo.'
      USING ERRCODE = 'check_violation', CONSTRAINT = 'users_at_least_one_admin';
  END IF;

  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER users_at_least_one_admin
  AFTER INSERT OR DELETE OR UPDATE OF role, banned ON users
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION assert_active_admin_exists();
