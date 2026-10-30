import type { BattleshipDirectory } from "./battleship-directory";
import type { BattleshipRoom } from "./battleship-server";
import type { BrawlerRoom } from "./brawler-server";
import type { DrawDirectory } from "./draw-directory";
import type { MathBossRoom } from "./mathboss-server";
import type { OldMaidDirectory } from "./oldmaid-directory";
import type { OldMaidRoom } from "./oldmaid-server";
import type { GameRoom } from "./server";
import type { SoccerDirectory } from "./soccer-directory";
import type { SoccerRoom } from "./soccer-server";
import type { TankDirectory } from "./tank-directory";
import type { TankRoom } from "./tank-server";
import type { WerewolfDirectory } from "./werewolf-directory";
import type { WerewolfRoom } from "./werewolf-server";

/**
 * Bindings from wrangler.jsonc. A binding's name, kebab-cased, is the party
 * name in the URL — "Tanklobby" serves /parties/tanklobby/… — so these keep
 * the names the hosted PartyKit setup used.
 */
export interface Env {
  /** Base URL of the Next.js app, for posting finished games to /api/game-history. Unset = skip. */
  NEXT_APP_URL?: string;
  Main: DurableObjectNamespace<GameRoom>;
  Drawlobby: DurableObjectNamespace<DrawDirectory>;
  Tanks: DurableObjectNamespace<TankRoom>;
  Tanklobby: DurableObjectNamespace<TankDirectory>;
  Brawler: DurableObjectNamespace<BrawlerRoom>;
  Soccer: DurableObjectNamespace<SoccerRoom>;
  Soccerlobby: DurableObjectNamespace<SoccerDirectory>;
  Werewolf: DurableObjectNamespace<WerewolfRoom>;
  Werewolflobby: DurableObjectNamespace<WerewolfDirectory>;
  Battleship: DurableObjectNamespace<BattleshipRoom>;
  Battleshiplobby: DurableObjectNamespace<BattleshipDirectory>;
  Mathboss: DurableObjectNamespace<MathBossRoom>;
  Oldmaid: DurableObjectNamespace<OldMaidRoom>;
  Oldmaidlobby: DurableObjectNamespace<OldMaidDirectory>;
}
