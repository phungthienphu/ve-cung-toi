export const ADMIN_SECTIONS = [
  { id: 'overview', label: 'Tổng quan', icon: '◫', description: 'Hoạt động của hệ thống trong 30 ngày gần nhất.' },
  { id: 'users', label: 'Người dùng', icon: '♧', description: 'Tìm kiếm và quản lý quyền truy cập tài khoản.' },
  { id: 'games', label: 'Trò chơi', icon: '▦', description: 'Quản lý danh mục và trạng thái phục vụ trò chơi.' },
  { id: 'impressions', label: 'Thống kê', icon: '▥', description: 'Lượt xem trang chủ và lượt vào game theo ngày.' },
  { id: 'feedback', label: 'Hộp thư hỗ trợ', icon: '✉', description: 'Nhận góp ý, báo lỗi và trả lời người chơi chủ động liên hệ.' },
  { id: 'reports', label: 'Báo cáo', icon: '⚑', description: 'Xem phản ánh từ người chơi và xử lý tài khoản liên quan.' },
  { id: 'audit', label: 'Nhật ký', icon: '◷', description: 'Theo dõi các thao tác quản trị đã thực hiện.' },
] as const;
export type AdminSection = typeof ADMIN_SECTIONS[number]['id'];
