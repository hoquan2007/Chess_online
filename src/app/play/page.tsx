import Link from "next/link";
import { ArrowRight, Bot, Globe2, MonitorPlay, Users } from "lucide-react";

export const metadata = { title: "Play chess" };

const modes = [
  { href: "/play/local", number: "01", label: "ON THE SAME SCREEN", title: "Over the board", description: "Two players. One screen. The timeless way to play a complete game.", icon: MonitorPlay, tag: "LOCAL" },
  { href: "/play/computer", number: "02", label: "YOUR PRACTICE PARTNER", title: "Play the computer", description: "Challenge the engine at four levels and sharpen your ideas at your pace.", icon: Bot, tag: "SOLO" },
  { href: "/play/online", number: "03", label: "A BOARD BETWEEN YOU", title: "Online games", description: "Create or join an unrated game with your account and a live board.", icon: Globe2, tag: "ONLINE" },
  { href: "/play/friend", number: "04", label: "MAKE IT PERSONAL", title: "Challenge a friend", description: "Set up a private challenge and invite someone to the board.", icon: Users, tag: "FRIENDS" },
];

export default function PlayPage() {
  return <section className="play-index">
    <div className="play-intro"><div><p className="overline">THE ARENA / CHOOSE YOUR TABLE</p><h1 className="page-title">Let’s play <em>chess.</em></h1><p className="muted">Every game begins with a choice. Where will yours start?</p></div><div className="play-intro-emblem" aria-hidden="true">♞</div></div>
    <div className="play-section-label"><span>SELECT A GAME MODE</span><span>01 — 04</span></div>
    <div className="grid-choices">{modes.map(({ href, number, label, title, description, icon: Icon, tag }) => <Link key={href} href={href} className="choice">
      <div className="choice-top"><span>{number} / THE ARENA</span><span className="choice-tag">{tag}</span></div>
      <div className="choice-icon"><Icon size={35} strokeWidth={1.6} aria-hidden="true" /></div>
      <div className="choice-bottom"><div><span className="choice-kicker">{label}</span><h2>{title}</h2><p>{description}</p></div><span className="choice-arrow"><ArrowRight size={24} aria-hidden="true" /></span></div>
    </Link>)}</div>
    <p className="play-footnote">ROOKLINE STUDIO <span>—</span> A GOOD GAME IS ALWAYS WORTH PLAYING.</p>
  </section>;
}
