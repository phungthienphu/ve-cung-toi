import { Server, type Connection, type ConnectionContext } from 'partyserver';
import type { Env } from '../env';
import { verifyEnvelope, type RealtimeTicket, type RealtimePublish } from '../../shared/community/auth';
/** One authenticated notification hub. Chat contents remain private in MongoDB. */
export class CommunityRoom extends Server<Env> {
  static options = { hibernate: true };
  private secret() { return this.env.COMMUNITY_REALTIME_SECRET || this.env.GAME_HISTORY_SECRET || ''; }
  private active(except?: string) {
    return [...this.getConnections<RealtimeTicket>()].filter(c => c.id !== except && c.state && c.state.expires > Date.now());
  }
  private presence(except?: string, changedUser?: string) {
    const clients = this.active(except);
    const ids = new Set(clients.map(c => c.state!.playerId));
    for (const c of clients) { if (changedUser && c.state!.playerId !== changedUser && !c.state!.friends.includes(changedUser)) continue; c.send(JSON.stringify({ type: 'presence', online: c.state!.friends.filter(id => ids.has(id)) })); }
  }
  private async schedule() {
    const expiries = [...this.getConnections<RealtimeTicket>()].map(c => c.state?.expires).filter((n): n is number => !!n);
    if (expiries.length) await this.ctx.storage.setAlarm(Math.max(Date.now() + 100, Math.min(...expiries)));
  }
  async onConnect(c: Connection<RealtimeTicket>, context: ConnectionContext) {
    const ticket = await verifyEnvelope<RealtimeTicket>(this.secret(), 'community-connect', new URL(context.request.url).searchParams.get('ticket') || '');
    if (this.name !== 'main' || !ticket || typeof ticket.playerId !== 'string' || !Array.isArray(ticket.friends) || ticket.friends.length > 2000 || ticket.friends.some(id => typeof id !== 'string')) { c.close(1008, 'Unauthorized'); return; }
    c.setState(ticket);
    c.send(JSON.stringify({ type: 'ready' }));
    this.presence(undefined, ticket.playerId); await this.schedule();
  }
  onMessage(c: Connection) { c.close(1008, 'Client publishing is disabled'); }
  onClose(c: Connection<RealtimeTicket>) { this.presence(c.id, c.state?.playerId); }
  onError(c: Connection<RealtimeTicket>) { this.presence(c.id, c.state?.playerId); }
  async onAlarm() {
    for (const c of this.getConnections<RealtimeTicket>()) if (c.state && c.state.expires <= Date.now()) { c.send(JSON.stringify({ type: 'reauthenticate' })); c.setState(null); c.close(4001, 'Refresh authentication'); }
    this.presence(); await this.schedule();
  }
  async onRequest(req: Request) {
    if (this.name !== 'main' || req.method !== 'POST') return new Response(null, { status: 404 });
    const event = await verifyEnvelope<RealtimePublish>(this.secret(), 'community-publish', req.headers.get('x-community-event') || '');
    if (!event || !Array.isArray(event.targets) || !['community', 'support', 'revoke', 'friends'].includes(event.scope)) return new Response(null, { status: 403 });
    for (const c of this.active()) {
      if (!event.targets.includes(c.state!.playerId) && !(event.admins && c.state!.admin)) continue;
      if (event.scope === 'revoke') { c.send(JSON.stringify({ type: 'revoked' })); c.setState(null); c.close(4003, 'Session revoked'); }
      else { c.send(JSON.stringify({ type: 'changed', scope: event.scope === 'friends' ? 'community' : event.scope, change: event.change })); if (event.scope === 'friends') { c.send(JSON.stringify({ type: 'reauthenticate' })); c.setState(null); c.close(4002, 'Refresh friends'); } }
    }
    if (event.scope === 'revoke') this.presence();
    return Response.json({ ok: true });
  }
}
