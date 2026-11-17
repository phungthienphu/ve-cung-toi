import mongoose from 'mongoose';
import { databaseMongoose, databaseRequestScope } from './request-scope';

// Schemas are shared; sockets and actual Model instances belong to one Worker request.
// Outside Workers, retain the existing Node/Vercel connection and model cache.
const models: typeof mongoose.models = {};
function model(name: string, schema?: mongoose.Schema) {
  if (models[name]) return models[name];
  const template = mongoose.models[name] || mongoose.model(name, schema);
  const current = () => {
    if (!databaseRequestScope()) return template;
    const database = databaseMongoose();
    return database.models[name] || database.model(name, template.schema);
  };
  models[name] = new Proxy(template, {
    get(_target, property) {
      const actual = current();
      const value = Reflect.get(actual, property, actual);
      return typeof value === 'function' ? value.bind(actual) : value;
    },
    construct(_target, args) { return Reflect.construct(current(), args); },
    apply(_target, thisArg, args) { return Reflect.apply(current(), thisArg, args); },
  });
  return models[name];
}

export default (process.env.CLOUDFLARE_WEB === 'true' ? new Proxy(mongoose, {
  get(target, property, receiver) {
    if (property === 'models') return models;
    if (property === 'model') return model;
    return Reflect.get(target, property, receiver);
  },
}) : mongoose) as typeof mongoose;
