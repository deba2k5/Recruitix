import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, Clock, Code2 } from 'lucide-react';
import type { QuestionBankRow } from '@/lib/examRounds';
import QuestionNavigator from './QuestionNavigator';

interface CodingRoundViewProps {
  durationMin: number;
  questions: QuestionBankRow[];
  onSubmit: (result: { score: number; pct: number; answers: Record<string, string> }) => void;
}

const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

const CodingRoundView = ({ durationMin, questions, onSubmit }: CodingRoundViewProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [language, setLanguage] = useState('Python');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(durationMin * 60);
  const question = questions[currentIndex];
  const maxPoints = useMemo(() => questions.reduce((sum, item) => sum + item.points, 0), [questions]);

  useEffect(() => {
    if (timeLeft <= 0) {
      submit();
      return;
    }
    const timer = setTimeout(() => setTimeLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  useEffect(() => {
    if (!question || answers[question.id]) return;
    const starter = question.starterCode?.[language] ?? '';
    setAnswers((previous) => ({ ...previous, [question.id]: starter }));
  }, [answers, language, question]);

  const submit = () => {
    const score = questions.reduce((total, item) => total + (answers[item.id]?.trim() ? item.points : 0), 0);
    onSubmit({ score, pct: maxPoints ? Math.round((score / maxPoints) * 100) : 0, answers });
  };

  if (questions.length === 0) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">No coding questions configured.</div>;
  }

  const isLast = currentIndex === questions.length - 1;
  const changeLanguage = (value: string) => {
    setLanguage(value);
    if (!answers[question.id]?.trim() || answers[question.id] === question.starterCode?.[language]) {
      setAnswers((previous) => ({ ...previous, [question.id]: question.starterCode?.[value] ?? '' }));
    }
  };

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-6xl mx-auto py-8 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Code2 className="w-7 h-7 text-cyan-400" />
            <h1 className="text-2xl font-bold text-white">Coding 1 · DSA</h1>
          </div>
          <Badge className="bg-slate-800 text-white flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(timeLeft)}</Badge>
        </div>
        <Progress value={((currentIndex + 1) / questions.length) * 100} className="h-2" />
        <p className="text-slate-400 text-sm">Problem {currentIndex + 1} of {questions.length} · {question.category}</p>

        <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)_minmax(0,1fr)]">
          <QuestionNavigator questions={questions} currentIndex={currentIndex} answers={answers} onSelect={setCurrentIndex} />
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader><CardTitle className="text-white">{question.prompt}</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-300">
              <p>{question.description}</p>
              <div><h3 className="font-semibold text-white mb-1">Input</h3><p className="whitespace-pre-wrap">{question.inputFormat}</p></div>
              <div><h3 className="font-semibold text-white mb-1">Output</h3><p>{question.outputFormat}</p></div>
              <div><h3 className="font-semibold text-white mb-1">Constraints</h3><ul className="list-disc pl-5">{question.constraints?.map((item) => <li key={item}>{item}</li>)}</ul></div>
              <div><h3 className="font-semibold text-white mb-2">Visible test cases ({question.visibleTestCases ?? 0})</h3>
                <div className="space-y-2">{question.examples?.map((example, index) => (
                  <div key={`${example.input}-${index}`} className="rounded border border-slate-700 bg-slate-800 p-2">
                    <p><span className="text-slate-400">Input:</span> <code>{example.input}</code></p>
                    <p><span className="text-slate-400">Output:</span> <code>{example.output}</code></p>
                    {example.explanation && <p className="text-slate-400 mt-1">{example.explanation}</p>}
                  </div>
                ))}</div>
                <p className="text-xs text-slate-500 mt-2">The evaluator also runs {question.hiddenTestCases ?? 0} hidden test cases.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">Your solution</CardTitle>
                <select value={language} onChange={(event) => changeLanguage(event.target.value)} className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white">
                  {(question.supportedLanguages ?? ['C', 'C++', 'Java', 'Python']).map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
              <p className="text-xs text-slate-400">Supported languages: C, C++, Java, Python</p>
            </CardHeader>
            <CardContent>
              <textarea
                value={answers[question.id] ?? ''}
                onChange={(event) => setAnswers((previous) => ({ ...previous, [question.id]: event.target.value }))}
                spellCheck={false}
                className="min-h-[520px] w-full resize-y rounded border border-slate-600 bg-slate-950 p-4 font-mono text-sm text-green-200 outline-none focus:border-cyan-500"
                aria-label={`Solution code in ${language}`}
              />
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" disabled={currentIndex === 0} onClick={() => setCurrentIndex((value) => value - 1)} className="bg-transparent border-slate-600 text-slate-300 hover:bg-slate-800"><ChevronLeft className="w-4 h-4 mr-1" />Previous</Button>
          {isLast ? <Button onClick={submit} className="bg-green-600 hover:bg-green-700 text-white">Submit Coding 1</Button> : <Button onClick={() => setCurrentIndex((value) => value + 1)} className="bg-blue-600 hover:bg-blue-700 text-white">Next<ChevronRight className="w-4 h-4 ml-1" /></Button>}
        </div>
      </div>
    </div>
  );
};

export default CodingRoundView;
