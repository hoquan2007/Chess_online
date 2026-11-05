import Link from "next/link";
import { ArrowDownRight, ArrowRight, BookOpen, Brain, ChevronRight, Compass, Puzzle, Swords } from "lucide-react";
import { PreviewBoard } from "@/components/PreviewBoard";

const pathways = [
  { href: "/play", number: "01", kicker: "THE ARENA", title: "Play your way.", description: "A match across the table, against the computer, or with a friend online.", icon: Swords, action: "Choose a match" },
  { href: "/puzzles", number: "02", kicker: "THE TRAINING ROOM", title: "See the tactic.", description: "Practice the patterns that make a good move feel inevitable.", icon: Puzzle, action: "Solve puzzles" },
  { href: "/analysis", number: "03", kicker: "THE STUDY DESK", title: "Go one move deeper.", description: "Set up a position, replay your lines, and explore what comes next.", icon: Brain, action: "Open analysis" },
];

export default function Home() {
  return (
    <>
      <section className="hero" aria-labelledby="hero-heading">
        <div className="hero-copy">
          <div className="hero-intro"><span className="hero-intro-dot" aria-hidden="true" /> THE HOME OF YOUR NEXT MOVE <span className="hero-intro-line" aria-hidden="true" /></div>
          <div className="hero-heading-wrap">
            <p className="overline">WELCOME TO ROOKLINE <span className="home-edition">/ THE CHESS STUDIO</span></p>
            <h1 id="hero-heading" className="display-title">Make every move <em>count.</em></h1>
          </div>
          <p className="lead">A space to play boldly, think clearly, and fall in love with the game—one move at a time.</p>
          <div className="hero-actions"><Link href="/play" className="btn primary hero-primary"><Swords size={19} aria-hidden="true" /> Play chess <ArrowRight size={18} aria-hidden="true" /></Link><Link href="/puzzles" className="btn ghost hero-secondary">Solve a puzzle <ArrowRight size={16} aria-hidden="true" /></Link></div>
          <div className="hero-footnote"><span className="hero-footnote-mark">R.</span><span>YOUR BOARD. YOUR PACE.<br />ALWAYS ROOM TO IMPROVE.</span></div>
        </div>
        <div className="hero-board-region">
          <div className="hero-board-rail"><span>POSITION STUDY <strong>001 / ITALIAN GAME</strong></span><span className="board-rail-icon" aria-hidden="true">♞</span></div>
          <div className="hero-board-frame" aria-label="Chess board preview">
            <div className="hero-board-caption"><span className="board-player"><span className="player-symbol dark" aria-hidden="true">♟</span> BLACK <small>Ready to move</small></span><span className="board-turn"><span className="pulse-dot" aria-hidden="true" /> LIVE BOARD</span></div>
            <PreviewBoard />
            <div className="hero-board-caption"><span className="board-player"><span className="player-symbol light" aria-hidden="true">♙</span> WHITE <small>Italian opening</small></span><span className="board-move">03 / 03</span></div>
          </div>
          <div className="hero-board-bottom"><span>THINK FURTHER. PLAY BETTER.</span><span>ROOKLINE <ArrowDownRight size={16} aria-hidden="true" /></span></div>
        </div>
      </section>
      <section className="home-pathways" aria-labelledby="ways-heading">
        <div className="section-header"><div><p className="overline">CHOOSE YOUR DIRECTION / 001</p><h2 id="ways-heading" className="page-title">Find your next game<span className="heading-period">.</span></h2></div><p>From your first opening to your next breakthrough. Start wherever you are.</p></div>
        <div className="feature-row">
          {pathways.map(({ href, number, kicker, title, description, icon: Icon, action }) => <Link className="feature-tile" href={href} key={number}>
            <div className="feature-topline"><span>{number} / 03</span><span className="feature-arrow"><ArrowRight size={19} aria-hidden="true" /></span></div>
            <span className="feature-icon"><Icon size={29} strokeWidth={1.6} aria-hidden="true" /></span>
            <div className="feature-copy"><span className="feature-kicker">{kicker}</span><h3>{title}</h3><p>{description}</p></div>
            <span className="feature-action">{action} <ChevronRight size={16} aria-hidden="true" /></span>
          </Link>)}
        </div>
      </section>
      <section className="home-next" aria-labelledby="next-heading">
        <div className="home-next-copy"><p className="overline">BEYOND THE BOARD / 002</p><h2 id="next-heading">The best move is the one you <em>understand.</em></h2><p>Build an opening repertoire, learn the ideas behind the moves, and keep every game as part of your story.</p><Link href="/learn" className="btn primary">Step into the academy <ArrowRight size={17} aria-hidden="true" /></Link></div>
        <div className="home-next-links"><Link href="/openings"><Compass size={22} aria-hidden="true" /><span><strong>Opening library</strong><small>Explore the first moves of classic lines</small></span><ArrowRight size={18} aria-hidden="true" /></Link><Link href="/games"><BookOpen size={22} aria-hidden="true" /><span><strong>Game archive</strong><small>Revisit the moments that mattered</small></span><ArrowRight size={18} aria-hidden="true" /></Link></div>
      </section>
    </>
  );
}
