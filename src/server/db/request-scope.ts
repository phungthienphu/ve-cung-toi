import type { AsyncLocalStorage } from 'node:async_hooks';
import mongoose from 'mongoose';

export interface DatabaseRequestScope {
  database?: mongoose.Mongoose;
  connecting?: Promise<mongoose.Mongoose>;
  cleanups: (() => Promise<void>)[];
}

export function databaseRequestScope() {
  const storage = (globalThis as Record<symbol, unknown>)[Symbol.for('vct.database-request')] as AsyncLocalStorage<DatabaseRequestScope> | undefined;
  return storage?.getStore();
}

export function databaseMongoose() {
  const scope = databaseRequestScope();
  if (!scope) return mongoose;
  if (!scope.database) {
    const database = new mongoose.Mongoose();
    scope.database = database;
    scope.cleanups.push(async () => { await database.disconnect(); });
  }
  return scope.database;
}
