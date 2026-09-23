# Ma Sói Cùng Phòng — Technical Specification

**Trạng thái:** Draft v1  
**Đối tượng:** Frontend, Backend/PartyKit, QA  
**Stack mục tiêu:** Next.js 15, React 19, TypeScript, PartyKit/PartySocket, MongoDB cho lịch sử  
**Phạm vi:** MVP 5–12 người, Dân/Sói/Tiên Tri/Bảo Vệ/Phù Thủy

## 1. Kiến trúc đề xuất

Tạo PartyKit party riêng để không trộn state và timer với các game hiện có.

```text
src/app/werewolf/page.tsx
src/app/werewolf/[roomId]/page.tsx
src/components/werewolf/WerewolfGameRoom.tsx
src/components/werewolf/*
src/lib/useWerewolfRoom.ts
shared/werewolfTypes.ts
party/werewolf-server.ts
party/werewolf/types.ts
party/werewolf/roles.ts
party/werewolf/night-resolution.ts
party/werewolf/voting.ts
party/werewolf-directory.ts       # tùy chọn nếu có danh sách phòng công khai
```

Đăng ký trong `partykit.json`:

```json
{
  "parties": {
    "werewolf": "party/werewolf-server.ts",
    "werewolflobby": "party/werewolf-directory.ts"
  }
}
```

PartyKit room là nguồn sự thật duy nhất cho state ván. MongoDB chỉ lưu kết quả và thống kê sau ván, không tham gia vào game loop.

## 2. Mô hình pha

```ts
export type WerewolfPhase =
  | "lobby"
  | "roleReveal"
  | "nightExplore"
  | "wolfLock"
  | "nightResolve"
  | "dawn"
  | "discussion"
  | "voting"
  | "runoffDefense"
  | "runoffVoting"
  | "voteResult"
  | "gameEnd";
```

`nightResolve` kéo dài 15 giây ở UI nhưng có hai mốc logic:

- Bắt đầu pha: khóa mục tiêu Sói và gửi nạn nhân riêng cho Phù Thủy.
- Kết thúc pha: khóa Tiên Tri/Bảo Vệ/Phù Thủy và giải quyết đêm.

Không dùng interval đếm từng giây làm nguồn thời gian. Server lưu `phaseEndsAt` theo epoch milliseconds; client tự render countdown. Server chỉ cần alarm/timeout để chuyển pha.

## 3. Thời lượng mặc định

```ts
export const WEREWOLF_TIMING = {
  roleRevealMs: 30_000,
  nightExploreMs: 20_000,
  wolfLockMs: 5_000,
  nightResolveMs: 15_000,
  dawnMs: 8_000,
  discussionMs: 180_000,
  votingMs: 30_000,
  runoffDefenseMs: 20_000,
  runoffVotingMs: 20_000,
  voteResultMs: 8_000,
} as const;
```

Tổng thời gian đêm là 40 giây.

## 4. Kiểu dữ liệu dùng chung

```ts
export type WerewolfRole =
  | "villager"
  | "wolf"
  | "seer"
  | "guardian"
  | "witch";

export type Team = "village" | "wolves";

export interface WerewolfRoomConfig {
  discussionSeconds: number;
  votingSeconds: number;
  revealRoleOnDeath: boolean;
  witchCanSelfSave: boolean;
  deadChatEnabled: boolean;
  roomVisibility: "private" | "public";
  roles: WerewolfRole[];
}

export interface PublicWerewolfPlayer {
  id: string;
  name: string;
  connected: boolean;
  alive: boolean;
  isHost: boolean;
  ready: boolean;
  afk: boolean;
  revealedRole: WerewolfRole | null;
}

export interface PublicWerewolfState {
  roomId: string;
  phase: WerewolfPhase;
  day: number;
  hostId: string | null;
  players: PublicWerewolfPlayer[];
  config: WerewolfRoomConfig;
  phaseStartedAt: number | null;
  phaseEndsAt: number | null;
  nominees: string[];
  publicEvents: PublicGameEvent[];
  lastVoteResult: PublicVoteResult | null;
  winner: Team | null;
}
```

Public state tuyệt đối không chứa role chưa lộ, team, mục tiêu đêm, potion, kết quả soi hoặc danh sách Sói.

## 5. State bí mật phía server

