import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongodb";
import Wordlist from "@/lib/models/Wordlist";
import { DEFAULT_WORDLISTS } from "@shared/wordlists";

export async function GET() {
  try {
    await dbConnect();
    const docs = await Wordlist.find({}, { slug: 1, name: 1, language: 1, isDefault: 1, words: 1 }).lean();
    if (docs.length > 0) {
      return NextResponse.json({ wordlists: docs });
    }
  } catch {
    // Fall back to the bundled defaults if MongoDB isn't configured yet.
  }
  return NextResponse.json({
    wordlists: DEFAULT_WORDLISTS.map((w) => ({ slug: w.id, name: w.name, language: w.language, isDefault: true, words: w.words })),
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, words, createdBy } = body as { name: string; words: string[]; createdBy?: string };

  const cleanWords = (words || []).map((w) => w.trim()).filter(Boolean);
  if (!name || cleanWords.length < 20) {
    return NextResponse.json({ error: "Cần một tên và ít nhất 20 từ." }, { status: 400 });
  }

  await dbConnect();
  const slug = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const doc = await Wordlist.create({
    slug,
    name,
    language: "custom",
    words: cleanWords,
    isDefault: false,
    createdBy: createdBy ?? null,
  });

  return NextResponse.json({ wordlist: { slug: doc.slug, name: doc.name, language: doc.language, words: doc.words } });
}
