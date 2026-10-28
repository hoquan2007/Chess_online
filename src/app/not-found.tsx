import Link from "next/link";
export default function NotFound() { return <><p className="overline">Page not found</p><h1 className="page-title">This square is empty.</h1><p className="muted">The requested route does not exist.</p><Link href="/" className="btn primary" style={{ marginTop: "var(--space-lg)" }}>Return home</Link></>; }