```ts
interface SecretPlayerState {
  role: WerewolfRole;
  team: Team;
  reconnectTokenHash: string;

  previewTargetId: string | null;
  lockedTargetId: string | null;
  lockedAt: number | null;

  suspicionTargetId: string | null;
  suspicionTag: SuspicionTag | null;
  suspicionHistory: SuspicionEntry[];

  seerHistory: Array<{
    night: number;
    targetId: string;
    isWolf: boolean;
  }>;

  lastGuardedPlayerId: string | null;
  witchHealAvailable: boolean;
  witchPoisonAvailable: boolean;
  witchDecision: "heal" | "poison" | "skip" | null;
  witchPoisonTargetId: string | null;

  missedActionCount: number;
}
```

State room riêng:

```ts
interface SecretRoomState {
  playerSecrets: Map<string, SecretPlayerState>;
  wolfVictimId: string | null;
  nightDeaths: string[];
  pendingSeerResults: Map<string, { targetId: string; isWolf: boolean }>;
  votes: Map<string, string | null>;
  runoffCandidates: string[];
}
```

## 6. Xác thực phiên và reconnect

Khi join lần đầu, server cấp:

```ts
{
  type: "session_created",
  playerId: string,
  reconnectToken: string
}
```

Client lưu `playerId` và `reconnectToken` trong `localStorage`, theo namespace game và room. Khi reconnect:

```ts
{
  type: "join",
  playerId: string,
  reconnectToken: string,
  name: string
}
```

Không cho phép chiếm phiên chỉ bằng `playerId`. Server lưu hash của token, không broadcast token và không ghi token vào log.

Sau reconnect thành công, server gửi:

1. Public state mới nhất.
2. Secret snapshot dành riêng cho người đó.
3. Countdown dựa trên `phaseEndsAt` hiện tại.

## 7. Message protocol

### Client → server

```ts
export type WerewolfClientMessage =
  | { type: "join"; playerId?: string; reconnectToken?: string; name: string }
  | { type: "set_ready"; ready: boolean }
  | { type: "update_config"; config: WerewolfRoomConfig }
  | { type: "start_game" }
  | { type: "ack_role" }
  | { type: "preview_target"; targetId: string }
  | { type: "lock_target"; targetId: string }
  | { type: "set_suspicion"; targetId: string; tag?: SuspicionTag }
  | { type: "witch_decision"; decision: "heal" | "poison" | "skip"; targetId?: string }
  | { type: "cast_vote"; targetId: string | null }
  | { type: "extend_discussion" }
  | { type: "end_discussion" }
  | { type: "kick_afk"; playerId: string }
  | { type: "play_again" }
  | { type: "leave_room" };
```

### Server → client

```ts
export type WerewolfServerMessage =
  | { type: "state"; state: PublicWerewolfState }
  | { type: "session_created"; playerId: string; reconnectToken: string }
  | { type: "secret_state"; state: PrivatePlayerView }
  | { type: "your_role"; role: WerewolfRole; teammates: PrivateTeammate[] }
  | { type: "wolf_preview"; choices: WolfChoiceView[] }
  | { type: "wolf_target_locked" }
  | { type: "witch_prompt"; victimId: string; deadline: number }
  | { type: "seer_result"; targetId: string; isWolf: boolean }
  | { type: "action_accepted"; action: string }
  | { type: "error"; code: WerewolfErrorCode; message: string }
  | { type: "kicked" };
```

Mọi message bí mật phải gửi trực tiếp qua connection của đúng player, không dùng room broadcast kèm điều kiện phía client.

## 8. Phân vai

Khi host bắt đầu:

1. Validate số role bằng số người.
2. Validate preset/cân bằng tối thiểu.
3. Dùng random phía server để shuffle player IDs.
4. Gán role và team.
5. Reset toàn bộ secret/action state.
6. Gửi `your_role` riêng cho từng connection.
7. Chuyển sang `roleReveal`.

Không dùng `Math.random()` nếu runtime có `crypto.getRandomValues`; dùng nguồn random của Web Crypto.

## 9. Luật nhận target theo pha

### `nightExplore`

- Tất cả player, kể cả người chết, được gửi `preview_target` và `set_suspicion`.
- Preview của người chết và Dân không tạo hành động role.
- Preview của Sói được gửi riêng cho các Sói còn sống.
- Mục tiêu phải là player tồn tại và còn sống.
- Không cho Sói chọn Sói khác làm nạn nhân.
- Tiên Tri không soi chính mình.
- Bảo Vệ được bảo vệ bản thân, trừ khi config sau này cấm.

### `wolfLock`

- Sói còn sống được gửi `lock_target`.
- Tiên Tri/Bảo Vệ vẫn được preview và lock lựa chọn của mình.
- Dân vẫn được `set_suspicion`.
- Phù Thủy vẫn chỉ có hành vi nghi ngờ, chưa nhận nạn nhân.

