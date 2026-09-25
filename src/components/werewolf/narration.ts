import { ROLE_LABELS, type PublicWerewolfState } from "@shared/werewolfTypes";

/**
 * Narrator ("quản trò") lines shown as captions alongside each scene.
 *
 * Every line is generic on purpose — the same text appears on every device at
 * the same moment (the server picks one shared `narrationSeed` per phase), so
 * nothing here can hint at who holds which role.
 */
export const NARRATION = {
  roleReveal: {
    start: [
      "Đêm đầu tiên sắp bắt đầu. Hãy soi gương và nhìn xem bản thân mình là ai… và nhớ giữ bí mật.",
      "Trước khi màn đêm buông xuống, hãy nhìn xem vai trò của mình là gì. Đừng để ai biết nhé.",
      "Hãy xem vai của mình đi nào… từ giờ trở đi, đừng tin bất kỳ ai.",
    ],
  },

  night: {
    start: [
      "Màn đêm buông xuống, căn phòng lạnh lẽo… nằm co ro trong góc liệu có phải là cách hay để tránh mấy con sói?",
      "Trời tối rồi… cả làng đi ngủ thôi. Nhớ đóng cửa cẩn thận nhé.",
      "Đêm lại đến rồi. Ban ngày nhìn ai cũng hiền… còn ban đêm thì chưa chắc.",
      "Thôi ngủ đi. Mai dậy còn có sức mà nghi oan nhau.",
      "Có thực sự ổn khi đi ngủ vào lúc này không nhỉ? Bọn sói liệu có cắn mất đàn gà nhà mình không?",
    ],
    ambient: [
      "Có tiếng động gì ấy nhỉ? Đang giữa đêm hôm khuya khoắt…",
      "Hình như ngoài cửa sổ vừa có thứ gì chạy qua… thôi, coi như chưa thấy.",
      "Ủa, tiếng gì ngoài sân thế?… Thôi kệ, mạng ai người nấy giữ.",
      "Đêm nay yên tĩnh quá… mà thường yên tĩnh thế này là có chuyện.",
      "Có ai vừa nghe thấy tiếng hú không?… Chắc chó nhà hàng xóm thôi.",
      "Mấy con gà lại kêu rồi… đêm nay chắc có khách.",
      "Hình như có ai đang đi ngoài kia… giờ này còn đi đâu nhỉ?",
      "Có mùi gì tanh tanh ấy nhỉ?… Chắc ai làm tiết canh.",
    ],
    suspicion: [
      "Thằng hàng xóm liệu có tin được không nhỉ? Trông nó cứ đểu đểu thế nào ấy…",
      "Làng này dạo này lạ thật… ban ngày anh em, ban đêm chưa chắc.",
      "Ở cái làng này, tin người quá cũng không phải chuyện hay.",
      "Nghe bảo sói rất giỏi giả làm người… mà người cũng rất giỏi giả làm người tốt.",
      "Đừng để vẻ mặt ngây thơ đánh lừa… làng này diễn viên hơi nhiều.",
      "Hàng xóm tối nay đóng cửa sớm thế… đáng ngờ.",
      "Làng bé tí mà sao lắm người đáng nghi thế không biết.",
    ],
    actionWarning: [
      "Đêm dài lắm… và có vài người chắc chắn không định dùng nó để ngủ.",
      "Có người tối nay ngủ rất ngon… cũng có người đang bận làm chuyện khác.",
      "Đêm nay ai cũng có kế hoạch của riêng mình… có người chỉ đơn giản là cố sống đến sáng.",
      "Đôi lúc nhân từ với kẻ thù… chính là tàn nhẫn với bản thân.",
      "Nếu tối nay nghe tiếng gõ cửa… lời khuyên chân thành là đừng mở.",
    ],
    fiveSecondsLeft: [
      "Bóng tối sắp qua rồi… nếu còn điều gì phải làm, đây là lúc.",
      "Không còn nhiều thời gian đâu…",
      "Nhanh lên nào… trời sắp sáng rồi.",
      "Đêm sắp hết rồi… quyết định đi.",
      "Có vẻ thời gian không định chờ ai cả…",
    ],
    ending: [
      "Trời sắp sáng rồi ní… sao không nghe thấy tiếng gà gáy nhỉ?",
      "Bình minh đang đến gần… không biết đêm nay làng mình có mất gì không.",
      "Sắp sáng rồi… mong là mọi người vẫn còn đầy đủ.",
      "Một đêm nữa sắp trôi qua… ít nhất là với một vài người.",
      "Hình như trời bắt đầu sáng rồi…",
    ],
  },

  dawn: {
    noDeath: [
      "Trời sáng rồi… lạ thật, đêm qua không có ai chết.",
      "Bình minh đã tới. Có vẻ tối qua cả làng đều bình an.",
      "Ồ… mọi người vẫn còn đủ cả. Một đêm yên bình hiếm hoi.",
      "Trời sáng rồi! Không ai chết cả… đáng mừng hay đáng nghi đây?",
      "Gà vẫn gáy, người vẫn đủ. Đêm qua không có ai phải nằm xuống.",
    ],
    death: [
      "Trời sáng rồi… nhưng đêm qua, {playerName} đã không còn tỉnh dậy.",
      "Bình minh đã trở lại… nhưng {playerName} đã không còn ở đây nữa.",
      "Một ngày mới bắt đầu… tiếc là {playerName} sẽ không thể nhìn thấy nó.",
      "Sáng rồi… nhưng nhà của {playerName} hôm nay im ắng lạ thường.",
      "Đêm qua đã có chuyện xảy ra… {playerName} không qua khỏi.",
    ],
    multipleDeaths: [
      "Trời sáng rồi… nhưng đêm qua không chỉ có một người nằm xuống. {playerNames} đã không còn tỉnh dậy.",
      "Bình minh hôm nay có vẻ lạnh hơn mọi ngày… {playerNames} đã chết trong đêm.",
      "Một đêm không mấy yên bình… {playerNames} đã không thể sống đến sáng.",
    ],
    chickenJoke: [
      "Ôi! Sói ăn thịt hết đàn gà nhà mình rồi.",
      "Khoan… đàn gà nhà mình đâu hết rồi?",
      "Người thì chưa biết sao… nhưng hình như tối qua mất thêm mấy con gà.",
    ],
  },

  discussion: {
    start: [
      "Rồi, nói chuyện đi nào. Trong số những người còn ngồi đây… ai đang nói dối?",
      "Đến lúc tìm Sói rồi. Nhìn kỹ mấy người bên cạnh đi…",
      "Ban đêm thì trốn, ban ngày thì cãi nhau. Bắt đầu thôi.",
      "Ai có điều gì muốn giải thích thì nói đi… trước khi quá muộn.",
      "Giờ thì nói cho nhau nghe xem… tối qua ai đáng nghi nhất?",
    ],
    thirtySecondsLeft: [
      "Còn 30 giây… có gì cần thanh minh thì nói nhanh đi.",
      "30 giây cuối. Ai đang bị nghi thì đây là lúc cứu lấy mình.",
      "Còn 30 giây thôi… làng mình sắp phải đưa ra quyết định rồi.",
    ],
    tenSecondsLeft: [
      "10 giây cuối cùng… chốt nghi phạm đi.",
      "Còn 10 giây. Nói nốt những gì cần nói.",
      "10 giây nữa thôi… hy vọng mọi người không chọn nhầm.",
    ],
  },

  voting: {
    start: [
      "Đã đến lúc bỏ phiếu. Chọn người mà bạn nghi ngờ nhất.",
      "Nói thì ai cũng nói được… giờ dùng lá phiếu đi.",
      "Đến lúc quyết định rồi. Ai trong số họ không nên nhìn thấy đêm tiếp theo?",
      "Lá phiếu của bạn có thể cứu cả làng… hoặc tiễn nhầm một người vô tội.",
      "Chọn đi nào. Hy vọng lần này mọi người nghi đúng người.",
    ],
    thirtySecondsLeft: [
      "Còn 30 giây để bỏ phiếu.",
      "30 giây cuối… đừng ngồi nhìn nhau nữa.",
      "Còn 30 giây. Chọn một người đi nào.",
    ],
    tenSecondsLeft: [
      "10 giây cuối cùng.",
      "Còn 10 giây… chưa chọn thì nhanh tay lên.",
      "10 giây nữa thôi. Không chọn cũng là một lựa chọn đấy.",
    ],
  },

  execution: {
    playerExecuted: [
      "{playerName} nhận được {voteCount} phiếu… dân làng đã đưa ra quyết định.",
      "Với {voteCount} phiếu, {playerName} sẽ bị xử bắn.",
      "{playerName}… có vẻ mọi người không còn tin cậu nữa. {voteCount} phiếu.",
      "Kết quả đã có. {playerName} nhận {voteCount} phiếu và sẽ phải rời khỏi ngôi làng.",
    ],
    roleRevealed: [
      "Và thân phận thật sự của {playerName} là… {roleName}.",
      "Đến lúc biết sự thật rồi… {playerName} là {roleName}.",
      "Liệu cả làng đã chọn đúng? {playerName} thực ra là… {roleName}.",
    ],
    tie: [
      "Phiếu hòa rồi… hôm nay không ai bị xử bắn.",
      "Có vẻ dân làng vẫn chưa thể thống nhất. Phiếu hòa, không ai phải chết.",
      "Bằng phiếu nhau… thôi, hôm nay tha.",
      "Không ai có đủ phiếu. Tất cả được sống thêm một ngày… ít nhất là đến tối.",
    ],
    noVote: [
      "Không ai bị chọn… cả làng quyết định không xử bắn ai hôm nay.",
      "Không đủ phiếu để đưa ra quyết định. Không ai bị xử bắn.",
    ],
  },

  gameEnd: {
    villagerWin: [
      "Bình minh cuối cùng cũng đến… Phe Dân chiến thắng. Những con Sói đã bị lật mặt.",
      "Hết rồi. Không còn tiếng Sói hú trong đêm nữa… Phe Dân chiến thắng!",
      "Ngôi làng cuối cùng cũng được yên bình. Phe Dân chiến thắng!",
      "Cuối cùng cũng bắt được hết Sói rồi… mỗi tội đàn gà thì không cứu được.",
    ],
    wolfWin: [
      "Không còn ai có thể ngăn chúng lại… Phe Sói chiến thắng.",
      "Ngôi làng đã quá muộn để nhận ra sự thật… Phe Sói chiến thắng.",
      "Màn đêm sẽ không kết thúc nữa… ngôi làng giờ đã thuộc về bầy Sói.",
      "Thôi xong… làng mất, người mất, gà cũng mất luôn. Phe Sói chiến thắng!",
    ],
  },
} as const;

