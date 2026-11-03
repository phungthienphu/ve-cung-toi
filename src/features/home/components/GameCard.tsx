import Image from 'next/image';
import Link from 'next/link';
import { Medium, Candle } from '@/features/cards/components/Medium';
import { MonsterSprite } from '@/features/mathboss/components/MonsterSprite';
import type { HomeGame } from '../data/games';

export function GameArtwork({ game, featured = false }: { game: HomeGame; featured?: boolean }) {
  if (game.image) return <Image src={game.image} alt="" fill sizes={featured ? '(max-width:760px) 100vw, (max-width:1100px) 65vw, 600px' : '(max-width:760px) 50vw, 300px'} priority={featured} style={{ objectFit: 'cover', objectPosition: game.position }} />;
  if (game.scene === 'seance') return <div className="home-seance"><span className="home-card-suit" aria-hidden>♠</span><Medium mood="idle" talking={false} /><Candle style={{ bottom: 12, left: '12%', width: 12, height: 40 }} /><Candle style={{ bottom: 12, right: '12%', width: 12, height: 40 }} /></div>;
  if (game.scene === 'brawler') return <div className="home-brawler" aria-hidden><Image src="/brawler/character_squareGreen.png" width={110} height={110} alt="" /><span>⚔️</span><Image src="/brawler/character_handPurple.png" width={80} height={80} alt="" /></div>;
  return <div className="home-math" aria-hidden><span>∑ &nbsp; π &nbsp; √x</span><MonsterSprite mood="idle" screen="x²=?" /></div>;
}
export function GameCard({ game, featured = false }: { game: HomeGame; featured?: boolean }) {
  const people = game.minPlayers === game.maxPlayers ? `${game.minPlayers} người` : `${game.minPlayers}–${game.maxPlayers} người`;
  if (!featured) return <Link className="home-game-card" href={game.href} aria-label={`Chơi ${game.title}`} data-game-id={game.id}>
    <div className="home-game-art"><GameArtwork game={game} />{game.isNew && <span className="home-new">NEW</span>}</div>
    <div className="home-game-copy"><span className="home-game-tag">{game.tag}</span><h2>{game.title}</h2><div className="home-game-meta"><span>👥 {people}</span>{game.bots && <span>🤖 Có bot</span>}</div></div>
  </Link>;
  return <article className="home-game-card home-featured" data-game-id={game.id}>
    <Link href={game.href} className="home-game-art" aria-label={`Chơi ${game.title}`}><GameArtwork game={game} featured /><span className="home-new">NEW</span></Link>
    <div className="home-game-copy"><div className="home-badges"><span>{game.tag}</span><span>👥 {people}</span>{game.bots && <span>🤖 Có bot</span>}</div><h2>{game.title}</h2><p>{game.description}</p><div className="home-game-actions"><Link className="home-button home-button-primary" href={game.href}>Chơi ngay <span aria-hidden>→</span></Link><Link className="home-button" href="/con-duong-hoang-kim/friends">👥 Đua với bạn bè</Link></div></div>
  </article>;
}
