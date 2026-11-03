import { Server, getServerByName, type Connection } from "partyserver";
import type { Env } from "../env";
import { TankEngine } from "../../shared/tank/engine";

/** Network/persistence adapter; gameplay itself is shared with local training. */
export class TankRoom extends Server<Env> {
  private engineInstance?: TankEngine;
  private get engine(): TankEngine {
    return this.engineInstance ??= new TankEngine({
    name: this.name,
    emit: message => this.broadcast(message),
    report: listing => {
      getServerByName(this.env.Tanklobby, "main")
        .then(lobby => lobby.fetch("https://lobby/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(listing) }))
        .catch(() => {});
    },
    save: (state, players) => {
      const base = this.env.NEXT_APP_URL;
      if (!base) return;
      void fetch(`${base.replace(/\/$/, "")}/api/game-history`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameType: "tank", roomId: this.name,
          players: players.map(p => ({ name: p.name, score: p.score })),
          mode: state.mode, winnerName: players.find(p => p.id === state.winnerId)?.name ?? null,
          winningTeam: state.winningTeam, teamScores: state.mode === "team" ? state.teamScores : undefined,
          detail: players.map(p => ({ name: p.name, color: p.color, team: p.team, score: p.score, deaths: p.deaths, damageDealt: p.damageDealt, damageTaken: p.damageTaken })),
          playedAt: new Date().toISOString(),
        }),
      }).catch(() => {});
    },
    });
  }
  onConnect(connection: Connection) { this.engine.onConnect(connection); }
  onClose(connection: Connection) { this.engine.onClose(connection); }
  onMessage(connection: Connection, message: string) { this.engine.onMessage(connection, message); }
}
