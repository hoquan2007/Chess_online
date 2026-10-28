import Link from "next/link";
import { ArrowRight, Brain, Puzzle, Swords } from "lucide-react";
import { PreviewBoard } from "@/components/PreviewBoard";

export default function Home() {
  return (
    <>
      <section className="hero" aria-labelledby="hero-heading">
        <div className="hero-copy">
          <div><p className="overline">Welcome to Rookline</p><h1 id="hero-heading" className="display-title">Make every move count.</h1></div>
          <p className="lead">Your board. Your pace. A better game starts here.</p>
          <div className="hero-actions"><Link href="/play" className="btn primary"><Swords size={18} /> Play chess <ArrowRight size={17} /></Link><Link href="/puzzles" className="btn ghost">Solve a puzzle</Link></div>
        </div>
        <div className="hero-board-frame" aria-label="Chess board preview">
          <div className="hero-board-caption"><span>Opening position</span><span className="muted">Italian Game</span></div>
          <PreviewBoard />
          <div className="hero-board-caption"><span>Think ahead.</span><span className="muted">A board for your next idea</span></div>
        </div>
      </section>
      <section aria-labelledby="ways-heading">
        <h2 id="ways-heading" className="page-title">Find your next game.</h2>
        <div className="feature-row">
          <Link className="feature-tile" href="/play"><Swords size={27} /><div><h3>Play chess</h3><p>Face a friend locally or challenge the computer.</p></div><ArrowRight size={18} /></Link>
          <Link className="feature-tile" href="/puzzles"><Puzzle size={27} /><div><h3>Train your vision</h3><p>Sharpen your tactics with original chess problems.</p></div><ArrowRight size={18} /></Link>
          <Link className="feature-tile" href="/analysis"><Brain size={27} /><div><h3>Study a position</h3><p>Review moves and explore your own PGN.</p></div><ArrowRight size={18} /></Link>
        </div>
      </section>
    </>
  );
}
