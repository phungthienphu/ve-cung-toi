import { HomeIcon } from './HomeIcon';
import Image from 'next/image';
import Link from 'next/link';
import type { HomeGame } from '../data/games';

export function GameArtwork({ game, featured = false }: { game: HomeGame; featured?: boolean }) {
  if (game.image) return <Image src={game.image} alt="" fill sizes={featured ? '(max-width:760px) 100vw, (max-width:1100px) 65vw, 600px' : '(max-width:760px) 50vw, 300px'} priority={featured} style={{ objectFit: 'cover', objectPosition: game.position }} />;
  if (game.scene === 'seance') return <div className="home-playing-cards" aria-hidden><span /><span /><span>A<svg width="18" height="18" viewBox="0 0 24 24"><path d="M12 2C9 6 4 9 4 13a4 4 0 0 0 7 2.6V17l-2 4h6l-2-4v-1.4A4 4 0 0 0 20 13c0-4-5-7-8-11z" fill="currentColor" /></svg></span></div>;
  return <div className="home-ships" aria-hidden>{[
    [10,22,30,15], [60,14,4,58], [22,62,20,15], [76,40,16,15],
  ].map(([left,top,width,height],index) => <span className="home-ship" key={index} style={{left:`${left}%`,top:`${top}%`,width:`${width}%`,height:`${height}%`}} />)}{[[18,24],[60.4,30],[82,42]].map(([left,top],index)=><span className="home-ship-hit" key={index} style={{left:`${left}%`,top:`${top}%`}} />)}{[[48,46],[70,80],[8,76],[90,14]].map(([left,top],index)=><span className="home-ship-miss" key={index} style={{left:`${left}%`,top:`${top}%`}} />)}</div>;
}
export function GameCard({ game, featured = false }: { game: HomeGame; featured?: boolean }) {
  const people = game.minPlayers === game.maxPlayers ? `${game.minPlayers} người` : `${game.minPlayers}–${game.maxPlayers} người`;
  if (!featured) return <Link className={`home-game-card${game.id === 'battleship' ? ' home-wide' : ''}`} href={game.href} aria-label={`Chơi ${game.title}`} data-game-id={game.id}>
    <div className="home-game-art"><GameArtwork game={game} />{game.isNew && <span className="home-new">NEW</span>}</div>
    <div className="home-game-copy"><span className="home-game-tag">{game.tag}</span><h2>{game.title}</h2><div className="home-game-meta"><span><HomeIcon name="users" />{people}</span>{game.bots && <span><HomeIcon name="bot" />Có bot</span>}</div></div>
  </Link>;
  return <article className="home-game-card home-featured" data-game-id={game.id}>
    <Link href={game.href} className="home-game-art" aria-label={`Chơi ${game.title}`}><GameArtwork game={game} featured /><span className="home-new">NEW</span></Link>
    <div className="home-game-copy"><div className="home-badges"><span>{game.tag}</span><span><HomeIcon name="users" />{people}</span>{game.bots && <span><HomeIcon name="bot" />Có bot</span>}</div><h2>{game.title}</h2><p>{game.description}</p><div className="home-game-actions"><Link className="home-button home-button-primary" href={game.href}>Chơi ngay <span aria-hidden>→</span></Link><Link className="home-button" href="/con-duong-hoang-kim/friends"><HomeIcon name="users" />Đua với bạn bè</Link></div></div>
  </article>;
}
