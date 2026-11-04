import assert from 'node:assert/strict';
import { entryFor, refresh, resetCommunityCache, invalidateCommunity } from '../src/features/community/community-store';

async function main() {
  const original = globalThis.fetch;
  const calls: string[] = [];
  const pending: ((value: Response) => void)[] = [];
  globalThis.fetch = ((input: string) => {
    calls.push(input);
    return new Promise<Response>(resolve => pending.push(resolve));
  }) as typeof fetch;
  const flush = async () => { await new Promise(resolve => setImmediate(resolve)); };
  const reply = (data: unknown) => pending.shift()!(Response.json(data));
  try {
    resetCommunityCache('a');
    const notifications = entryFor('a', '/api/community/notifications');
    const one = refresh(notifications), two = refresh(entryFor('a', '/api/community/notifications'));
    assert.equal(calls.length, 1, 'widget and panel share a single pending notification request');
    reply({ friendRequests: 1 }); await Promise.all([one, two]);
    assert.deepEqual(notifications.snapshot.data, { friendRequests: 1 });
    const firstThread = entryFor('a', '/api/community/messages?peer=b');
    const otherThread = entryFor('a', '/api/community/messages?peer=c');
    firstThread.listeners.add(() => {}); otherThread.listeners.add(() => {});
    const loads = [refresh(firstThread), refresh(otherThread)];
    reply({ messages: [{ _id: 'old', createdAt: '2026-11-04T00:00:00Z' }] }); reply({ messages: [] }); await Promise.all(loads);
    const before = calls.length;
    invalidateCommunity({ kind: 'message', actor: 'b', peer: 'a' });
    assert.deepEqual(calls.slice(before), ['/api/community/messages?peer=b'], 'incoming event refreshes only affected open conversation');
    reply({ messages: [{ _id: 'new', createdAt: '2026-11-04T00:01:00Z' }] }); await flush();
    assert.equal((firstThread.snapshot.data as {messages:unknown[]}).messages.length, 2, 'newest-page refresh preserves boundary messages for pagination');
    invalidateCommunity({ kind: 'friends', actor: 'b', peer: 'a' });
    assert.equal(firstThread.snapshot.data, undefined, 'permission change immediately removes private cached messages');
    reply({ messages: [] }); await flush();
    const delayed = refresh(otherThread);
    resetCommunityCache('different-account');
    reply({ messages: [{ text: 'stale private content' }] }); await delayed;
    assert.equal(otherThread.snapshot.data, undefined, 'in-flight old account response cannot restore its data');
    assert.equal(entryFor('different-account', '/api/community/messages?peer=c').snapshot.data, undefined);
    console.log('Community cache passed: in-flight deduplication, targeted invalidation, pagination continuity, permission clearing and account-switch race isolation.');
  } finally { globalThis.fetch = original; resetCommunityCache(''); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
