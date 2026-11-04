/** Match Vietnamese names with or without accents, including decomposed Unicode. */
export function playerSearchPattern(query: string): string {
  const variants: Record<string, string> = {
    a: 'aàáạảãâầấậẩẫăằắặẳẵ',
    e: 'eèéẹẻẽêềếệểễ',
    i: 'iìíịỉĩ',
    o: 'oòóọỏõôồốộổỗơờớợởỡ',
    u: 'uùúụủũưừứựửữ',
    y: 'yỳýỵỷỹ',
    d: 'dđ',
  };
  return Array.from(query.trim().replace(/^@/, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase())
    .map(char => variants[char] ? `[${variants[char]}][\u0300-\u036f]*` : char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('');
}
