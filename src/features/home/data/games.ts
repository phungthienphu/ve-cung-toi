export type GameFilter = 'all' | 'bots' | 'solo' | 'group';
export interface HomeGame {
  id: string; href: string; title: string; description: string; tag: string;
  minPlayers: number; maxPlayers: number; solo: boolean; bots: boolean;
  image?: string; position?: string; scene?: 'seance' | 'ships'; isNew?: boolean;
}
export const HOME_GAMES: HomeGame[] = [
  { id: 'hill', href: '/con-duong-hoang-kim', title: 'Con Đường Hoàng Kim', description: 'Leo dốc, bay qua vực, lấy đà nhảy lên đảo lơ lửng. Phá kỷ lục một mình, đua với bot hoặc rủ cả hội vào húc nhau.', tag: 'Đua xe địa hình', minPlayers: 1, maxPlayers: 6, solo: true, bots: true, image: '/racing-with-me.png', position: '45% 45%', isNew: true },
  { id: 'oldmaid', href: '/ai-la-heo', title: 'Ai Là Heo', description: 'Rút bài, nhử nhau, đọc mặt nhau. Ai giữ Joker cuối cùng là heo!', tag: 'Rút bài 3D', minPlayers: 2, maxPlayers: 6, solo: true, bots: true, image: '/ai-la-heo.png', position: '50% 40%', isNew: true },
  { id: 'fortune', href: '/card-draw', title: 'Bà Đồng Xem Bài', description: 'Rút một lá bài, nghe bà đồng luận quẻ và mang lời nhắn về.', tag: 'Xem bói', minPlayers: 1, maxPlayers: 1, solo: true, bots: false, scene: 'seance', isNew: true },
  { id: 'werewolf', href: '/werewolf', title: 'Ma Sói', description: 'Đêm xuống tìm sói, sáng ra cả làng cùng suy luận.', tag: 'Suy luận nhóm', minPlayers: 5, maxPlayers: 12, solo: true, bots: true, image: '/ma-soi/bg-ma-soi.webp', position: '52% 70%' },
  { id: 'draw', href: '/draw-guess', title: 'Vẽ Cùng Tôi', description: 'Một người vẽ, cả hội đoán. Vẽ càng méo, cười càng vui.', tag: 'Vẽ & đoán chữ', minPlayers: 2, maxPlayers: 20, solo: false, bots: false, image: '/bg-ve-cung-toi.png', position: '50% 40%' },
  { id: 'tank', href: '/tank-game', title: 'Đại Chiến Xe Tăng', description: 'Chạy, ngắm và bắn! Luyện một mình hoặc đấu với hội bạn và bot.', tag: 'Bắn tăng', minPlayers: 1, maxPlayers: 8, solo: true, bots: true, image: '/tank/tank-bg.png', position: '28% 42%' },
  { id: 'soccer', href: '/soccer', title: 'Sân Cỏ Đẫm Máu', description: 'Chia đội, xoạc bóng, tung cú sút quyết định.', tag: 'Bóng đá', minPlayers: 1, maxPlayers: 8, solo: true, bots: true, image: '/soccer/bg-soccer.png', position: '40% 45%' },
  { id: 'battleship', href: '/battleship', title: 'Hải Chiến', description: 'Giấu hạm đội, đoán tọa độ và đánh chìm tàu đối thủ.', tag: 'Bắn tàu', minPlayers: 2, maxPlayers: 8, solo: true, bots: true, scene: 'ships' },
];
export const GAME_FILTERS: { id: GameFilter; label: string }[] = [
  { id: 'all', label: 'Tất cả' }, { id: 'bots', label: 'Có bot' }, { id: 'solo', label: 'Chơi một mình' }, { id: 'group', label: 'Nhóm đông' },
];
export function filterGames(filter: GameFilter) {
  return HOME_GAMES.filter(game => filter === 'all' || (filter === 'bots' && game.bots) || (filter === 'solo' && game.solo) || (filter === 'group' && game.maxPlayers >= 5));
}
