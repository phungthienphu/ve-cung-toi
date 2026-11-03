import assert from 'node:assert/strict';
import { HOME_NEWS, NEWS_PAGE_SIZE, newsPage } from '../src/features/home/data/news';
import { HOME_GAMES, filterGames } from '../src/features/home/data/games';

const initial = newsPage()!;
assert.equal(initial.items.length, Math.min(5, HOME_NEWS.length));
assert.equal(NEWS_PAGE_SIZE, 5);
const collected = [...initial.items];
let cursor = initial.nextCursor;
while (cursor) {
  const page = newsPage(cursor)!;
  assert.ok(page.items.length <= 5);
  collected.push(...page.items);
  cursor = page.nextCursor;
}
assert.deepEqual(collected.map(item => item.id), HOME_NEWS.map(item => item.id));
assert.equal(new Set(collected.map(item => item.id)).size, collected.length);
assert.equal(newsPage('missing-release'), null);
assert.deepEqual(newsPage(HOME_NEWS.at(-1)!.id), { items: [], nextCursor: null });
assert.ok(HOME_NEWS.every((item, index) => index === 0 || Date.parse(HOME_NEWS[index - 1].publishedAt) >= Date.parse(item.publishedAt)));
assert.equal(new Set(HOME_GAMES.map(game => game.href)).size, HOME_GAMES.length);
assert.ok(filterGames('bots').every(game => game.bots));
assert.ok(filterGames('solo').every(game => game.solo));
assert.ok(filterGames('group').every(game => game.maxPlayers >= 5));
console.log('Home news passed: five-item pages, stable cursor, no duplicates, filters.');
