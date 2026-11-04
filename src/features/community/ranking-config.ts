export const RANKING_GAMES = [
  { id: 'hill', title: 'Tay lái dân tổ', name: 'Con Đường Hoàng Kim', unit: 'm', metric: 'Kỷ lục quãng đường xa nhất', kind: 'distance' },
  { id: 'draw', title: 'Họa sĩ của năm', name: 'Vẽ Cùng Tôi', unit: 'điểm', metric: 'Tổng điểm từ các trận đã xác thực', kind: 'score' },
  { id: 'tank', title: 'Chiến thần thiết giáp', name: 'Đại Chiến Xe Tăng', unit: 'điểm', metric: 'Tổng điểm từ các trận đã xác thực', kind: 'score' },
  { id: 'soccer', title: 'Huyền thoại sân cỏ', name: 'Sân Cỏ Đẫm Máu', unit: 'điểm', metric: 'Tổng điểm từ các trận đã xác thực', kind: 'score' },
  { id: 'werewolf', title: 'Bậc thầy đêm trăng', name: 'Ma Sói', unit: 'thắng', metric: 'Số trận thắng đã xác thực', kind: 'wins' },
  { id: 'battleship', title: 'Đô đốc bất bại', name: 'Hải Chiến', unit: 'thắng', metric: 'Số trận thắng đã xác thực', kind: 'wins' },
  { id: 'oldmaid', title: 'Thánh né heo', name: 'Ai Là Heo', unit: 'thắng', metric: 'Số trận thắng đã xác thực', kind: 'wins' },
] as const;
export type RankingGame = typeof RANKING_GAMES[number];
export type RankedPlayer = { playerId: string; name: string; username?: string; score: number };
export type RankingPage = { items: RankedPlayer[]; nextOffset: number | null };
export type GameRankingPreview = { gameId: string; page: RankingPage };
