"use client";

import confetti from "canvas-confetti";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { drawFontClass } from "@/lib/drawFonts";
import {
  isMuted,
  playCardFlick,
  playCardHover,
  playCardLand,
  playCardShuffle,
  playCardSwish,
  playCardTuck,
  playCheckSweep,
  playClockTick,
  playDealRun,
  playHeartbeat,
  playJoin,
  playJokerSting,
  playMatchWin,
  playOink,
  playPairDing,
  playPop,
  playSadTrombone,
  playSeatMove,
  playSkillCast,
  playSkillResult,
  playTeaseBoing,
  playUhOh,
  playYourTurn,
  setMuted,
} from "@/lib/sound";
import { useOldMaidRoom } from "@/lib/useOldMaidRoom";
import { RANKS } from "@/components/cards/deck";
import { DEAL_MS, EMOTES, JOKER, SKILL_PEEK_MS, isPair, isSkill, rankOf, skillOf, type Emote } from "@shared/oldMaidTypes";
import { JokerFace, MyHand, SCAN_START_MS, cardLabel, scanStepMs } from "./MyHand";
import { CastOverlay, DoubleChoice, ReturnButton, SkillSheet, skillStatus, type SkillCast } from "./SkillUi";
import { ChatPanel, FinalPanel, LobbyPanel, RoundEndPanel, Scoreboard, SettingsPanel, btnGhost, btnPrimary, useNow } from "./panels";
import type { Quality } from "./scene/Table3D";

// Ai Là Heo room screen: the 3D table fills the screen; the turn banner, your
// own hand and the panels are HTML on top. Three.js only loads here.

const Table3D = dynamic(() => import("./scene/Table3D"), { ssr: false, loading: () => <TableLoading /> });

function TableLoading() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-white/70">
      <span className="animate-bounce text-5xl">🐷</span>
      <p className="font-draw-display text-xl font-extrabold">Đang dọn bàn…</p>
    </div>
  );
}

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

interface Toast {
  id: number;
  text: string;
  tone: "info" | "good" | "bad";
}

const QUALITY_KEY = "oldmaid_quality";

