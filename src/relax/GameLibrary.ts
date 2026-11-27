import pikachuCoverImg from '../assets/images/relax_pikachu_cover_1795777279234.jpg';

export type RelaxGameId =
  | 'pikachu'
  | 'sudoku'
  | 'minesweeper'
  | '2048'
  | 'caro'
  | 'memory'
  | 'puzzle'
  | 'snake';

export interface RelaxGameCatalogItem {
  id: RelaxGameId;
  title: string;
  subtitle: string;
  description: string;
  genre: string;
  status: 'available' | 'coming_soon';
  coverImage?: string;
  accentHex: string;
}

export const RELAX_GAME_LIBRARY: RelaxGameCatalogItem[] = [
  {
    id: 'pikachu',
    title: 'Pikachu Classic – Pokémon Connect',
    subtitle: 'Nối cặp hình kinh điển',
    description:
      'Ghép đôi các nhân vật Pokémon pixel cổ điển bằng đường nối tối đa 3 đoạn thẳng. Hỗ trợ nhiều độ khó, gợi ý, đổi vị trí và lưu kỷ lục.',
    genre: 'Xếp hình · Nối cặp',
    status: 'available',
    coverImage: pikachuCoverImg,
    accentHex: '#F59E0B',
  },
  {
    id: 'sudoku',
    title: 'Sudoku Cổ Điển',
    subtitle: 'Luyện tư duy logic',
    description:
      'Điền số từ 1 đến 9 vào lưới 9×9 sao cho mỗi hàng, cột và ô vuông con không trùng lặp.',
    genre: 'Logic · Trí tuệ',
    status: 'coming_soon',
    accentHex: '#38BDF8',
  },
  {
    id: 'minesweeper',
    title: 'Minesweeper – Dò Mìn',
    subtitle: 'Kinh điển văn phòng',
    description:
      'Phân tích gợi ý số lượng để mở toàn bộ ô an toàn và cắm cờ chính xác các vị trí có mìn.',
    genre: 'Chiến thuật · Logic',
    status: 'coming_soon',
    accentHex: '#94A3B8',
  },
  {
    id: '2048',
    title: '2048 Hợp Nhất',
    subtitle: 'Trượt số nhẹ nhàng',
    description:
      'Trượt các ô cùng giá trị để gộp đôi thành 2048 với thao tác mượt mà trên cả máy tính và điện thoại.',
    genre: 'Giải đố · Số học',
    status: 'coming_soon',
    accentHex: '#FBBF24',
  },
  {
    id: 'caro',
    title: 'Cờ Caro',
    subtitle: 'Đấu trí 5 nước liên tiếp',
    description:
      'Chơi cờ X-O trên bàn cờ rộng với chế độ đấu máy thông minh hoặc chơi hai người trên cùng thiết bị.',
    genre: 'Cờ bàn · Đối kháng',
    status: 'coming_soon',
    accentHex: '#10B981',
  },
  {
    id: 'memory',
    title: 'Memory Match',
    subtitle: 'Lật thẻ rèn trí nhớ',
    description:
      'Ghi nhớ vị trí các thẻ hình pixel và tìm đủ các cặp giống nhau với ít lượt lật nhất.',
    genre: 'Trí nhớ · Thư giãn',
    status: 'coming_soon',
    accentHex: '#A78BFA',
  },
  {
    id: 'puzzle',
    title: 'Xếp Hình Puzzle',
    subtitle: 'Ghép tranh trượt ô',
    description:
      'Di chuyển các mảnh ghép theo thứ tự để hoàn thiện bức tranh pixel cổ điển hoàn chỉnh.',
    genre: 'Xếp hình · Cổ điển',
    status: 'coming_soon',
    accentHex: '#FB7185',
  },
  {
    id: 'snake',
    title: 'Snake Cổ Điển',
    subtitle: 'Rắn săn mồi retro',
    description:
      'Điều khiển chú rắn ăn điểm và tránh va chạm tường trên màn hình arcade cổ điển.',
    genre: 'Arcade · Phản xạ',
    status: 'coming_soon',
    accentHex: '#34D399',
  },
];
