import { SettingsPanel } from "@/components/SettingsPanel";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return <section className="stack"><div><p className="overline">Your workspace</p>
    <h1 className="page-title">Make the board yours.</h1>
    <p className="muted">Adjust how Rookline looks and sounds.</p></div>
    <SettingsPanel />
  </section>;
}
