import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Clock, Play, Square, Mic, Video } from 'lucide-react';
import { apiPost } from '@/lib/api';
import type { QuestionBankRow } from '@/lib/examRounds';
import { scoreAnswer } from '@/lib/examRounds';
import QuestionNavigator from './QuestionNavigator';

interface EnglishCommunicationViewProps {
  sessionId: string;
  durationMin: number;
  questions: QuestionBankRow[];
  onSubmit: (result: { score: number; pct: number; answers: Record<string, string> }) => void;
}

const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;

const EnglishCommunicationView = ({ sessionId, durationMin, questions, onSubmit }: EnglishCommunicationViewProps) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(durationMin * 60);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxPoints = useMemo(() => questions.reduce((sum, question) => sum + question.points, 0), [questions]);

  const finish = () => {
    const score = questions.reduce((sum, question) => sum + scoreAnswer(question, answers[question.id] ?? ''), 0);
    onSubmit({ score, pct: maxPoints ? Math.round((score / maxPoints) * 100) : 0, answers });
  };

  useEffect(() => {
    if (timeLeft <= 0) {
      finish();
      return;
    }
    const timer = window.setTimeout(() => setTimeLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  useEffect(() => () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recorderRef.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  const speak = (question: QuestionBankRow) => {
    if (!question.audioText || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    if (playingId === question.id) {
      setPlayingId(null);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(question.audioText);
    utterance.onend = () => setPlayingId(null);
    setPlayingId(question.id);
    window.speechSynthesis.speak(utterance);
  };

  const stopRecording = (questionId: string) => {
    if (recordingId !== questionId) return;
    recorderRef.current?.stop();
  };

  const startRecording = async (question: QuestionBankRow) => {
    if (!navigator.mediaDevices?.getUserMedia || !('MediaRecorder' in window)) return;
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    const mimeType = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/webm;codecs=vp8,opus', 'video/webm']
      .find((type) => MediaRecorder.isTypeSupported(type)) ?? 'video/webm';
    const recorder = new MediaRecorder(stream, { mimeType });
    recordingChunksRef.current = [];
    recorderRef.current = recorder;
    setRecordingId(question.id);
    setRecordingSeconds(0);
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordingChunksRef.current.push(event.data);
    };
    recorder.onstop = async () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      stream.getTracks().forEach((track) => track.stop());
      setRecordingId(null);
      const blob = new Blob(recordingChunksRef.current, { type: mimeType });
      const mediaBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.onerror = () => reject(new Error('Could not read the speaking recording.'));
        reader.readAsDataURL(blob);
      });
      await apiPost(`/api/exam/sessions/${sessionId}/speaking-recordings`, {
        questionId: question.id,
        mediaBase64,
        contentType: mimeType.split(';')[0],
      });
    };
    recorder.start();
    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((seconds) => {
        if (seconds >= 59) {
          recorder.stop();
          return 60;
        }
        return seconds + 1;
      });
    }, 1000);
  };

  if (!questions.length) return <div className="min-h-screen bg-black flex items-center justify-center text-white">No English questions configured.</div>;

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-6xl mx-auto py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">English Communication Round</h1>
            <p className="text-slate-400 text-sm">Listening · Reading · Speaking · Grammar and sentence formation</p>
          </div>
          <Badge className="bg-slate-800 text-white flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(timeLeft)}</Badge>
        </div>
        <Progress value={((Object.keys(answers).length) / questions.length) * 100} className="h-2" />

        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] items-start">
        <QuestionNavigator
          questions={questions}
          currentIndex={currentIndex}
          answers={answers}
          onSelect={(index) => {
            setCurrentIndex(index);
            document.getElementById(`english-question-${questions[index].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        />
        <div className="space-y-6">
        {questions.map((question, index) => (
          <Card id={`english-question-${question.id}`} key={question.id} onClick={() => setCurrentIndex(index)} className="bg-slate-900 border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <Badge variant="outline" className="text-slate-300 border-slate-600">{question.category}</Badge>
                <span className="text-slate-500 text-sm">{index + 1} / {questions.length}</span>
              </div>
              {question.passage && <p className="text-slate-300 leading-7 bg-slate-800/70 rounded-lg p-4">{question.passage}</p>}
              {question.audioText && (
                <div className="rounded-lg border border-blue-500/30 bg-blue-950/30 p-4">
                  <p className="text-blue-200 text-sm mb-3">Listen to the one-minute paragraph before answering its five questions.</p>
                  {question.audioUrl ? (
                    <audio controls src={question.audioUrl} className="w-full" />
                  ) : (
                    <Button onClick={() => speak(question)} className="bg-blue-600 hover:bg-blue-700 text-white">
                      {playingId === question.id ? <><Square className="w-4 h-4 mr-2" /> Stop audio</> : <><Play className="w-4 h-4 mr-2" /> Play audio</>}
                    </Button>
                  )}
                </div>
              )}
              <CardTitle className="text-white text-lg">{question.prompt}</CardTitle>
            </CardHeader>
            <CardContent>
              {question.options ? (
                <div className="grid gap-2">
                  {question.options.map((option) => (
                    <label key={option} className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer ${answers[question.id] === option ? 'border-blue-500 bg-blue-950/40' : 'border-slate-700'}`}>
                      <input type="radio" name={question.id} value={option} checked={answers[question.id] === option} onChange={() => setAnswers((prev) => ({ ...prev, [question.id]: option }))} />
                      <span className="text-slate-200">{option}</span>
                    </label>
                  ))}
                  </div>
              ) : question.category === 'Speaking' ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-slate-300 text-sm"><Video className="w-4 h-4 text-red-400" /> Record a 60-second video response. It will be stored for admin review.</div>
                  <Button onClick={() => recordingId === question.id ? stopRecording(question.id) : startRecording(question)} className={recordingId === question.id ? 'bg-red-700 hover:bg-red-800 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}>
                    <Mic className="w-4 h-4 mr-2" /> {recordingId === question.id ? `Stop recording (${recordingSeconds}s)` : 'Start 60-second recording'}
                  </Button>
                  <Textarea value={answers[question.id] ?? ''} onChange={(event) => setAnswers((prev) => ({ ...prev, [question.id]: event.target.value }))} placeholder="Optional transcript..." className="min-h-[100px] bg-slate-800 border-slate-600 text-white" />
                </div>
              ) : (
                <Textarea value={answers[question.id] ?? ''} onChange={(event) => setAnswers((prev) => ({ ...prev, [question.id]: event.target.value }))} placeholder="Type your answer here..." className="min-h-[140px] bg-slate-800 border-slate-600 text-white" />
              )}
            </CardContent>
          </Card>
        ))}

        <Button onClick={finish} className="w-full bg-green-600 hover:bg-green-700 text-white">Submit English Communication Round</Button>
      </div>
      </div>
      </div>
    </div>
  );
};

export default EnglishCommunicationView;