export default function OldMaidRoom({ roomId, playerId, name, quickBots }: { roomId: string; playerId: string; name: string; quickBots: number }) {
  const router = useRouter();
  const room = useOldMaidRoom(roomId, playerId, name);
  const { state, hand, events, hover, emotes, connected, error, clearError, send, sendHover } = room;
  const now = useNow(250);

  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [quality, setQuality] = useState<Quality>("high");
  const [muted, setMutedState] = useState(true);
  const [panel, setPanel] = useState<"chat" | "scores" | "settings" | null>(null);
  const [emoteOpen, setEmoteOpen] = useState(false);
  const [localHover, setLocalHover] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [jokerAt, setJokerAt] = useState<number | null>(null);
  /** The card you just drew, being checked against your hand. */
  const [scan, setScan] = useState<{ card: number; key: number } | null>(null);
  /** How the last draw ended, for the banner until the next turn. */
  const [settled, setSettled] = useState<{ drawerId: string; targetId: string; pair: [number, number] | null; returned: boolean } | null>(null);
  // ---------- skill cards ----------
  /** The skill card whose sheet is open. */
  const [skillSheet, setSkillSheet] = useState<string | null>(null);
  /** 🔍 played-to-be: waiting for you to tap the card to look at. */
  const [aimingPeek, setAimingPeek] = useState<string | null>(null);
  /** The last "tung chiêu" moment, shown on every screen. */
  const [cast, setCast] = useState<SkillCast | null>(null);
  /** What your 🔍 showed you (this turn only). */
  const [peekReveal, setPeekReveal] = useState<{ targetId: string; slot: number; card: number } | null>(null);
  /** Which card someone looked at with 🔍 (everyone sees the tag). */
  const [peekMark, setPeekMark] = useState<{ targetId: string; slot: number } | null>(null);
  /** 🤲 Rút hai: the two cards to choose between. */
  const [choice, setChoice] = useState<[number, number] | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [seenChat, setSeenChat] = useState(0);
  const [touch, setTouch] = useState(false);
  const toastId = useRef(0);

  useEffect(() => {
    setWebgl(hasWebGL());
    setMutedState(isMuted());
    setTouch(window.matchMedia("(hover: none)").matches);
    try {
      const savedQuality = window.localStorage.getItem(QUALITY_KEY);
      if (savedQuality === "high" || savedQuality === "low") setQuality(savedQuality);
      else if ((navigator.hardwareConcurrency ?? 8) <= 4) setQuality("low");
    } catch {
      // Storage blocked: defaults.
    }
  }, []);

  const toast = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = ++toastId.current;
    setToasts((current) => [...current.slice(-3), { id, text, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 3200);
  }, []);

  // ---------- who's who ----------
  const me = state?.players.find((player) => player.id === playerId);
  const turn = state?.turn ?? null;
  const nameOf = useCallback((id: string | undefined) => (id === playerId ? "bạn" : state?.players.find((player) => player.id === id)?.name ?? "?"), [state, playerId]);
  const iDraw = turn?.drawerId === playerId;
  const iAmTarget = turn?.targetId === playerId;
  const remoteSlot = hover && turn && hover.drawerId === turn.drawerId ? hover.slot : null;
  const highlight = iDraw ? localHover : remoteSlot;
  const inRound = state?.phase === "dealing" || state?.phase === "playing";
  const amActive = !!me && me.seat !== null && me.finishedRank === null && hand.cards.length > 0 && hand.round === state?.round;

  // "Chơi với bot ngay": once seated alone as host, ask for bots and deal straight away.
  const quickSent = useRef(false);
  useEffect(() => {
    if (!quickBots || quickSent.current || !state || state.phase !== "lobby" || state.hostId !== playerId || me?.seat == null) return;
    if (state.players.some((player) => player.seat !== null && player.id !== playerId)) return;
    quickSent.current = true;
    send({ type: "quick_start", bots: quickBots });
  }, [quickBots, state, playerId, me?.seat, send]);

  // A new draw starts with nothing selected (and nothing peeked). Named by its start, not its
  // deadline (a skill can add time), plus its target (↩️ can change it).
  const turnKey = turn ? `${turn.drawerId}:${turn.targetId}:${turn.startedAt}` : "";
  const drawSentFor = useRef("");
  useEffect(() => {
    setLocalHover(null);
    setAimingPeek(null);
    setPeekReveal(null);
    setPeekMark(null);
    if (turnKey) setScan(null);
  }, [turnKey]);

  const draw = useCallback(
    (slot: number) => {
      if (!iDraw || drawSentFor.current === turnKey) return;
      drawSentFor.current = turnKey;
      send({ type: "draw", slot });
      playCardFlick();
    },
    [iDraw, turnKey, send],
  );
  const onHover = useCallback(
    (slot: number | null) => {
      if (!iDraw) return;
      setLocalHover(slot);
      sendHover(slot);
    },
    [iDraw, sendHover],
  );
  const peekAt = useCallback(
    (slot: number) => {
      if (!aimingPeek) return;
      send({ type: "use_skill", cardId: aimingPeek, slot });
      setAimingPeek(null);
    },
    [aimingPeek, send],
  );
  const onTap = useCallback(
    (slot: number, mouse: boolean) => {
      if (!iDraw) return;
      // 🔍 waiting for a card: this tap looks at it instead of taking it.
      if (aimingPeek) return peekAt(slot);
      // Mouse: click takes the card. Touch: first tap picks it (everyone sees), second tap takes it.
      if (mouse || localHover === slot) draw(slot);
      else {
        setLocalHover(slot);
        sendHover(slot);
      }
    },
    [iDraw, aimingPeek, peekAt, localHover, draw, sendHover],
  );

  // Keyboard: ← → to point, Enter / Space to draw.
  const targetCount = turn ? state?.players.find((player) => player.id === turn.targetId)?.cardCount ?? 0 : 0;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key === "Escape") {
        setPanel(null);
        setEmoteOpen(false);
        setSkillSheet(null);
        setAimingPeek(null);
        return;
      }
      if (!iDraw || !targetCount) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const step = event.key === "ArrowRight" ? -1 : 1; // slot 0 sits on the holder's left = your right
        const next = localHover === null ? Math.floor(targetCount / 2) : (localHover + step + targetCount) % targetCount;
        onHover(next);
      } else if ((event.key === "Enter" || event.key === " ") && localHover !== null) {
        event.preventDefault();
        if (aimingPeek) peekAt(localHover);
        else draw(localHover);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [iDraw, targetCount, localHover, onHover, draw, aimingPeek, peekAt]);

  // ---------- table events → sounds, toasts, the private Joker reveal ----------
  const lastSeq = useRef(0);
  useEffect(() => {
    for (const { seq, event } of events) {
      if (seq <= lastSeq.current) continue;
      lastSeq.current = seq;
      if (event.type === "deal") {
        playCardShuffle();
        const cards = Object.values(event.counts).reduce((sum, count) => sum + count, 0);
        window.setTimeout(() => playDealRun(DEAL_MS - 600, cards), 350);
      } else if (event.type === "pairs") {
        if (Object.values(event.byPlayer).some((cards) => cards.length)) {
          playCardSwish();
          playCardLand(0.6);
          window.setTimeout(playPairDing, 650);
        }
      } else if (event.type === "drew") {
        playCardFlick();
        setSettled(null);
        setPeekReveal(null);
        setPeekMark(null);
        if (event.switched) {
          if (event.drawerId === playerId) toast("🎭 Dính bẫy! Lá bạn nhận đã bị tráo.", "bad");
          else if (event.targetId === playerId) toast(`🎭 Bẫy sập! ${nameOf(event.drawerId)} nhận lá khác.`, "good");
        }
        if (event.drawerId === playerId && event.card !== undefined && event.extraCard !== undefined) {
          // 🤲: choose first; the check starts with the card kept.
          setChoice([event.card, event.extraCard]);
        } else if (event.drawerId === playerId && event.card !== undefined) {
          setScan({ card: event.card, key: seq });
          // The check along your hand, in time with the hop in MyHand.
          const mine = hand.round === state?.round ? hand.cards : [];
          const mate = state ? mine.findIndex((item) => isPair(item.card, event.card!, state.config.pairRule)) : -1;
          playCheckSweep(mate >= 0 ? mate + 1 : mine.length, scanStepMs(mine.length), SCAN_START_MS, mate >= 0);
          // Once it has turned face up in front of you.
          if (event.card === JOKER)
            window.setTimeout(() => {
              setJokerAt(Date.now());
              playJokerSting();
            }, 450);
        } else if (event.targetId === playerId && event.card === JOKER && event.extraCard === undefined) {
          toast(`😮‍💨 Phù! ${nameOf(event.drawerId)} vừa rút mất con heo của bạn.`, "good");
        }
        if (event.timedOut && event.drawerId === playerId) toast("⏰ Hết giờ — đã rút giúp bạn 1 lá.", "bad");
      } else if (event.type === "kept") {
        if (event.drawerId === playerId && event.kept !== undefined) {
          setChoice(null);
          setScan({ card: event.kept, key: seq });
          const mine = hand.round === state?.round ? hand.cards : [];
          const mate = state ? mine.findIndex((item) => isPair(item.card, event.kept!, state.config.pairRule)) : -1;
          playCheckSweep(mate >= 0 ? mate + 1 : mine.length, scanStepMs(mine.length), SCAN_START_MS, mate >= 0);
          if (event.kept === JOKER) {
            setJokerAt(Date.now());
            playJokerSting();
          }
        } else if (event.targetId === playerId) {
          playCardTuck();
          toast(`🤲 ${nameOf(event.drawerId)} trả lại bạn 1 lá${event.returned === JOKER ? " — con heo về nhà rồi 😱" : ""}.`, event.returned === JOKER ? "bad" : "info");
        }
      } else if (event.type === "skill") {
        playSkillCast();
        setCast({ key: seq, playerId: event.playerId, skill: event.skill, card: event.card, targetId: event.targetId, at: Date.now() });
        if (event.skill === "peek" && event.targetId && event.slot !== undefined) setPeekMark({ targetId: event.targetId, slot: event.slot });
        if (event.skill === "return" && event.playerId === playerId) setScan(null);
      } else if (event.type === "peeked") {
        setPeekReveal({ targetId: event.targetId, slot: event.slot, card: event.card });
        const bad = event.card === JOKER;
        window.setTimeout(() => playSkillResult(bad), 500);
        toast(bad ? "🔍 Lá đó là CON HEO 🐷 — né ngay!" : `🔍 Lá đó là ${cardLabel(event.card)}.`, bad ? "bad" : "good");
      } else if (event.type === "radar") {
        window.setTimeout(() => playSkillResult(event.hasJoker), 500);
        toast(event.hasJoker ? `📡 ${nameOf(event.targetId)} ĐANG giữ con heo! 🐷` : `📡 ${nameOf(event.targetId)} không giữ heo.`, event.hasJoker ? "bad" : "good");
      } else if (event.type === "resolved") {
        setSettled({ drawerId: event.drawerId, targetId: event.targetId, pair: event.pair, returned: event.returned });
        // Kept a moment so the mate doesn't drop back before it leaves your hand.
        if (event.drawerId === playerId) window.setTimeout(() => setScan(null), 400);
        if (event.pair) {
          // Flung down slowly: swish, slap on the felt, ding.
          playCardSwish();
          playCardLand(1.0);
          window.setTimeout(playPairDing, 1050);
        } else playCardTuck();
      } else if (event.type === "shuffled") {
        // Shuffled or rearranged: any card looked at with 🔍 is lost in the mix.
        setPeekMark((current) => (current?.targetId === event.playerId ? null : current));
        setPeekReveal((current) => {
          if (current?.targetId === event.playerId) toast(`🔀 ${nameOf(event.playerId)} đổi chỗ bài — lá vừa soi lẫn mất rồi!`, "bad");
          return current?.targetId === event.playerId ? null : current;
        });
        if (event.playerId !== playerId && state?.turn?.targetId === event.playerId) {
          playCardShuffle();
          if (state.turn.drawerId === playerId) toast(`🔀 ${nameOf(event.playerId)} vừa xào bài!`);
        }
      } else if (event.type === "out") {
        if (event.playerId === playerId) {
          playMatchWin();
          confetti({ particleCount: 120, spread: 80, origin: { y: 0.75 }, zIndex: 60, disableForReducedMotion: true });
          toast(`🎉 Bạn đã thoát! Hạng ${event.place}.`, "good");
        } else {
          playJoin();
          toast(`🎉 ${nameOf(event.playerId)} đã thoát (hạng ${event.place}).`);
        }
      } else if (event.type === "pig") {
        playSadTrombone();
        window.setTimeout(playOink, 2100);
      }
    }
  }, [events, playerId, nameOf, toast, state, hand]);

  // ---------- table sounds that follow the state ----------
  // The drawer's pointer moving card to card; your heart skipping when it lands on your pig.
  const lastPointed = useRef<string>("");
  useEffect(() => {
    const key = highlight === null ? "" : `${turnKey}:${highlight}`;
    if (key && key !== lastPointed.current) {
      playCardHover();
      if (iAmTarget && hand.cards[highlight!]?.card === JOKER) playHeartbeat();
    }
    lastPointed.current = key;
  }, [highlight, turnKey, iAmTarget, hand.cards]);

  // Your turn / your hand under attack.
  const lastRole = useRef("");
  useEffect(() => {
    const role = iDraw ? `draw:${turnKey}` : iAmTarget ? `target:${turnKey}` : "";
    if (role && role !== lastRole.current) {
      if (iDraw) playYourTurn();
      else playUhOh();
    }
    lastRole.current = role;
  }, [iDraw, iAmTarget, turnKey]);

  // A card dangled anywhere at the table.
  const lastTeased = useRef<Record<string, number>>({});
  useEffect(() => {
    const teased = state?.teased ?? {};
    if (Object.entries(teased).some(([id, slot]) => lastTeased.current[id] !== slot)) playTeaseBoing();
    lastTeased.current = teased;
  }, [state?.teased]);

  // Moving to another seat in the lobby: the camera swings round the table.
  const lastSeat = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    const seat = me?.seat;
    if (lastSeat.current !== undefined && seat != null && seat !== lastSeat.current && state?.phase === "lobby") playSeatMove();
    lastSeat.current = seat;
  }, [me?.seat, state?.phase]);

  const lastEmote = useRef(0);
  useEffect(() => {
    const latest = emotes[emotes.length - 1];
    if (latest && latest.seq > lastEmote.current) {
      lastEmote.current = latest.seq;
      playPop();
    }
  }, [emotes]);

  // Last five seconds of your own draw tick.
  const secondsLeft = turn ? Math.max(0, Math.ceil((turn.endsAt - now) / 1000)) : 0;
  const lastTick = useRef(0);
  useEffect(() => {
    if (iDraw && secondsLeft > 0 && secondsLeft <= 5 && lastTick.current !== secondsLeft) {
      lastTick.current = secondsLeft;
      playClockTick();
    }
  }, [iDraw, secondsLeft]);

  useEffect(() => {
    if (!error) return;
    toast(error, "bad");
    clearError();
  }, [error, toast, clearError]);

  useEffect(() => {
    if (panel === "chat" && state) setSeenChat(state.chat.length);
  }, [panel, state]);
  const unread = state ? state.chat.filter((entry, index) => index >= seenChat && !entry.system && entry.playerId !== playerId).length : 0;

  // ---------- actions ----------
  const invite = async () => {
    const url = `${window.location.origin}/ai-la-heo/${roomId}`;
    try {
      if (touch && navigator.share) await navigator.share({ title: "Vào chơi Ai Là Heo!", url });
      else {
        await navigator.clipboard.writeText(url);
        setInviteCopied(true);
        window.setTimeout(() => setInviteCopied(false), 1800);
      }
    } catch {
      // Share sheet dismissed or clipboard blocked.
    }
  };
  const leave = () => {
    if (inRound && me?.seat != null && !confirmLeave) {
      setConfirmLeave(true);
      return;
    }
    send({ type: "leave_room" });
    router.push("/ai-la-heo");
  };
  const changeQuality = useCallback((next: Quality) => {
    setQuality(next);
    try {
      window.localStorage.setItem(QUALITY_KEY, next);
    } catch {}
  }, []);
  const qualityDrop = useCallback(() => setQuality((current) => (current === "high" ? "low" : current)), []);
  const changeMute = (next: boolean) => {
    setMuted(next);
    setMutedState(next);
  };
  const sendEmote = (emote: Emote) => {
    send({ type: "emote", emote });
    setEmoteOpen(false);
  };
  const tease = useCallback((slot: number | null) => send({ type: "tease", slot }), [send]);
  const reorder = useCallback((order: string[]) => send({ type: "reorder", order }), [send]);
  const shuffleMine = useCallback(() => {
    send({ type: "shuffle_hand" });
    playCardShuffle();
  }, [send]);

  const lobby = useMemo(
    () => ({
      isHost: state?.hostId === playerId,
      mySeat: me?.seat ?? null,
      onSit: (seat: number) => send({ type: "take_seat", seat }),
      onAddBot: (seat: number) => send({ type: "add_bot", seat }),
      onRemoveBot: (id: string) => send({ type: "remove_bot", playerId: id }),
    }),
    [state?.hostId, playerId, me?.seat, send],
  );

  // ---------- skill cards: what's playable, and playing them ----------
  const myCards = useMemo(() => (state && hand.round === state.round ? hand.cards : []), [state, hand]);
  const statusOf = useCallback((card: number) => (state ? skillStatus(card, state, playerId) : { ok: false as const, reason: "" }), [state, playerId]);
  const readySkills = useMemo(() => new Set(myCards.filter((item) => isSkill(item.card) && statusOf(item.card).ok).map((item) => item.id)), [myCards, statusOf]);
  const sheetCard = myCards.find((item) => item.id === skillSheet && isSkill(item.card));
  const returnCard = myCards.find((item) => isSkill(item.card) && skillOf(item.card) === "return" && readySkills.has(item.id));
  const radarTargets = (state?.players ?? [])
    .filter((player) => player.id !== playerId && player.seat !== null && player.finishedRank === null && player.cardCount > 0)
    .map((player) => ({ id: player.id, name: player.name }));
  const playSkill = (cardId: string, targetId?: string) => {
    const item = myCards.find((candidate) => candidate.id === cardId);
    setSkillSheet(null);
    if (!item) return;
    // 🔍 needs a card picked first; the rest go straight out.
    if (skillOf(item.card) === "peek") setAimingPeek(cardId);
    else send({ type: "use_skill", cardId, targetId });
  };

  // ---------- banner ----------
  let banner: { title: string; hint?: string; tone: "mine" | "danger" | "calm" } | null = null;
  if (state) {
    if (state.phase === "lobby") banner = { title: `Sảnh chờ · ${state.players.filter((player) => player.seat !== null).length}/6 ghế`, tone: "calm" };
    else if (state.phase === "dealing") {
      const dealingNow = state.phaseEndsAt && now < state.phaseEndsAt - 2200;
      banner = { title: dealingNow ? "🃏 Đang chia bài…" : "✨ Bỏ các đôi ra giữa bàn…", tone: "calm" };
    } else if (state.phase === "playing") {
      // Skills in effect this turn, said plainly on the banner.
      const effects = turn
        ? [
            turn.reversed && "↩️ rút bên trái",
            turn.double && "🤲 rút hai, giữ một",
            turn.switchArmed && `🎭 ${turn.targetId === playerId ? "bẫy của bạn đang giăng" : `${nameOf(turn.targetId)} giăng bẫy — lá chọn sẽ bị tráo`}`,
          ].filter(Boolean).join(" · ")
        : "";
      if (iDraw && aimingPeek) banner = { title: "🔍 Chạm vào 1 lá để soi", hint: "Chỉ bạn thấy mặt lá · Esc để huỷ", tone: "mine" };
      else if (iDraw)
        banner = {
          title: `🎯 Lượt bạn — rút 1 lá của ${nameOf(turn?.targetId)}`,
          hint: effects || (touch ? "Chạm chọn lá, chạm lần nữa để rút" : "Rê chuột chọn lá, bấm để rút · ← → Enter"),
          tone: "mine",
        };
      else if (iAmTarget) banner = { title: `😬 ${nameOf(turn?.drawerId)} đang rút bài của BẠN`, hint: effects || "Bấm 1 lá để nhử · 🔀 Xào để đánh lừa", tone: "danger" };
      else if (turn) banner = { title: `${nameOf(turn.drawerId)} đang rút bài của ${nameOf(turn.targetId)}`, hint: effects || undefined, tone: "calm" };
      else if (state.pending) {
        const { drawerId, targetId, choosing } = state.pending;
        if (choosing) banner = { title: drawerId === playerId ? "🤲 Chọn 1 lá để giữ" : `🤲 ${nameOf(drawerId)} đang chọn lá để giữ…`, tone: drawerId === playerId ? "mine" : "calm" };
        else if (drawerId === playerId) banner = { title: "🔍 Dò xem có thành đôi không…", hint: returnCard ? "🛡️ Có thể trả lá này về" : undefined, tone: "mine" };
        else if (targetId === playerId) banner = { title: `😮 ${nameOf(drawerId)} đã rút 1 lá của bạn`, hint: "Đang dò bài…", tone: "danger" };
        else banner = { title: `🔍 ${nameOf(drawerId)} đang dò bài…`, tone: "calm" };
      } else if (settled) {
        const who = settled.drawerId === playerId ? "Bạn" : nameOf(settled.drawerId);
        banner = settled.returned
          ? { title: `🛡️ ${who} trả lá về cho ${settled.targetId === playerId ? "bạn" : nameOf(settled.targetId)}`, tone: "calm" }
          : settled.pair
            ? { title: `🃏 ${who} bỏ đôi ${RANKS[rankOf(settled.pair[0])]} xuống bàn!`, tone: settled.drawerId === playerId ? "mine" : "calm" }
            : { title: `🤐 ${who} cất lá vào tay`, tone: "calm" };
      } else banner = { title: "…", tone: "calm" };
    } else if (state.lastRound) banner = { title: state.lastRound.pigId === playerId ? "🐷 Bạn là HEO!" : `🐷 ${state.lastRound.pigName} là HEO!`, tone: "danger" };
  }
  const turnTotal = (state?.config.turnSeconds ?? 15) * 1000;
  const turnFraction = turn ? Math.max(0, Math.min(1, (turn.endsAt - now) / turnTotal)) : 0;
  const pointerName = turn ? nameOf(turn.drawerId) : "";
  const watching = !!state && me?.seat === null;

  return (
    <main className={`${drawFontClass} bg-heo-room fixed inset-0 overflow-hidden text-white`}>
      {/* the table */}
      <div className={`absolute inset-0 ${jokerAt && now - jokerAt < 700 ? "om-shake" : ""}`}>
        {webgl === false ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="text-5xl">🙈</span>
            <p className="font-draw-display text-2xl font-extrabold">Máy không hỗ trợ đồ họa 3D</p>
            <p className="max-w-sm text-sm text-white/65">Thử mở bằng Chrome hoặc Safari bản mới, hoặc bật “tăng tốc phần cứng” trong cài đặt trình duyệt.</p>
          </div>
        ) : state && webgl ? (
          <Table3D
            state={state}
            myId={playerId}
            highlight={highlight}
            onHover={onHover}
            onTap={onTap}
            events={events}
            emotes={emotes}
            quality={quality}
            onQualityDrop={qualityDrop}
            lobby={lobby}
            peekReveal={peekReveal}
            peekMark={peekMark}
          />
        ) : (
          <TableLoading />
        )}
      </div>

      {/* top bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-2 sm:p-3">
        <div className="pointer-events-auto flex items-center gap-1.5">
          <button type="button" onClick={leave} aria-label="Rời phòng" className="grid h-10 w-10 place-items-center rounded-full bg-black/55 text-lg ring-1 ring-white/15 backdrop-blur hover:bg-black/70">
            ‹
          </button>
          <button type="button" onClick={invite} title="Mời bạn vào phòng" className="rounded-full bg-black/55 px-3 py-2 font-mono text-sm font-black tracking-[0.2em] text-amber-200 ring-1 ring-white/15 backdrop-blur hover:bg-black/70">
            {roomId} <span className="ml-1 font-sans tracking-normal text-white/70">{inviteCopied ? "✓" : "🔗"}</span>
          </button>
          {state && state.round > 0 && <span className="hidden rounded-full bg-black/55 px-3 py-2 text-xs font-bold text-white/80 ring-1 ring-white/15 backdrop-blur sm:inline">Ván {state.round}</span>}
        </div>
        <div className="pointer-events-auto flex items-center gap-1.5">
          {[
            { id: "scores" as const, icon: "🏆", label: "Bảng điểm" },
            { id: "chat" as const, icon: "💬", label: "Trò chuyện" },
            { id: "settings" as const, icon: "⚙️", label: "Cài đặt" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              onClick={() => setPanel((current) => (current === item.id ? null : item.id))}
              className={`relative grid h-10 w-10 place-items-center rounded-full ring-1 ring-white/15 backdrop-blur transition ${panel === item.id ? "bg-amber-300 text-amber-950" : "bg-black/55 hover:bg-black/70"}`}
            >
              {item.icon}
              {item.id === "chat" && unread > 0 && panel !== "chat" && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">{unread}</span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* whose turn */}
      {banner && (
        <div className="pointer-events-none absolute inset-x-0 top-14 z-20 flex justify-center px-3 lg:top-3">
          <div
            key={banner.title}
            className={`om-pop w-full max-w-md rounded-2xl px-4 py-2.5 text-center shadow-xl ring-1 backdrop-blur ${
              banner.tone === "mine" ? "bg-amber-300/95 text-amber-950 ring-amber-100" : banner.tone === "danger" ? "bg-pink-600/90 text-white ring-pink-300/50" : "bg-black/55 text-white ring-white/15"
            }`}
          >
            <p className="truncate font-draw-display text-base font-extrabold sm:text-lg">{banner.title}</p>
            {banner.hint && <p className="text-[11px] font-semibold opacity-80">{banner.hint}</p>}
            {turn && state?.phase === "playing" && (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/20">
                  <div className={`om-timer h-full rounded-full ${secondsLeft <= 5 ? "bg-red-500" : banner.tone === "mine" ? "bg-amber-900" : "bg-white"}`} style={{ width: `${turnFraction * 100}%` }} />
                </div>
                <span className="w-7 text-right text-xs font-black tabular-nums">{secondsLeft}s</span>
              </div>
            )}
          </div>
        </div>
      )}

      {watching && state.phase !== "lobby" && (
        <div className="pointer-events-none absolute inset-x-0 top-36 z-20 flex justify-center px-3 lg:top-28">
          <p className="rounded-full bg-black/60 px-4 py-2 text-sm font-semibold text-white/85 ring-1 ring-white/15 backdrop-blur">👀 Bạn đang xem — ván sau sẽ được ngồi vào bàn</p>
        </div>
      )}

      {/* your hand + table talk */}
      {state && state.phase !== "lobby" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-2 pb-[max(env(safe-area-inset-bottom),6px)]">
          {iDraw && aimingPeek && (
            <div className="pointer-events-auto mb-2 flex justify-center">
              <button type="button" onClick={() => setAimingPeek(null)} className="om-pop rounded-full bg-black/60 px-4 py-2 text-sm font-bold text-white ring-1 ring-white/20 backdrop-blur">
                🔍 Đang chọn lá để soi · Huỷ
              </button>
            </div>
          )}
          {iDraw && touch && localHover !== null && !aimingPeek && (
            <div className="pointer-events-auto mb-2 flex justify-center">
              <button type="button" onClick={() => draw(localHover)} className={`${btnPrimary} om-pop`}>
                ✋ Rút lá này
              </button>
            </div>
          )}
          {hand.round === state.round && (
            <MyHand
              cards={hand.cards}
              drawnId={hand.drawnId}
              pointedSlot={iAmTarget ? remoteSlot : null}
              pointerName={pointerName}
              teasedSlot={state.teased[playerId] ?? null}
              scan={scan}
              pairRule={state.config.pairRule}
              spotlight={iAmTarget}
              readySkills={readySkills}
              peekedSlot={peekMark?.targetId === playerId ? peekMark.slot : null}
              canTease={state.phase === "playing" && amActive}
              canArrange={inRound && amActive}
              onTease={tease}
              onSkill={setSkillSheet}
              onReorder={reorder}
              onShuffle={shuffleMine}
            />
          )}
        </div>
      )}

      {/* emotes */}
      {state && me && (
        <div className="absolute bottom-3 left-3 z-30 sm:bottom-4 sm:left-4">
          {emoteOpen && (
            <div className="om-pop absolute bottom-14 left-0 grid w-max grid-cols-4 gap-1 rounded-2xl bg-black/75 p-2 ring-1 ring-white/15 backdrop-blur">
              {(Object.keys(EMOTES) as Emote[]).map((emote) => (
                <button key={emote} type="button" onClick={() => sendEmote(emote)} className="grid h-11 w-11 place-items-center rounded-xl text-2xl transition hover:scale-110 hover:bg-white/10">
                  {EMOTES[emote]}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            aria-label="Biểu cảm"
            onClick={() => setEmoteOpen((open) => !open)}
            className={`grid h-12 w-12 place-items-center rounded-full text-2xl shadow-lg ring-1 ring-white/20 backdrop-blur transition hover:scale-105 ${emoteOpen ? "bg-amber-300" : "bg-black/55"}`}
          >
            😀
          </button>
        </div>
      )}

      {/* panels */}
      {state?.phase === "lobby" && <LobbyPanel state={state} myId={playerId} send={send} onInvite={invite} inviteCopied={inviteCopied} />}
      {state?.phase === "roundEnd" && <RoundEndPanel state={state} myId={playerId} send={send} />}
      {state?.phase === "final" && <FinalPanel state={state} myId={playerId} send={send} />}
      {panel === "chat" && state && <ChatPanel state={state} myId={playerId} onSend={(text) => send({ type: "chat", text })} onClose={() => setPanel(null)} />}
      {panel === "scores" && state && (
        <section className="absolute right-2 top-16 z-40 w-[min(22rem,calc(100%-1rem))] rounded-3xl bg-[#1d130c]/95 p-4 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-bold">🏆 Bảng điểm</p>
            <button type="button" aria-label="Đóng" onClick={() => setPanel(null)} className="rounded-full px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white">
              ✕
            </button>
          </div>
          <Scoreboard players={state.players} myId={playerId} />
        </section>
      )}
      {panel === "settings" && (
        <SettingsPanel quality={quality} muted={muted} onQuality={changeQuality} onMute={changeMute} onClose={() => setPanel(null)} />
      )}

      {/* skill cards: the "tung chiêu" moment, a card's sheet, 🤲's choice, 🛡️ above everything */}
      <CastOverlay cast={cast} myId={playerId} nameOf={nameOf} />
      {sheetCard && state && (
        <SkillSheet
          card={sheetCard.card}
          status={statusOf(sheetCard.card)}
          radarTargets={radarTargets}
          canTease={state.phase === "playing" && amActive}
          teased={state.teased[playerId] === myCards.indexOf(sheetCard)}
          onUse={(targetId) => playSkill(sheetCard.id, targetId)}
          onTease={() => {
            const slot = myCards.indexOf(sheetCard);
            tease(state.teased[playerId] === slot ? null : slot);
            setSkillSheet(null);
          }}
          onClose={() => setSkillSheet(null)}
        />
      )}
      {choice && state?.pending?.choosing && state.pending.drawerId === playerId && (
        <DoubleChoice cards={choice} endsAt={state.pending.endsAt} targetName={nameOf(state.pending.targetId)} onKeep={(which) => send({ type: "keep", which })} />
      )}
      {returnCard && state?.pending && (
        <div className="pointer-events-none absolute inset-x-0 bottom-56 z-[55] flex justify-center">
          <ReturnButton endsAt={state.pending.endsAt} totalMs={SKILL_PEEK_MS} onReturn={() => send({ type: "use_skill", cardId: returnCard.id })} />
        </div>
      )}

      {/* you drew the pig — only you see this */}
      {jokerAt && now - jokerAt < 2100 && (
        <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center">
          <div className="om-joker-flash absolute inset-0" />
          <div className="om-joker-card relative flex flex-col items-center">
            <span className="relative block h-56 w-40" style={{ fontSize: 32 }}>
              <JokerFace className="shadow-[0_0_60px_rgba(255,80,140,0.8)]" />
            </span>
            <p className="mt-4 font-draw-display text-3xl font-extrabold text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]">Bạn vừa bốc phải… CON HEO!</p>
            <p className="mt-1 text-sm font-semibold text-white/85">Giữ bình tĩnh — đừng để ai đọc được mặt bạn 🤫</p>
          </div>
        </div>
      )}

      {/* toasts */}
      <div className="pointer-events-none absolute inset-x-0 top-36 z-50 flex flex-col items-center gap-2 px-3 lg:top-24">
        {toasts.map((item) => (
          <p
            key={item.id}
            className={`om-pop max-w-md rounded-2xl px-4 py-2 text-center text-sm font-bold shadow-xl ring-1 backdrop-blur ${
              item.tone === "good" ? "bg-emerald-500/90 ring-emerald-200/40" : item.tone === "bad" ? "bg-red-500/90 ring-red-200/40" : "bg-black/70 ring-white/15"
            }`}
          >
            {item.text}
          </p>
        ))}
      </div>

      {!connected && state && (
        <div className="absolute inset-x-0 bottom-28 z-50 flex justify-center px-3">
          <p className="rounded-full bg-red-600/90 px-4 py-2 text-sm font-bold shadow-xl">📡 Mất kết nối — đang thử vào lại…</p>
        </div>
      )}

      {confirmLeave && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setConfirmLeave(false)}>
          <div role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()} className="om-pop w-full max-w-sm rounded-3xl bg-[#1d130c] p-5 text-center ring-1 ring-white/10">
            <p className="text-4xl">🚪</p>
            <p className="mt-2 font-draw-display text-xl font-extrabold">Rời bàn giữa ván?</p>
            <p className="mt-1 text-sm text-white/65">Bot sẽ cầm bài giúp bạn tới hết ván này.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmLeave(false)} className={btnGhost}>
                Ở lại
              </button>
              <button type="button" onClick={leave} className="rounded-2xl bg-red-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-400">
                Rời bàn
              </button>
            </div>
          </div>
        </div>
      )}

      {!state && webgl !== false && (
        <div className="absolute inset-x-0 bottom-10 z-30 flex justify-center">
          <Link href="/ai-la-heo" className="text-sm text-white/55 hover:text-white">
            ← Về sảnh Ai Là Heo
          </Link>
        </div>
      )}
    </main>
  );
}
