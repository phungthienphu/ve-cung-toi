import type { WerewolfPhase, WerewolfRole, WerewolfTeam } from "@shared/werewolfTypes";

/**
 * Product copy for Ma Sói lives here.
 *
 * Designers can change narration, instructions and button labels without
 * touching socket logic or React phase routing. Dynamic copy receives only
 * display-safe values such as a player's name.
 */
export const GAME_CONTENT = {
  phaseLabels: {
    lobby: "Phòng chờ",
    roleReveal: "Nhận vai",
    nightExplore: "Đêm — suy nghĩ",
    wolfLock: "Đêm — chốt lựa chọn",
    nightResolve: "Đêm — quyết định cuối",
    dawn: "Bình minh",
    discussion: "Thảo luận",
    voting: "Bỏ phiếu",
    voteResult: "Kết quả bỏ phiếu",
    gameEnd: "Kết thúc",
  } satisfies Record<WerewolfPhase, string>,

  roleReveal: {
    hiddenTitle: "Nhấn giữ để xem vai",
    privacyHint: "Giữ kín màn hình của bạn",
    confirmButton: "Đã hiểu vai",
    roles: {
      villager: {
        title: "Dân làng",
        instruction: "Quan sát, đặt câu hỏi và cùng ngôi làng tìm ra Ma Sói.",
      },
      wolf: {
        title: "Ma sói",
        instruction: "Phối hợp bí mật với bầy Sói, đánh lạc hướng ngôi làng và sống sót.",
      },
      seer: {
        title: "Tiên tri",
        instruction: "Mỗi đêm soi một người để biết họ có thuộc phe Sói hay không.",
      },
      guardian: {
        title: "Bảo vệ",
        instruction: "Mỗi đêm che chở một người khỏi cuộc săn của bầy Sói.",
      },
      witch: {
        title: "Phù thủy",
        instruction: "Bạn có một bình cứu và một bình độc. Hãy dùng chúng thật khôn ngoan.",
      },
    } satisfies Record<WerewolfRole, { title: string; instruction: string }>,
  },

  night: {
    sharedHint: "Bạn có thể đổi lựa chọn cho đến khi hết giờ.",
    roles: {
      villager: {
        nightExplore: {
          title: "Đêm nay ai khiến bạn trằn trọc?",
          description: "Chọn người bạn đang nghi ngờ nhất. Ghi chú này chỉ mình bạn thấy.",
        },
        wolfLock: {
          title: "Suy nghĩ kỹ thêm một chút…",
          description: "Bạn vẫn có thể thay đổi người mình đang nghi ngờ.",
        },
        nightResolve: {
          title: "Ngôi làng vẫn chìm trong bóng tối",
          description: "Tiếp tục quan sát và ghi nhớ nghi ngờ của bạn cho ngày mai.",
        },
      },
      wolf: {
        nightExplore: {
          title: "Bầy Sói sẽ săn ai đêm nay?",
          description: "Thăm dò mục tiêu và quan sát lựa chọn của đồng đội.",
        },
        wolfLock: {
          title: "Chốt con mồi — chỉ còn 5 giây",
          description: "Đồng thuận với bầy hoặc chấp nhận để số phận quyết định khi hòa.",
        },
        nightResolve: {
          title: "Cuộc săn đã được định đoạt",
          description: "Hãy tiếp tục suy nghĩ xem ngày mai ai sẽ chống lại bạn.",
        },
      },
      seer: {
        nightExplore: {
          title: "Linh cảm đang gọi tên ai?",
          description: "Thăm dò người bạn muốn nhìn thấu trong đêm nay.",
        },
        wolfLock: {
          title: "Bạn muốn nhìn thấu ai?",
          description: "Bạn còn thời gian cân nhắc trước khi chốt lời tiên tri.",
        },
        nightResolve: {
          title: "Chốt người bạn muốn soi",
          description: "Kết quả sẽ được hé lộ riêng cho bạn khi đêm kết thúc.",
        },
      },
      guardian: {
        nightExplore: {
          title: "Ai đang cần được che chở?",
          description: "Bạn không thể bảo vệ lại người đã được bảo vệ đêm trước.",
        },
        wolfLock: {
          title: "Lắng nghe chuyển động trong bóng tối",
          description: "Bạn vẫn có thể thay đổi người cần được bảo vệ.",
        },
        nightResolve: {
          title: "Chốt người bạn muốn bảo vệ",
          description: "Lá chắn chỉ ngăn được cuộc săn của Sói, không ngăn được bình độc.",
        },
      },
      witch: {
        nightExplore: {
          title: "Đêm nay ai khiến bạn nghi ngờ?",
          description: "Người đang chọn cũng sẽ là mục tiêu độc mặc định nếu bạn cần ra tay.",
        },
        wolfLock: {
          title: "Một tiếng động vọng lại trong đêm",
          description: "Hãy chuẩn bị. Bầy Sói sắp chọn xong nạn nhân.",
        },
        nightResolve: {
          title: "Đã đến lúc quyết định",
          description: "Cứu, dùng độc hoặc im lặng để dành bình cho một đêm khác.",
        },
      },
    } satisfies Record<
      WerewolfRole,
      Record<"nightExplore" | "wolfLock" | "nightResolve", { title: string; description: string }>
    >,
    witch: {
      victim: (name: string) => `${name} đang bị Sói tấn công`,
      noVictim: "Đêm nay bầy Sói không chọn được nạn nhân",
      healButton: "Cứu nạn nhân",
      poisonButton: "Đầu độc người đã chọn",
      skipButton: "Không làm gì",
    },
    lockButton: "Chốt lựa chọn",
    wolfLockButton: "Khóa mục tiêu",
    wolfChoicesTitle: "Lựa chọn của bầy",
    wolfThinking: "Đang nghĩ…",
  },

  dawn: {
    title: (day: number) => `Bình minh ngày ${day}`,
    peaceful: "Đêm qua không có ai chết.",
    deaths: (names: string[]) => `${names.join(", ")} đã không qua khỏi đêm.`,
  },

  discussion: {
    title: "Cuộc thảo luận của ngôi làng",
    description: "Chia sẻ suy luận, đặt câu hỏi và tìm ra người đang nói dối.",
    emptyChat: "Chưa có tin nhắn. Hãy mở đầu cuộc thảo luận.",
    inputPlaceholder: "Nhập tin nhắn…",
    deadInputPlaceholder: "Người chết không thể tham gia thảo luận",
    sendButton: "Gửi",
    seerHistoryTitle: "Kết quả soi riêng của bạn",
    wolfResult: "Thuộc phe Sói",
    safeResult: "Không thuộc phe Sói",
    endButton: "Chuyển sang bỏ phiếu",
  },

  voting: {
    title: "Ai sẽ bị xử bắn?",
    description: "Phiếu được giữ kín đến hết giờ.",
    deadMessage: "Bạn đã chết và không thể bỏ phiếu.",
  },

  voteResult: {
    title: "Kết quả bỏ phiếu",
    noVotes: "Không có phiếu hợp lệ.",
    tied: "Phiếu hòa — không ai bị xử bắn.",
    eliminated: (name: string, votes: number) => `${name} bị xử bắn với ${votes} phiếu.`,
  },

  gameEnd: {
    title: {
      village: "Phe Dân chiến thắng!",
      wolves: "Phe Sói chiến thắng!",
    } satisfies Record<WerewolfTeam, string>,
    playAgainButton: "Chơi ván mới",
  },
} as const;
