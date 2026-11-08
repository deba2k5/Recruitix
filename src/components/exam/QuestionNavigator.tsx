import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Circle } from 'lucide-react';
import type { QuestionBankRow } from '@/lib/examRounds';

interface QuestionNavigatorProps {
  questions: QuestionBankRow[];
  currentIndex: number;
  answers: Record<string, string>;
  onSelect: (index: number) => void;
}

const QuestionNavigator = ({ questions, currentIndex, answers, onSelect }: QuestionNavigatorProps) => {
  const grouped = questions.reduce<Map<string, { subtopic: string; indexes: number[] }[]>>((groups, question, index) => {
    const topic = question.category || 'General';
    const subtopic = question.subtopic || question.qtype || 'Question';
    const entries = groups.get(topic) ?? [];
    const entry = entries.find((item) => item.subtopic === subtopic);
    if (entry) entry.indexes.push(index);
    else entries.push({ subtopic, indexes: [index] });
    groups.set(topic, entries);
    return groups;
  }, new Map());

  return (
    <Card className="bg-slate-900 border-slate-700 lg:sticky lg:top-20 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
      <CardHeader>
        <CardTitle className="text-white text-base">Questions and sections</CardTitle>
        <p className="text-xs text-slate-400">{Object.keys(answers).filter((id) => answers[id]?.trim()).length} answered · {questions.length - Object.keys(answers).filter((id) => answers[id]?.trim()).length} left</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {[...grouped.entries()].map(([topic, subtopics]) => (
          <div key={topic} className="space-y-2">
            <div className="flex justify-between text-xs font-semibold text-slate-300">
              <span>{topic}</span><span>{subtopics.reduce((sum, item) => sum + item.indexes.length, 0)}</span>
            </div>
            {subtopics.map((subtopic) => (
              <div key={`${topic}-${subtopic.subtopic}`} className="space-y-1">
                <p className="text-[11px] text-slate-500">{subtopic.subtopic} · {subtopic.indexes.filter((index) => answers[questions[index].id]?.trim()).length}/{subtopic.indexes.length}</p>
                <div className="grid grid-cols-5 gap-1">
                  {subtopic.indexes.map((index) => {
                    const answered = Boolean(answers[questions[index].id]?.trim());
                    return (
                      <button
                        key={questions[index].id}
                        type="button"
                        onClick={() => onSelect(index)}
                        className={`flex items-center justify-center rounded px-1 py-1 text-xs ${currentIndex === index ? 'bg-blue-600 text-white' : answered ? 'bg-green-900/60 text-green-200' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                        aria-label={`Question ${index + 1}${answered ? ', answered' : ', unanswered'}`}
                      >
                        {answered ? <CheckCircle2 className="w-3 h-3 mr-0.5" /> : <Circle className="w-3 h-3 mr-0.5" />}{index + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default QuestionNavigator;
