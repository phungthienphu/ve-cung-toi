import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import mongoose from 'mongoose';
import { databaseMongoose, type DatabaseRequestScope } from '../src/server/db/request-scope';

process.env.CLOUDFLARE_WEB = 'true';
const storage = new AsyncLocalStorage<DatabaseRequestScope>();
(globalThis as Record<symbol, unknown>)[Symbol.for('vct.database-request')] = storage;
const { default: models } = await import('../src/server/db/model');
const schema = new mongoose.Schema({ label: String });
const Model = models.model('CloudflareRequestFixture', schema);
const scopes: DatabaseRequestScope[] = [{ cleanups: [] }, { cleanups: [] }];
const connections = await Promise.all(scopes.map((scope, index) => storage.run(scope, async () => {
  const database = databaseMongoose();
  assert.notEqual(database, mongoose);
  await new Promise(resolve => setTimeout(resolve, index ? 1 : 15));
  assert.equal(Model.db, database.connection, 'exported models resolve within the current request');
  assert.equal(Model.db, Model.db, 'connection is shared inside a request');
  const document = new Model({ label: `request-${index}` });
  assert.equal(document.db, database.connection, 'constructors use the same request connection');
  assert.equal(document.label, `request-${index}`);
  assert.equal(scope.cleanups.length, 1);
  return database.connection;
})));
assert.notEqual(connections[0], connections[1], 'concurrent requests never share sockets');
assert.equal(Model.db, mongoose.connection, 'Node/Vercel retains the default connection');
await Promise.all(scopes.flatMap(scope => scope.cleanups.map(close => close())));
console.log('Cloudflare database passed: concurrent request isolation, model and constructor routing, cleanup and Node fallback.');