### `nightResolve`

- Khi bắt đầu pha, server khóa nạn nhân Sói.
- Gửi `witch_prompt` riêng cho Phù Thủy còn sống.
- Tiên Tri/Bảo Vệ được đổi và lock đến deadline.
- Phù Thủy được gửi `witch_decision` đến deadline.
- Sói và Dân tiếp tục `set_suspicion`; dữ liệu này không đổi mục tiêu Sói.

## 10. Thuật toán chọn mục tiêu Sói

```ts
function chooseWolfVictim(livingWolves: string[]): string | null {
  // Với mỗi Sói, ưu tiên lockedTargetId.
  // Nếu không có, dùng previewTargetId cuối cùng.
  // Bỏ lựa chọn không hợp lệ hoặc target đã chết.
  // Đếm phiếu theo target.
  // Một target có đa số cao nhất duy nhất -> chọn target đó.
  // Nhiều target cùng cao nhất -> random công bằng giữa các target hòa.
  // Không có phiếu hợp lệ -> null.
}
```

Không random giữa từng phiếu lặp lại. Random giữa các **target đang hòa ở mức phiếu cao nhất**.

Ví dụ ba Sói chọn `A, A, B` thì A chết; chọn `A, B, C` thì random 1/3 giữa A/B/C.

## 11. Giải quyết hành động đêm

Tại deadline cuối đêm, tạo snapshot bất biến của toàn bộ lựa chọn hợp lệ rồi giải quyết:

```text
1. Xác định wolfVictimId (đã khóa ở giây 25).
2. Xác định guardianTargetId.
3. Xác định witchDecision và poisonTargetId.
4. Xác định seerTargetId và kết quả soi.
5. Nếu wolfVictim == guardianTarget → chặn đòn cắn.
6. Nếu Phù Thủy dùng heal hợp lệ → chặn đòn cắn.
7. Nếu Phù Thủy dùng poison hợp lệ → thêm poisonTarget vào danh sách chết.
8. Loại trùng danh sách chết.
9. Cập nhật potion và lastGuardedPlayerId.
10. Gửi kết quả riêng cho Tiên Tri.
11. Đánh dấu alive=false cho người chết.
12. Kiểm tra thắng.
```

Quy tắc MVP:

- Bảo Vệ chỉ chặn Sói, không chặn độc.
- Phù Thủy cứu được mục tiêu ngay cả khi Bảo Vệ cũng đã bảo vệ; bình cứu vẫn bị tiêu hao nếu người chơi đã chốt dùng.
- Một người vừa bị độc vừa bị Sói cắn chỉ xuất hiện một lần trong danh sách chết.
- Nếu Phù Thủy chết trong chính đêm đó, hành động đã chốt của Phù Thủy vẫn có hiệu lực.
- Nếu Tiên Tri chết trong đêm, kết quả soi vẫn được lưu trong secret history nhưng không cần hiển thị lâu hơn pha chuyển cảnh.

## 12. Tiên Tri

Kết quả xác định theo `team === "wolves"`, không theo tên role, để hỗ trợ role mở rộng sau này.

`seer_result` chỉ gửi sau khi pha đêm đóng. Client lưu để hiển thị trong lịch sử riêng nhưng server vẫn là nguồn sự thật và phải gửi lại lịch sử khi reconnect.

## 13. Bảo Vệ

- Validate target không bằng `lastGuardedPlayerId`.
- Nếu client gửi target không hợp lệ, trả lỗi riêng và giữ lựa chọn hợp lệ trước đó.
- Sau mỗi đêm, cập nhật `lastGuardedPlayerId` bằng target hợp lệ cuối cùng.
- Nếu bỏ lượt, không thay đổi `lastGuardedPlayerId`; do đó đêm sau vẫn không được bảo vệ lại người của lần hành động gần nhất.

## 14. Phù Thủy

`witch_prompt` chỉ được gửi nếu Phù Thủy còn sống. Payload có nạn nhân hoặc `null` nếu Sói không có mục tiêu; không tiết lộ Bảo Vệ đã chọn ai.

Validation:

- `heal` yêu cầu còn bình cứu, có nạn nhân và thỏa luật tự cứu.
- `poison` yêu cầu còn bình độc và target còn sống.
- `skip` luôn hợp lệ.
- Mỗi message hợp lệ mới thay thế quyết định cũ cho đến deadline.
- Chỉ tiêu hao potion khi giải quyết đêm, không tiêu hao ngay khi click.

## 15. Bỏ phiếu ban ngày

