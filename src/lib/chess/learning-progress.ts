import { puzzles } from "./puzzles";
import { lessonLines, openingLines } from "./study";

export type LearningKind = "puzzle" | "study";

const allowed: Record<LearningKind, ReadonlySet<string>> = {
  puzzle: new Set(puzzles.map((puzzle) => puzzle.id)),
  study: new Set([...lessonLines, ...openingLines].flatMap((line) => [`${line.id}:w`, `${line.id}:b`])),
};

export function knownLearningIds(kind: LearningKind, items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  return [...new Set(items.filter((item): item is string => typeof item === "string" && allowed[kind].has(item)))];
}

export function parseLearningWrite(value: unknown):
  | { ok: true; kind: LearningKind; ids: string[] }
  | { ok: false } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false };
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => key !== "kind" && key !== "ids") ||
    (input.kind !== "puzzle" && input.kind !== "study") || !Array.isArray(input.ids) ||
    input.ids.length === 0 || input.ids.length > 64) return { ok: false };
  const ids = knownLearningIds(input.kind, input.ids);
  if (ids.length !== input.ids.length || ids.length === 0) return { ok: false };
  return { ok: true, kind: input.kind, ids };
}
