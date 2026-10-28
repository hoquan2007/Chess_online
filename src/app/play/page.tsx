import Link from "next/link";
import { ArrowRight, Bot, Globe2, Users } from "lucide-react";

export const metadata = { title: "Play chess" };

const modes = [
  { href: "/play/local", title: "Over the board", description: "Share a screen and play a complete local game.", icon: Users },
  { href: "/play/computer", title: "Play the computer", description: "Four difficulty levels and a board of your own.", icon: Bot },
  { href: "/play/online", title: "Online games", description: "Set up your account and prepare for live matches.", icon: Globe2 },
  { href: "/play/friend", title: "Challenge a friend", description: "Private challenge setup and connection status.", icon: Users },
];

export default function PlayPage() {
  return <><p className="overline">Pick your match</p><h1 className="page-title">Let’s play chess.</h1><p className="muted">The board is ready when you are.</p>
    <div className="grid-choices">{modes.map(({ href, title, description, icon: Icon }) => <Link key={href} href={href} className="choice"><Icon size={32} /><div><h2>{title}</h2><small>{description}</small></div><ArrowRight size={19} /></Link>)}</div>
  </>;
}