- Chỉ player còn sống được vote.
- Target phải còn sống và khác voter.
- `null` là phiếu trắng nếu config cho phép; MVP có thể mặc định cho phép.
- Người chơi được đổi phiếu đến deadline.
- Không broadcast lựa chọn cá nhân trong khi bỏ phiếu.
- Tại deadline, broadcast tổng kết phiếu.

Nếu một người có số phiếu cao nhất duy nhất, loại người đó. Nếu hòa từ hai người trở lên:

1. Lưu danh sách hòa vào `runoffCandidates`.
2. Chuyển `runoffDefense`.
3. Chuyển `runoffVoting`; chỉ được chọn ứng viên hòa.
4. Nếu tiếp tục hòa, không loại ai.

Sau `voteResult`, kiểm tra điều kiện thắng rồi chuyển sang đêm mới.

## 16. Điều kiện thắng

```ts
function determineWinner(players: InternalPlayer[]): Team | null {
  const livingWolves = players.filter(p => p.alive && p.team === "wolves").length;
  const livingVillage = players.filter(p => p.alive && p.team === "village").length;

  if (livingWolves === 0) return "village";
  if (livingWolves >= livingVillage) return "wolves";
  return null;
}
```

Chạy sau khi giải quyết chết ban đêm và sau khi loại người bằng phiếu.

## 17. Host authority

Host chỉ được:

- Chỉnh config trong lobby.
- Bắt đầu ván hợp lệ.
- Kết thúc thảo luận sớm hoặc gia hạn một lần.
- Kick người AFK tại điểm an toàn.
- Bắt đầu ván mới sau game end.

Host không được:

- Đọc role hoặc secret state của người khác.
- Chọn thay hành động cho người khác.
- Sửa kết quả hoặc ép chuyển pha đêm.

Khi host disconnect quá 30 giây, chuyển host cho connected player có `joinedAt` sớm nhất.

## 18. Disconnect, timeout và AFK

- Player disconnected vẫn tồn tại và vẫn có thể bị giết/vote.
- Reconnect grace period: 90 giây.
- Không xóa role giữa ván khi hết grace period.
- Action mặc định khi timeout:
  - Sói: dùng preview cuối; không có thì abstain.
  - Tiên Tri/Bảo Vệ: dùng target hợp lệ cuối; không có thì bỏ lượt.
  - Phù Thủy: skip.
  - Vote: phiếu trắng.
- Tăng `missedActionCount` khi vai có hành động thật nhưng không gửi lựa chọn hợp lệ.
- Hai lần liên tiếp: public `afk=true`.
- Reset counter khi người chơi hoàn thành một pha yêu cầu hành động.

## 19. Đồng bộ thời gian và chống race condition

- Mỗi message hành động được kiểm tra với `phase`, `phaseStartedAt` và server time.
- Message đến sau deadline bị từ chối dù client vẫn hiển thị còn thời gian.
- Mỗi lần chuyển pha tăng `phaseRevision`.
- Client gửi `phaseRevision` kèm action; server từ chối revision cũ.
- Transition phải idempotent: chạy lại cùng revision không giải quyết đêm hai lần hoặc tiêu hao potion hai lần.
- Khi server khởi động lại, đọc persisted room state và lập lại alarm từ `phaseEndsAt`.

## 20. Quyền riêng tư và chống gian lận

- Không đưa secret fields vào object trước khi serialize public state.
- Nên xây public DTO bằng allowlist thay vì clone rồi xóa field.
- Không log payload `your_role`, `witch_prompt`, token hoặc seer result trong production.
- Tất cả target/action được validate phía server.
- Không tin các field `role`, `alive`, `isHost` do client gửi.
- Rate-limit preview update, ví dụ tối đa 8 message/giây/player.
- Giới hạn tên người chơi và nội dung chat; escape khi render.
- Reconnect token có entropy đủ lớn và so sánh an toàn.

## 21. State persistence

Persist room snapshot sau:

- Join/leave và host transfer.
- Update config.
- Phân vai.
- Mỗi action đã lock.
- Mỗi transition pha.
- Kết quả đêm và bỏ phiếu.

Không cần persist từng preview click nếu tải ghi cao; chỉ giữ trong memory và persist target cuối tại mốc chuyển pha.

MongoDB game history đề xuất:

```ts
interface WerewolfGameHistory {
  roomId: string;
  startedAt: Date;
  endedAt: Date;
  playerCount: number;
  winner: Team;
  daysPlayed: number;
  roles: Array<{ playerName: string; role: WerewolfRole }>;
  eliminations: Array<{
    day: number;
    playerName: string;
    cause: "wolves" | "poison" | "vote";
  }>;
}
```

