import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiGet } from '@/lib/api';
import { BarChart3, CheckCircle2, Download, FileQuestion, ShieldAlert, XCircle } from 'lucide-react';

interface TopicSummary {
  topic: string; subtopic: string; total: number; answered: number; correct: number; score: number; maxScore: number;
}
interface QuestionResult {
  id: string; round: string; prompt: string; topic: string; subtopic: string;
  answered: boolean; answer: string; correctAnswer: string | null; result: 'correct' | 'review' | 'unanswered'; score: number; maxScore: number;
}
interface Report {
  status: string; section: string | null; questionCount: number; answeredCount: number; unansweredCount: number;
  score: number; maxScore: number; percentage: number; durationSeconds: number | null;
  topicSummary: TopicSummary[]; questions: QuestionResult[];
  violations: Array<{ type: string; severity: string; message: string }>;
}

const ExamReport = ({ sessionId, onContinue }: { sessionId: string; onContinue: () => void }) => {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'correct' | 'review' | 'unanswered'>('all');

  useEffect(() => {
    apiGet<{ report: Report }>(`/api/exam/sessions/${sessionId}/report`)
      .then(({ report: result }) => setReport(result))
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load the exam report.'));
  }, [sessionId]);

  const filteredQuestions = useMemo(
    () => report?.questions.filter((question) => filter === 'all' || question.result === filter) ?? [],
    [filter, report],
  );

  if (error) return <Card className="w-full max-w-lg bg-slate-900 border-red-500/50"><CardContent className="p-6 text-red-300">{error}</CardContent></Card>;
  if (!report) return <Card className="w-full max-w-lg bg-slate-900 border-slate-700"><CardContent className="p-6 text-white">Generating your detailed exam report...</CardContent></Card>;

  const timeUsed = report.durationSeconds === null ? '—' : `${Math.floor(report.durationSeconds / 60)}m ${report.durationSeconds % 60}s`;
  const correctCount = report.questions.filter((question) => question.result === 'correct').length;
  const reviewCount = report.questions.filter((question) => question.result === 'review').length;

  return (
    <div className="report-print-area hirex-report w-full max-w-6xl">
      <style>{`@media print { body { background: white !important; } .report-no-print { display: none !important; } .report-print-area { max-width: none !important; color: #111827 !important; } .report-print-area * { color: #111827 !important; border-color: #d1d5db !important; background: white !important; } .report-break { break-inside: avoid; } }`}</style>
      <div className="flex items-center justify-between mb-5 report-no-print">
        <div><h1 className="text-2xl font-bold text-white">Detailed exam report</h1><p className="text-slate-400">Performance, question analysis, topic coverage and proctoring review.</p></div>
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"><Download className="w-4 h-4" />Export PDF</button>
      </div>
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-5">
          {[['Score', `${report.score}/${report.maxScore}`], ['Percentage', `${report.percentage}%`], ['Questions', String(report.questionCount)], ['Answered', `${report.answeredCount}`], ['Time used', timeUsed]].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-700 bg-slate-900 p-4"><p className="text-xs text-slate-400">{label}</p><p className="text-xl font-semibold text-white">{value}</p></div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 report-no-print">
          <Badge className="bg-green-900 text-green-200"><CheckCircle2 className="w-3 h-3 mr-1" />{correctCount} correct</Badge>
          <Badge className="bg-blue-900 text-blue-200">{reviewCount} incorrect/partial</Badge>
          <Badge className="bg-amber-900 text-amber-200"><XCircle className="w-3 h-3 mr-1" />{report.unansweredCount} unanswered</Badge>
          <Badge className="bg-slate-800 text-slate-300"><ShieldAlert className="w-3 h-3 mr-1" />{report.violations.length} proctoring events</Badge>
        </div>

        <Card className="bg-slate-900 border-slate-700 report-break">
          <CardHeader><CardTitle className="text-white flex items-center gap-2"><BarChart3 className="w-5 h-5 text-blue-400" />Topic performance graph</CardTitle></CardHeader>
          <CardContent className="space-y-4">{report.topicSummary.map((item) => {
            const percentage = item.maxScore ? Math.round((item.score / item.maxScore) * 100) : 0;
            return <div key={`${item.topic}-${item.subtopic}`}><div className="flex justify-between text-sm mb-1"><span className="text-slate-200">{item.topic} · {item.subtopic}</span><span className="text-slate-400">{percentage}% · {item.answered}/{item.total} answered</span></div><div className="h-3 rounded bg-slate-800 overflow-hidden"><div className={`h-full ${percentage >= 70 ? 'bg-green-500' : percentage >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${percentage}%` }} /></div></div>;
          })}</CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700 report-break">
          <CardHeader><CardTitle className="text-white">Topic and subtopic analysis</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-slate-700 text-left text-slate-400"><th className="p-2">Topic</th><th className="p-2">Subtopic</th><th className="p-2">Total</th><th className="p-2">Answered</th><th className="p-2">Correct</th><th className="p-2">Score</th></tr></thead><tbody>{report.topicSummary.map((item) => <tr key={`${item.topic}-${item.subtopic}`} className="border-b border-slate-800 text-slate-200"><td className="p-2">{item.topic}</td><td className="p-2">{item.subtopic}</td><td className="p-2">{item.total}</td><td className="p-2">{item.answered}</td><td className="p-2">{item.correct}</td><td className="p-2">{item.score}/{item.maxScore}</td></tr>)}</tbody></table></CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader><div className="flex items-center justify-between gap-3"><CardTitle className="text-white flex items-center gap-2"><FileQuestion className="w-5 h-5 text-cyan-400" />Question-by-question analysis</CardTitle><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="report-no-print rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-white"><option value="all">All questions</option><option value="correct">Correct</option><option value="review">Incorrect/partial</option><option value="unanswered">Unanswered</option></select></div></CardHeader>
          <CardContent className="space-y-3">{filteredQuestions.map((question, index) => <div key={question.id} className="rounded-lg border border-slate-700 bg-slate-800/60 p-3 report-break"><div className="flex items-start gap-2"><span className="text-slate-400 text-sm">{index + 1}.</span><div className="flex-1"><p className="text-white text-sm font-medium">{question.prompt}</p><p className="text-xs text-slate-400 mt-1">{question.topic} · {question.subtopic} · {question.score}/{question.maxScore}</p>{question.answer ? <p className="text-xs text-slate-300 mt-2"><strong>Your answer:</strong> {question.answer}</p> : <p className="text-xs text-amber-300 mt-2">Not answered</p>}{question.correctAnswer && question.result !== 'correct' && <p className="text-xs text-green-300 mt-1"><strong>Expected answer:</strong> {question.correctAnswer}</p>}</div><Badge className={question.result === 'correct' ? 'bg-green-900 text-green-200' : question.result === 'unanswered' ? 'bg-amber-900 text-amber-200' : 'bg-blue-900 text-blue-200'}>{question.result}</Badge></div></div>)}</CardContent>
        </Card>

        {report.violations.length > 0 && <Card className="bg-slate-900 border-slate-700 report-break"><CardHeader><CardTitle className="text-white">Proctoring activity</CardTitle></CardHeader><CardContent><ul className="space-y-1 text-sm text-amber-200">{report.violations.map((item, index) => <li key={`${item.type}-${index}`}>{item.type}: {item.message}</li>)}</ul></CardContent></Card>}
        <button onClick={onContinue} className="report-no-print w-full rounded-lg bg-blue-600 py-2 text-white hover:bg-blue-700">Continue</button>
      </div>
    </div>
  );
};

export default ExamReport;
