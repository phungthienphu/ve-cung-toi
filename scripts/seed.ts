// Seeds the MongoDB `wordlists` collection with the two bundled default
// word lists (Vietnamese + English). Run with: npm run seed
import { config } from "dotenv";
import mongoose from "mongoose";

config({ path: ".env.local" });
config(); // fall back to .env if present
import Wordlist from "../src/lib/models/Wordlist";
import { DEFAULT_WORDLISTS } from "../shared/wordlists";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set. Copy .env.example to .env.local and fill it in first.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB.");

  for (const list of DEFAULT_WORDLISTS) {
    await Wordlist.findOneAndUpdate(
      { slug: list.id },
      { slug: list.id, name: list.name, language: list.language, words: list.words, isDefault: true },
      { upsert: true, new: true }
    );
    console.log(`Seeded wordlist "${list.name}" (${list.words.length} words).`);
  }

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