const NIGHT_ROTATION = [...NARRATION.night.ambient, ...NARRATION.night.suspicion, ...NARRATION.night.actionWarning];
const NIGHT_ROTATE_MS = 8000;

function pick(lines: readonly string[], seed: number, offset = 0): string {
  return lines[(seed + offset) % lines.length];
}

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

/** The caption for the current moment, or null when there's nothing to say
 * (lobby). Pure function of the shared public state + the clock, so every
 * device shows the same line. */
export function narrationFor(state: PublicWerewolfState, now: number): string | null {
  const seed = state.narrationSeed;
  const startedAt = state.phaseStartedAt ?? now;
  const endsAt = state.phaseEndsAt;
  const elapsed = Math.max(0, now - startedAt);
  const remaining = endsAt ? Math.max(0, endsAt - now) : Infinity;
  const total = endsAt ? endsAt - startedAt : 0;
  const nameOf = (id: string) => state.players.find((player) => player.id === id)?.name.replace(/^🤖\s*/, "") ?? "một người";

  switch (state.phase) {
    case "roleReveal":
      return pick(NARRATION.roleReveal.start, seed);

    case "nightExplore":
      return elapsed < 6000 ? pick(NARRATION.night.start, seed) : pick(NIGHT_ROTATION, seed, Math.floor(elapsed / NIGHT_ROTATE_MS));
    case "wolfLock":
      return pick(NIGHT_ROTATION, seed, 3 + Math.floor(elapsed / NIGHT_ROTATE_MS));
    case "nightResolve":
      if (remaining <= 5000) return pick(NARRATION.night.fiveSecondsLeft, seed);
      if (remaining <= 10000) return pick(NARRATION.night.ending, seed);
      return pick(NIGHT_ROTATION, seed, 7 + Math.floor(elapsed / NIGHT_ROTATE_MS));

    case "dawn": {
      const dead = state.nightDeaths.map(nameOf);
      if (dead.length === 0) return pick(NARRATION.dawn.noDeath, seed);
      const main = dead.length === 1
        ? fill(pick(NARRATION.dawn.death, seed), { playerName: dead[0] })
        : fill(pick(NARRATION.dawn.multipleDeaths, seed), { playerNames: dead.join(", ") });
      return seed % 3 === 0 ? `${main} ${pick(NARRATION.dawn.chickenJoke, seed)}` : main;
    }

    case "discussion":
      if (remaining <= 10000) return pick(NARRATION.discussion.tenSecondsLeft, seed);
      if (remaining <= 30000 && total > 40000) return pick(NARRATION.discussion.thirtySecondsLeft, seed);
      return pick(NARRATION.discussion.start, seed);
    case "voting":
      if (remaining <= 10000) return pick(NARRATION.voting.tenSecondsLeft, seed);
      if (remaining <= 30000 && total > 40000) return pick(NARRATION.voting.thirtySecondsLeft, seed);
      return pick(NARRATION.voting.start, seed);

    case "voteResult": {
      const top = state.lastVoteResult[0];
      if (!top) return pick(NARRATION.execution.noVote, seed);
      if (state.lastVoteResult.filter((result) => result.votes === top.votes).length > 1) return pick(NARRATION.execution.tie, seed);
      const victim = state.players.find((player) => player.id === top.playerId);
      const executed = fill(pick(NARRATION.execution.playerExecuted, seed), { playerName: nameOf(top.playerId), voteCount: top.votes });
      if (!victim?.revealedRole) return executed;
      const revealed = fill(pick(NARRATION.execution.roleRevealed, seed), { playerName: nameOf(top.playerId), roleName: ROLE_LABELS[victim.revealedRole] });
      return `${executed} ${revealed}`;
    }

    case "gameEnd":
      return state.winner === "village" ? pick(NARRATION.gameEnd.villagerWin, seed) : pick(NARRATION.gameEnd.wolfWin, seed);

    default:
      return null;
  }
}
