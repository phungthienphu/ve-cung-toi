// Cloudflare Worker entry for every realtime room (PartyServer on Durable
// Objects — moved off the hosted PartyKit platform, which shuts down on
// 2026-10-23). Each room class is a Durable Object; wrangler.jsonc binds it
// under the old PartyKit party name, so clients keep connecting to the same
// /parties/:party/:room URLs and only NEXT_PUBLIC_PARTYKIT_HOST changes.

import { routePartykitRequest } from "partyserver";
import type { Env } from "./env";

export { GameRoom } from "./server";
export { DrawDirectory } from "./draw-directory";
export { TankRoom } from "./tank-server";
export { TankDirectory } from "./tank-directory";
export { BrawlerRoom } from "./brawler-server";
export { SoccerRoom } from "./soccer-server";
export { SoccerDirectory } from "./soccer-directory";
export { WerewolfRoom } from "./werewolf-server";
export { WerewolfDirectory } from "./werewolf-directory";
export { BattleshipRoom } from "./battleship-server";
export { BattleshipDirectory } from "./battleship-directory";
export { MathBossRoom } from "./mathboss-server";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await routePartykitRequest(request, env, { cors: true })) ?? new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
