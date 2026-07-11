import { supabase } from './supabase';
import { calculateSemanticSimilarity } from '@/utils/semanticSimilarity';

export type RoundName = 'technical' | 'personal' | 'hr';

export interface QuestionBankRow {
  id: string;
  round: RoundName;
  qtype: 'mcq' | 'coding' | 'behavioral';
  category: string | null;
  prompt: string;
  options: string[] | null;
  correct_answer: string | null;
  points: number;
}

export async function fetchRoundQuestions(companyId: string, round: RoundName): Promise<QuestionBankRow[]> {
  const { data, error } = await supabase
    .from('question_bank')
    .select('id, round, qtype, category, prompt, options, correct_answer, points')
    .eq('company_id', companyId)
    .eq('round', round);
  if (error) throw error;
  return (data as QuestionBankRow[]) ?? [];
}

/** MCQ: full points if exact match. Coding/behavioral: semantic-similarity partial credit, weighted by points. */
export function scoreAnswer(question: QuestionBankRow, answer: string): number {
  if (!answer) return 0;
  if (question.qtype === 'mcq') {
    return answer === question.correct_answer ? question.points : 0;
  }
  const similarity = calculateSemanticSimilarity(answer, question.correct_answer ?? '');
  return similarity * question.points;
}

export interface PersistedResponse {
  session_id: string;
  question_id: string;
  round: RoundName;
  answer: string;
  score: number;
}

export async function submitRoundResponses(responses: PersistedResponse[]): Promise<void> {
  if (responses.length === 0) return;
  const { error } = await supabase.from('exam_responses').insert(responses);
  if (error) throw error;
}

/** Persists the round's score/pct, advances current_round, and finalizes the session after HR. */
export async function recordRoundScore(sessionId: string, round: RoundName, score: number, pct: number): Promise<void> {
  const { error } = await supabase.rpc('record_round_score', {
    p_session_id: sessionId,
    p_round: round,
    p_score: score,
    p_pct: pct,
  });
  if (error) throw error;
}
