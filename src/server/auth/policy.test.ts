import { describe, expect, it } from "vitest";
import { can, type Actor, type Permission } from "./policy";

function actor(overrides: Partial<Actor>): Actor {
  return {
    userId: "u1",
    role: "player",
    playerId: null,
    name: "Teste",
    email: "teste@test.dev",
    ...overrides,
  };
}

const admin = actor({ role: "admin" });
const linkedPlayer = actor({ playerId: 7 });
const unlinkedPlayer = actor({ playerId: null });

const ownPhoto: Permission = { action: "players.edit-photo", playerId: 7 };
const otherPhoto: Permission = { action: "players.edit-photo", playerId: 8 };

// Tabela de autorização do ADR 0011: [permissão, visitante, player, admin].
const matrix: [Permission, boolean, boolean, boolean][] = [
  [{ action: "account.self" }, false, true, true],
  [ownPhoto, false, true, true],
  [otherPhoto, false, false, true],
  [{ action: "players.manage" }, false, false, true],
  [{ action: "stats.manage" }, false, false, true],
  [{ action: "accounts.manage" }, false, false, true],
];

describe("política de autorização", () => {
  it.each(matrix)(
    "%o → visitante %s, player %s, admin %s",
    (permission, visitor, player, administrator) => {
      expect(can(null, permission)).toBe(visitor);
      expect(can(linkedPlayer, permission)).toBe(player);
      expect(can(admin, permission)).toBe(administrator);
    },
  );

  it("player sem jogador vinculado não edita foto de ninguém", () => {
    expect(can(unlinkedPlayer, ownPhoto)).toBe(false);
    expect(can(unlinkedPlayer, otherPhoto)).toBe(false);
  });

  it("admin edita qualquer foto mesmo sem jogador vinculado", () => {
    expect(can(actor({ role: "admin", playerId: null }), otherPhoto)).toBe(
      true,
    );
  });

  it("admin vinculado a um jogador continua com todas as permissões", () => {
    const linkedAdmin = actor({ role: "admin", playerId: 7 });
    for (const [permission] of matrix) {
      expect(can(linkedAdmin, permission)).toBe(true);
    }
  });
});