Không lưu reconnect token. Cân nhắc không lưu player ID lâu dài nếu không cần thống kê cá nhân.

## 22. UI component boundaries

```text
WerewolfGameRoom
├── LobbyPanel
├── PhaseHeader
├── RoleRevealCard
├── NightTargetGrid
├── WolfTeamStatus
├── WitchDecisionPanel
├── SuspicionNotebook
├── DawnResult
├── DiscussionPanel
├── VotingPanel
├── PlayerStatusList
└── GameResultPanel
```

`useWerewolfRoom` chịu trách nhiệm socket, reconnect và reducer. Component không tự suy luận luật hoặc tự chuyển pha.

## 23. Accessibility và co-located mode

- Không truyền đạt role chỉ bằng màu.
- Mọi nút có label và trạng thái focus rõ.
- Target grid hỗ trợ bàn phím nhưng không bắt buộc gõ chữ.
- Có chế độ giảm chuyển động.
- Co-located mode tắt âm thanh riêng, rung riêng và notification chứa secret.
- Không ghi secret role vào document title, URL hoặc browser notification.
- Khi tab ra background, không gửi notification dạng `Bạn là Tiên Tri`.

## 24. Error codes tối thiểu

```ts
type WerewolfErrorCode =
  | "INVALID_PHASE"
  | "STALE_PHASE"
  | "NOT_HOST"
  | "PLAYER_NOT_ALIVE"
  | "INVALID_TARGET"
  | "ACTION_LOCKED"
  | "ROLE_NOT_ALLOWED"
  | "POTION_UNAVAILABLE"
  | "SESSION_CONFLICT"
  | "ROOM_FULL"
  | "INVALID_CONFIG";
```

Client hiển thị message thân thiện nhưng dùng `code` cho logic.

## 25. Test plan

### Unit tests

- Phân vai đúng số lượng và không trùng.
- Sói đồng thuận, hòa 2 chiều, hòa 3 chiều và abstain.
- Guardian chặn Sói nhưng không chặn độc.
- Heal/poison tiêu hao đúng một lần.
- Tiên Tri trả đúng team.
- Bảo Vệ không chọn cùng mục tiêu liên tiếp.
- Điều kiện thắng ở mọi tổ hợp sống/chết.
- Vote hòa, runoff và hòa lần hai.

### Integration tests

- Secret message chỉ đến đúng connection.
- Reconnect nhận đúng role và history.
- Client gửi action ở đúng/sai phase.
- Message đến sát deadline không tạo double resolution.
- Restart room giữa pha phục hồi timer.
- Host disconnect và transfer quyền.
- Người vào muộn chỉ là spectator.

### Manual multi-client tests

- 5, 8 và 12 browser sessions.
- Hai Sói nhìn thấy lựa chọn của nhau nhưng Dân không thấy.
- Tất cả màn hình có nhịp chuyển giống nhau ở mốc 20 và 25 giây.
- Không có role/target trong public WebSocket payload.
- Mobile background/foreground và reconnect.
- Network chậm, mất mạng và refresh trong từng pha.

## 26. Acceptance criteria MVP

- 5–12 người có thể tạo phòng, nhận vai và hoàn thành một ván.
- Tổng pha đêm đúng 40 giây: 20 giây thăm dò, 5 giây Sói chốt, 15 giây phản ứng.
- Sói thấy lựa chọn đồng đội qua private message.
- Phù Thủy chỉ thấy nạn nhân sau khi mục tiêu Sói bị khóa.
- Tiên Tri chỉ nhận kết quả khi đêm kết thúc.
- Public state không chứa secret role hoặc night action.
- Reconnect không làm mất vai, potion, kết quả soi hoặc lựa chọn đã khóa.
- Vote, hòa phiếu, điều kiện thắng và chơi lại hoạt động đúng.
- Người chết và spectator không thể tác động đến kết quả.
- Game hoạt động trên mobile và desktop mà không cần tài khoản.

## 27. Thứ tự triển khai đề xuất

1. Shared types, room lifecycle, join/reconnect và lobby.
2. Phân vai và private messaging.
3. State machine/timer 40 giây.
4. Dân, Sói, Tiên Tri và Bảo Vệ.
5. Giải quyết đêm và điều kiện thắng.
6. Discussion, voting và runoff.
7. Phù Thủy.
8. Sổ nghi ngờ, spectator và AFK.
9. MongoDB history, polish và accessibility.

