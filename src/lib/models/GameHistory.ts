import mongoose, { Schema, type InferSchemaType } from "mongoose";

const PlayerResultSchema = new Schema(
  {
    name: { type: String, required: true },
    score: { type: Number, required: true },
  },
  { _id: false }
);

// One shared collection for all 3 games' match history, distinguished by
// `gameType` — rather than three separate models — since the history page
// wants one place to query "recent N matches of game X" and the games share
// enough shape (a room, a set of named players, a top score each) to make a
// single flexible schema simpler than three near-identical ones. Fields only
// one or two games actually use (mode, winningTeam, teamScores) are left
// optional rather than split out; `detail` carries whatever richer
// per-player stats that game tracks (kills/damage for tank, goals/tackles
// for soccer) as a free-form blob, since typing it per game here would mean
// duplicating shared/tankTypes.ts's and shared/soccerTypes.ts's player
// shapes a third time just for this.
//
// Old documents (from before tank/soccer reporting existed) have no
// `gameType` at all — the schema default backfills them as "draw" on read,
// which is what they all were.
const GameHistorySchema = new Schema(
  {
    gameType: { type: String, enum: ["draw", "tank", "soccer", "werewolf"], default: "draw" },
    roomId: { type: String, required: true },
    // The at-a-glance scoreboard for the summary list — draw's real score,
    // tank's kill-based score, soccer's goals. Full per-player breakdowns
    // (if any) live in `detail`.
    players: { type: [PlayerResultSchema], required: true },
    rounds: { type: Number }, // draw only
    mode: { type: String }, // tank: "ffa"|"team"|"practice"; soccer: "2v2" etc.
    winnerName: { type: String }, // tank ffa winner, if any
    winningTeam: { type: String }, // "A"|"B", tank team mode / soccer
    teamScores: { type: Schema.Types.Mixed }, // { A, B } for team-based matches
    detail: { type: Schema.Types.Mixed },
    playedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export type GameHistoryDoc = InferSchemaType<typeof GameHistorySchema>;

export default mongoose.models.GameHistory || mongoose.model("GameHistory", GameHistorySchema);
