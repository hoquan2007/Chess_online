import { lessonLines, openingLines } from "./study";

export const studyProgressKey = "rookline-study-practice";

const knownPracticeKeys = new Set(
  [...openingLines, ...lessonLines].flatMap((line) => [`${line.id}:w`, `${line.id}:b`]),
);

export function sanitizeStudyCompletions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((entry): entry is string => typeof entry === "string" && knownPracticeKeys.has(entry)))];
}

export function mergeStudyCompletions(...lists: readonly (readonly string[])[]): string[] {
  return sanitizeStudyCompletions(lists.flat());
}

export function readStudyCompletions(): string[] {
  try {
    return sanitizeStudyCompletions(JSON.parse(localStorage.getItem(studyProgressKey) ?? "[]"));
  } catch {
    return [];
  }
}

export function recordStudyCompletion(inMemory: readonly string[], key: string): string[] {
  // Another tab may have saved a different line since this component last rendered.
  const next = mergeStudyCompletions(readStudyCompletions(), inMemory, [key]);
  try {
    localStorage.setItem(studyProgressKey, JSON.stringify(next));
  } catch {
    // Keep the mastered line in component state when storage is unavailable.
  }
  return next;
}
