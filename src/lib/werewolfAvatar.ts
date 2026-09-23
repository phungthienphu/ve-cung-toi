export function werewolfAvatarUrl(seed: string): string {
  return `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(seed)}&backgroundColor=ecdcb8,f5ead2,e3ecdc`;
}

