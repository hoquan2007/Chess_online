"use client";

import { Chessboard } from "react-chessboard";

export function PreviewBoard() {
  return <Chessboard options={{ id: "rookline-preview", position: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", allowDragging: false, showNotation: false, lightSquareStyle: { backgroundColor: "var(--board-light)" }, darkSquareStyle: { backgroundColor: "var(--board-dark)" }, boardStyle: { borderRadius: "10px", overflow: "hidden", width: "100%" } }} />;
}
