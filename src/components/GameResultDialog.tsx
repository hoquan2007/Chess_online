"use client";

import { useEffect, useRef, type RefObject } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";

export function GameResultDialog({ title, detail, onDismiss, onNewGame, analysisHref, fallbackFocusRef }: {
  title: string;
  detail: string;
  onDismiss: () => void;
  onNewGame?: () => void;
  analysisHref?: string;
  fallbackFocusRef?: RefObject<HTMLElement | null>;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const fallbackFocus = fallbackFocusRef?.current;
    dialogRef.current?.querySelector<HTMLElement>("button, a")?.focus();
    return () => {
      if (previousFocus?.isConnected && !previousFocus.matches(":disabled")) previousFocus.focus();
      else fallbackFocus?.focus();
    };
  }, [fallbackFocusRef]);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onDismiss();
      return;
    }
    if (event.key !== "Tab") return;
    const actions = dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]");
    if (!actions?.length) return;
    if (event.shiftKey && document.activeElement === actions[0]) {
      event.preventDefault();
      actions[actions.length - 1].focus();
    } else if (!event.shiftKey && document.activeElement === actions[actions.length - 1]) {
      event.preventDefault();
      actions[0].focus();
    }
  }

  return <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="game-result-title" aria-describedby="game-result-detail" className="modal-backdrop" onKeyDown={onKeyDown}>
    <div className="result-card">
      <div className="result-card-icon" aria-hidden="true"><Trophy size={32} /></div>
      <p className="overline">Game complete</p>
      <h2 id="game-result-title">{title}</h2>
      <p id="game-result-detail">{detail}</p>
      <div className="result-card-actions">
        {onNewGame && <button type="button" className="btn primary" onClick={onNewGame}>New game</button>}
        {analysisHref && <Link className="btn primary" href={analysisHref}>Analyze game</Link>}
        <button type="button" className="btn ghost" onClick={onDismiss}>View board</button>
      </div>
    </div>
  </div>;
}
