import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Clock, Mic, Play, Square, Volume2 } from 'lucide-react';
import { apiPost } from '@/lib/api';
import type { QuestionBankRow } from '@/lib/examRounds';
import { scoreAnswer } from '@/lib/examRounds';
import QuestionNavigator from './QuestionNavigator';

interface TechnicalInterviewViewProps {
  sessionId: string;
  durationMin: number;
  questions: QuestionBankRow[];
  onQuestionsUpdate: (questions: QuestionBankRow[]) => void;
  onSubmit: (result: { score: number; pct: number; answers: Record<string, string> }) => void;
}

const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

const TechnicalInterviewView = ({ sessionId, durationMin, questions, onQuestionsUpdate, onSubmit }: TechnicalInterviewViewProps) => {
  const [cvName, setCvName] = useState('');
  const [cvKeywords, setCvKeywords] = useState<string[]>([]);
  const [cvError, setCvError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(durationMin * 60);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const question = questions[currentIndex];
  const maxPoints = useMemo(() => questions.reduce((sum, item) => sum + item.points, 0), [questions]);

  useEffect(() => {
    if (timeLeft <= 0) {
      finish();
      return;
    }
    const timer = window.setTimeout(() => setTimeLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  const finish = () => {
    const score = questions.reduce((sum, item) => sum + scoreAnswer(item, answers[item.id] ?? ''), 0);
    onSubmit({ score, pct: maxPoints ? Math.round((score / maxPoints) * 100) : 0, answers });
  };

  const uploadCv = async (file: File) => {
    setCvError('');
    try {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunkSize = 0x8000;
        for (let index = 0; index < bytes.length; index += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunkSize, bytes.length)));
        }
        const fileBase64 = btoa(binary);
        const result = await apiPost<{ keywords: string[]; questions: QuestionBankRow[] }>(`/api/exam/sessions/${sessionId}/cv`, {
          fileName: file.name,
          fileBase64,
          contentType: 'application/pdf',
        });
        setCvName(file.name);
        setCvKeywords(result.keywords);
        if (result.questions.length) {
          onQuestionsUpdate(result.questions);
          setCurrentIndex(0);
          setAnswers({});
        }
        return;
      }
      const text = await file.text();
      const result = await apiPost<{ keywords: string[]; questions: QuestionBankRow[] }>(`/api/exam/sessions/${sessionId}/cv`, { fileName: file.name, text });
      setCvName(file.name);
      setCvKeywords(result.keywords);
      if (result.questions.length) {
        onQuestionsUpdate(result.questions);
        setCurrentIndex(0);
        setAnswers({});
      }
    } catch (error) {
      setCvError(error instanceof Error ? error.message : 'Unable to upload the CV.');
    }
  };

  const speak = () => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    if (playingId === question.id) {
      setPlayingId(null);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(question.prompt);
    utterance.onend = () => setPlayingId(null);
    setPlayingId(question.id);
    window.speechSynthesis.speak(utterance);
  };

  const recordVoice = async () => {
    if (recordingId === question.id) {
      recorderRef.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !('MediaRecorder' in window)) {
      setCvError('Voice recording is not supported by this browser.');
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find((type) => MediaRecorder.isTypeSupported(type)) ?? 'audio/webm';
    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];
    recorderRef.current = recorder;
    setRecordingId(question.id);
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunksRef.current.push(event.data);
    };
    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      setRecordingId(null);
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const mediaBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.onerror = () => reject(new Error('Could not read the voice recording.'));
        reader.readAsDataURL(blob);
      });
      await apiPost(`/api/exam/sessions/${sessionId}/voice-recordings`, { questionId: question.id, mediaBase64, contentType: mimeType.split(';')[0] });
    };
    recorder.start();
  };

  if (!questions.length) return <div className="min-h-screen bg-black flex items-center justify-center text-white">No technical interview questions configured.</div>;

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-6xl mx-auto py-8 space-y-5">
        <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-white">Voice-Assisted Technical Interview</h1><p className="text-slate-400 text-sm">CV-based technical questions with spoken prompts and recorded voice answers</p></div><Badge className="bg-slate-800 text-white"><Clock className="w-3 h-3 mr-1" />{formatTime(timeLeft)}</Badge></div>
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <Card className="bg-slate-900 border-slate-700"><CardContent className="p-4 space-y-2"><p className="text-sm font-semibold text-white">Upload your CV for tailored questions</p><p className="text-xs text-slate-400">Upload a text-based PDF, TXT, or Markdown CV. PDF text is extracted securely on the server.</p><input type="file" accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown" onChange={(event) => event.target.files?.[0] && uploadCv(event.target.files[0])} className="text-sm text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-white" />{cvName && <p className="text-xs text-green-300">Uploaded: {cvName}</p>}{cvError && <p className="text-xs text-red-300">{cvError}</p>}</CardContent></Card>
          <Card className="bg-slate-900 border-slate-700"><CardContent className="p-4"><p className="text-sm font-semibold text-white">CV focus</p><p className="text-xs text-slate-400 mt-1">{cvKeywords.length ? cvKeywords.join(' · ') : 'Upload a CV to show detected skills here.'}</p></CardContent></Card>
        </div>
        <Progress value={((currentIndex + 1) / questions.length) * 100} className="h-2" />
        <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)] items-start">
          <QuestionNavigator questions={questions} currentIndex={currentIndex} answers={answers} onSelect={setCurrentIndex} />
          <Card className="bg-slate-900 border-slate-700"><CardHeader><div className="flex justify-between"><Badge variant="outline" className="text-slate-300 border-slate-600">{question.category} · {question.subtopic}</Badge><span className="text-slate-500 text-sm">{currentIndex + 1} / {questions.length}</span></div><CardTitle className="text-white">{question.prompt}</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap gap-2"><Button onClick={speak} className="bg-blue-600 hover:bg-blue-700 text-white"><Volume2 className="w-4 h-4 mr-2" />{playingId === question.id ? 'Stop question' : 'Read question aloud'}</Button><Button onClick={recordVoice} className={recordingId === question.id ? 'bg-red-700 hover:bg-red-800 text-white' : 'bg-fuchsia-600 hover:bg-fuchsia-700 text-white'}><Mic className="w-4 h-4 mr-2" />{recordingId === question.id ? 'Stop voice recording' : 'Record voice answer'}</Button></div><p className="text-xs text-slate-400">Your voice answer is stored securely for interviewer review. You may also provide a transcript below.</p><textarea value={answers[question.id] ?? ''} onChange={(event) => setAnswers((previous) => ({ ...previous, [question.id]: event.target.value }))} placeholder="Optional answer transcript..." className="min-h-[220px] w-full rounded border border-slate-600 bg-slate-950 p-4 text-sm text-white outline-none focus:border-fuchsia-500" /></CardContent></Card>
        </div>
        <div className="flex justify-between"><Button variant="outline" disabled={currentIndex === 0} onClick={() => setCurrentIndex((value) => value - 1)} className="border-slate-600 bg-transparent text-slate-300"><Play className="w-4 h-4 mr-1 rotate-180" />Previous</Button>{currentIndex === questions.length - 1 ? <Button onClick={finish} className="bg-green-600 hover:bg-green-700 text-white">Submit interview</Button> : <Button onClick={() => setCurrentIndex((value) => value + 1)} className="bg-blue-600 hover:bg-blue-700 text-white">Next</Button>}</div>
      </div>
    </div>
  );
};

export default TechnicalInterviewView;
