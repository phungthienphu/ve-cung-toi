import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);

const ID_KEY = "vct_player_id";
const NAME_KEY = "vct_player_name";

let accountPlayerId: string | null = null;
let accountName = "";

export function setAccountPlayerId(id: string | null, name = "") { accountPlayerId = id; accountName = id ? name.slice(0, 24) : ""; }

export function getOrCreatePlayerId(): string {
  if (accountPlayerId) return accountPlayerId;
  return getOrCreateGuestId();
}

export function renewGuestId(): string {
  const id = nanoid();
  window.localStorage.setItem(ID_KEY, id);
  return id;
}

export function getOrCreateGuestId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(ID_KEY);
  if (!id) {
    id = nanoid();
    window.localStorage.setItem(ID_KEY, id);
  }
  return id;
}

export function getStoredName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(NAME_KEY) || accountName;
}

export function setStoredName(name: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NAME_KEY, name);
}

export function makeRoomId(): string {
  return nanoid(6).toUpperCase();
}
