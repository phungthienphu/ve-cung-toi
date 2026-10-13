import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { dbConnect } from "@/lib/mongodb";
import { NOT_CONFIGURED, isConfigured, readSession } from "@/lib/mathQuest/session";

/** For the tutor-only API routes: an error response to return, or null once logged in and connected. */
export async function tutorGuard() {
  if (!isConfigured()) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });
  if ((await readSession("tutor")) !== "tutor") return NextResponse.json({ error: "Cần đăng nhập gia sư." }, { status: 401 });
  await dbConnect();
  return null;
}

export const isId = (value: unknown): value is string => typeof value === "string" && mongoose.isValidObjectId(value);
