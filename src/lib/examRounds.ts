import { apiGet, apiPost } from './api';
import { calculateSemanticSimilarity } from '@/utils/semanticSimilarity';

export type RoundName = 'technical' | 'personal' | 'hr';

export interface QuestionBankRow {
  id: string;
  round: RoundName;
  qtype: 'mcq' | 'coding' | 'behavioral';
  category: string | null;
  prompt: string;
  options: string[] | null;
  correctAnswer: string | null;
  points: number;
}

export async function fetchRoundQuestions(companyId: string, round: RoundName): Promise<QuestionBankRow[]> {
  const { questions } = await apiGet<{ questions: QuestionBankRow[] }>(
    `/api/question-bank?companyId=${encodeURIComponent(companyId)}&round=${encodeURIComponent(round)}`,
  );
  return questions;
}

/** MCQ: full points if exact match. Coding/behavioral: semantic-similarity partial credit, weighted by points. */
export function scoreAnswer(question: QuestionBankRow, answer: string): number {
  if (!answer) return 0;
  if (question.qtype === 'mcq') {
    return answer === question.correctAnswer ? question.points : 0;
  }
  const similarity = calculateSemanticSimilarity(answer, question.correctAnswer ?? '');
  return similarity * question.points;
}

export interface PersistedResponse {
  questionId: string;
  round: RoundName;
  answer: string;
  score: number;
}

export async function submitRoundResponses(sessionId: string, responses: PersistedResponse[]): Promise<void> {
  if (responses.length === 0) return;
  await apiPost(`/api/exam/sessions/${sessionId}/responses`, { responses });
}

/** Persists the round's score/pct, advances current round, and finalizes the session after HR. */
export async function recordRoundScore(sessionId: string, round: RoundName, score: number, pct: number): Promise<void> {
  await apiPost(`/api/exam/sessions/${sessionId}/round-score`, { round, score, pct });
}
