import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const schema = new Schema({
  googleSubject: { type: String, required: true, unique: true },
  playerId: { type: String, required: true, unique: true },
  email: { type: String, required: true },
  name: { type: String, default: '' },
  image: { type: String, default: '' },
}, { timestamps: true });
type Account = InferSchemaType<typeof schema>;
export const AccountUser = (mongoose.models.AccountUser as mongoose.Model<Account> | undefined) ?? mongoose.model<Account>('AccountUser', schema);
