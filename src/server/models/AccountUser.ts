import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const schema = new Schema({
  googleSubject: { type: String },
  playerId: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  emailNormalized: { type: String },
  emailVerifiedAt: { type: Date, default: null },
  username: { type: String },
  passwordHash: { type: String, select: false },
  sessionVersion: { type: Number, default: 0 },
  passwordChangedAt: { type: Date },
  name: { type: String, default: '' },
  image: { type: String, default: '' },
}, { timestamps: true, autoIndex: false });
// Explicit migration owns indexes, so a new deploy cannot modify old unique indexes.
schema.index({ googleSubject: 1 }, { unique: true, partialFilterExpression: { googleSubject: { $type: 'string' } } });
schema.index({ emailNormalized: 1 }, { unique: true, partialFilterExpression: { emailNormalized: { $type: 'string' } } });
schema.index({ username: 1 }, { unique: true, partialFilterExpression: { username: { $type: 'string' } } });
type Account = InferSchemaType<typeof schema>;
export const AccountUser = (mongoose.models.AccountUser as mongoose.Model<Account> | undefined) ?? mongoose.model<Account>('AccountUser', schema);
