"use client";

import { useEffect, useRef, type RefObject } from "react";

type Piece = "q" | "r" | "b" | "n";

const choices = [
  { piece: "q", label: "queen", symbol: "♛" },
  { piece: "r", label: "rook", symbol: "♜" },
  { piece: "b", label: "bishop", symbol: "♝" },
  { piece: "n", label: "knight", symbol: "♞" },
] as const;

export function PromotionDialog({ onChoose, onCancel, fallbackFocusRef }: {
  onChoose: (piece: Piece) => void;
  onCancel: () => void;
  fallbackFocusRef?: RefObject<HTMLElement | null>;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const fallbackFocus = fallbackFocusRef?.current;
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      // The triggering input may become disabled when a move finishes the game
      // or when an online move is awaiting the server.
      if (previousFocus?.isConnected && !previousFocus.matches(":disabled")) previousFocus.focus();
      else fallbackFocus?.focus();
    };
  }, [fallbackFocusRef]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
    if (!buttons?.length) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return <div ref={dialogRef} className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Choose promotion piece" onKeyDown={onKeyDown}>
    <div className="promotion-box">
      <h2>Choose your promotion</h2>
      <div className="promotion-choices">{choices.map(({ piece, label, symbol }) =>
        <button key={piece} type="button" aria-label={`Promote to ${label}`} onClick={() => onChoose(piece)}>{symbol}</button>
      )}</div>
      <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
    </div>
  </div>;
}
