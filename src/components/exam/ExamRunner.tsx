import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { loadFaceLandmarker, detectFrame } from '@/lib/faceMesh';
import { createStrikeTracker, createViolationPolicy, type ConfirmedViolation } from '@/utils/proctorEngine';
import { fetchRoundQuestions, submitRoundResponses, recordRoundScore, scoreAnswer, type QuestionBankRow, type RoundName } from '@/lib/examRounds';
import RoundView from './RoundView';
import EnglishCommunicationView from './EnglishCommunicationView';
import CodingRoundView from './CodingRoundView';
import Coding2RoundView from './Coding2RoundView';
import ExamReport from './ExamReport';
import TechnicalInterviewView from './TechnicalInterviewView';

interface ExamRunnerProps {
  sessionId: string;
  onExamComplete: () => void;
}

interface SessionInfo {
  companyId: string;
  currentRound: RoundName | null;
  status: string;
  englishPct?: number | null;
  aptitudePct?: number | null;
  aiTechnicalPct?: number | null;
}

interface CompanyDurations {
  technicalDurationMin: number;
  englishDurationMin: number;
  aptitudeDurationMin: number;
  aiTechnicalDurationMin: number;
  coding1DurationMin: number;
  coding2DurationMin: number;
  technicalInterviewDurationMin: number;
  personalDurationMin: number;
  hrDurationMin: number;
}

const PRESENCE_CHECK_MS = 1000;
const MAX_YAW_DEG = 30;
const MAX_PITCH_DEG = 25;

const ROUND_TITLES: Record<RoundName, string> = {
  english: 'English Communication Round',
  aptitude: 'Hard Aptitude Round',
  ai_technical: 'AI Literacy and Technical Knowledge',
  coding1: 'Coding 1 · DSA',
  coding2: 'Coding 2 · AI-Assisted and Debugging',
  technical_interview: 'Voice-Assisted Technical Interview',
  technical: 'Technical Round',
  personal: 'Personal Round',
  hr: 'HR Round',
};

function captureBase64Jpeg(video: HTMLVideoElement, canvas: HTMLCanvasElement): string | null {
  canvas.width = video.videoWidth || 320;
  canvas.height = video.videoHeight || 240;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  // dataURL is "data:image/jpeg;base64,<...>" — server only wants the payload after the comma.
  return canvas.toDataURL('image/jpeg', 0.7).split(',')[1] ?? null;
}

/**
 * Owns the camera + continuous proctoring for the whole exam session (never torn down
 * between rounds), and sequentially renders English -> Technical -> Personal -> HR content sourced
 * from the question bank, persisting every answer to examResponses.
 */
const ExamRunner = ({ sessionId, onExamComplete }: ExamRunnerProps) => {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [durations, setDurations] = useState<CompanyDurations | null>(null);
  const [questions, setQuestions] = useState<QuestionBankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState('');
  const [ended, setEnded] = useState<'submitted' | 'auto_submitted' | null>(null);
  const [liveViolations, setLiveViolations] = useState<ConfirmedViolation[]>([]);
  const [secureExamStarted, setSecureExamStarted] = useState(false);
  const screenStreamRef = useRef<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strikeTracker = useRef(createStrikeTracker());
  const violationPolicy = useRef(createViolationPolicy());
  const presenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endedRef = useRef(false);

  const stopEverything = useCallback(() => {
    if (presenceIntervalRef.current) clearInterval(presenceIntervalRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const startSecureExam = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      screenStreamRef.current = screenStream;
      screenStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (!endedRef.current) recordViolation({ type: 'SCREEN_SHARE_STOPPED', severity: 'critical', message: 'Screen sharing was stopped.' });
      });
      setSecureExamStarted(true);
    } catch (err) {
      setLiveViolations([{ type: 'SCREEN_SHARE_STOPPED', severity: 'warning', message: err instanceof Error ? err.message : 'Screen sharing is required.' }]);
    }
  };

  const recordViolation = useCallback(
    async (violation: ConfirmedViolation) => {
      if (endedRef.current) return;
      setLiveViolations((prev) => [...prev, violation]);

      if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
      const snapshotBase64 = videoRef.current ? captureBase64Jpeg(videoRef.current, canvasRef.current) : null;

      await apiPost(`/api/exam/sessions/${sessionId}/violations`, {
        type: violation.type,
        severity: violation.severity,
        message: violation.message,
        snapshotBase64,
      });

      const policyResult = violationPolicy.current.record();
      if (policyResult.shouldAutoSubmit) {
        endedRef.current = true;
        stopEverything();
        await apiPost(`/api/exam/sessions/${sessionId}/auto-submit`);
        setEnded('auto_submitted');
      }
    },
    [sessionId, stopEverything],
  );

  const handleTabHidden = useCallback(() => {
    if (document.hidden) recordViolation({ type: 'TAB_HIDDEN', severity: 'warning', message: 'Browser tab lost focus or was hidden.' });
  }, [recordViolation]);

  useEffect(() => {
    if (videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current;
  }, [loading, secureExamStarted]);

  // Load session + camera + models once.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { session: sessionRow } = await apiGet<{ session: SessionInfo }>(`/api/exam/sessions/${sessionId}`);
        if (cancelled || !sessionRow) return;
        setSession(sessionRow);

        const { company } = await apiGet<{ company: CompanyDurations }>(`/api/companies/${sessionRow.companyId}`);
        if (!cancelled && company) setDurations(company);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const landmarker = await loadFaceLandmarker();
        if (cancelled) return;

      presenceIntervalRef.current = setInterval(() => {
        if (!videoRef.current || endedRef.current) return;
        const frame = detectFrame(landmarker, videoRef.current, performance.now());

        if (frame.faceCount === 0) {
          strikeTracker.current.clear('MULTIPLE_FACES');
          strikeTracker.current.clear('LOOKING_AWAY');
          const confirmed = strikeTracker.current.strike('NO_FACE');
          if (confirmed) recordViolation(confirmed);
          return;
        }
        strikeTracker.current.clear('NO_FACE');

        if (frame.faceCount > 1) {
          const confirmed = strikeTracker.current.strike('MULTIPLE_FACES');
          if (confirmed) recordViolation(confirmed);
        } else {
          strikeTracker.current.clear('MULTIPLE_FACES');
        }

        const lookingAway =
          (frame.yawDeg !== null && Math.abs(frame.yawDeg) > MAX_YAW_DEG) ||
          (frame.pitchDeg !== null && Math.abs(frame.pitchDeg) > MAX_PITCH_DEG);
        if (lookingAway) {
          const confirmed = strikeTracker.current.strike('LOOKING_AWAY');
          if (confirmed) recordViolation(confirmed);
        } else {
          strikeTracker.current.clear('LOOKING_AWAY');
        }
      }, PRESENCE_CHECK_MS);

        document.addEventListener('visibilitychange', handleTabHidden);
        if (!cancelled) setLoading(false);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Camera permission was denied. Allow camera access for http://127.0.0.1:8080, then refresh and start the Communication Round again.'
            : err instanceof Error
              ? err.message
              : 'Unable to initialize the proctored exam.';
          setInitError(message);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleTabHidden);
      stopEverything();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Fetch this round's questions whenever currentRound changes.
  useEffect(() => {
    if (!session?.companyId || !session.currentRound) return;
    fetchRoundQuestions(session.companyId, session.currentRound)
      .then(setQuestions)
      .catch((err) => setInitError(err instanceof Error ? err.message : 'Unable to load Communication Round questions.'));
  }, [session?.companyId, session?.currentRound]);

  const handleRoundSubmit = async (round: RoundName, result: { score: number; pct: number; answers: Record<string, string> }) => {
    await submitRoundResponses(
      sessionId,
      questions.map((q) => ({
        questionId: q.id,
        round,
        answer: result.answers[q.id] ?? '',
        score: scoreAnswer(q, result.answers[q.id] ?? ''),
      })),
    );
    await recordRoundScore(sessionId, round, result.score, result.pct);

    const { session: updated } = await apiGet<{ session: SessionInfo }>(`/api/exam/sessions/${sessionId}`);

    if (!updated || updated.status === 'submitted') {
      endedRef.current = true;
      stopEverything();
      setEnded('submitted');
      return;
    }
    setSession(updated);
  };

  if (ended) {
    return (
      <div className="hirex-app-shell min-h-screen flex items-center justify-center p-4">
        <ExamReport sessionId={sessionId} onContinue={onExamComplete} />
      </div>
    );
  }

  if (initError) {
    return (
      <div className="hirex-app-shell min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-lg bg-slate-900 border-red-500/50">
          <CardHeader>
            <CardTitle className="text-white">Communication Round could not open</CardTitle>
            <CardDescription className="text-red-300">{initError}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={onExamComplete} className="w-full bg-blue-600 hover:bg-blue-700 text-white">Return to Communication Round</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!secureExamStarted) {
    return (
      <div className="hirex-app-shell min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-lg bg-slate-900 border-slate-700">
          <CardHeader><CardTitle className="text-white">Proctored Exam</CardTitle><CardDescription className="text-slate-300">Camera and screen sharing are required for proctoring. You can exit the exam at any time.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={startSecureExam} className="w-full bg-blue-600 hover:bg-blue-700 text-white">Enable camera and screen sharing</Button>
            <Button onClick={onExamComplete} variant="outline" className="w-full border-slate-600 text-slate-300">Exit</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading || !session?.currentRound || !durations) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white">Loading your exam...</p>
      </div>
    );
  }

  const durationMin =
    session.currentRound === 'english'
      ? durations.englishDurationMin
      : session.currentRound === 'aptitude'
      ? durations.aptitudeDurationMin
      : session.currentRound === 'ai_technical'
      ? durations.aiTechnicalDurationMin
      : session.currentRound === 'coding1'
      ? durations.coding1DurationMin
      : session.currentRound === 'coding2'
      ? durations.coding2DurationMin
      : session.currentRound === 'technical_interview'
      ? durations.technicalInterviewDurationMin
      : session.currentRound === 'technical'
      ? durations.technicalDurationMin
      : session.currentRound === 'personal'
        ? durations.personalDurationMin
        : durations.hrDurationMin;

  return (
    <div className="hirex-app-shell relative min-h-screen">
      <video ref={videoRef} autoPlay muted playsInline className="fixed bottom-4 right-4 w-40 h-32 object-cover rounded-lg border border-slate-700 z-50" />
      <Button onClick={() => { stopEverything(); onExamComplete(); }} className="fixed bottom-4 left-4 z-50 bg-red-700 hover:bg-red-800 text-white">Exit exam</Button>

      {liveViolations.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-1 max-w-xs">
          {liveViolations.slice(-3).map((v, i) => (
            <div key={i} className="bg-red-900/80 border border-red-500/50 rounded-lg p-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-red-200 text-xs">{v.message}</p>
            </div>
          ))}
        </div>
      )}

      <Badge className="fixed top-4 left-4 z-50 bg-slate-800 text-white">{session.currentRound === 'english' ? 'English Communication Round' : ROUND_TITLES[session.currentRound]}</Badge>

      {session.currentRound === 'english' ? (
        <EnglishCommunicationView
          sessionId={sessionId}
          durationMin={durationMin}
          questions={questions}
          onSubmit={(result) => handleRoundSubmit('english', result)}
        />
      ) : session.currentRound === 'coding1' ? (
        <CodingRoundView
          durationMin={durationMin}
          questions={questions}
          onSubmit={(result) => handleRoundSubmit('coding1', result)}
        />
      ) : session.currentRound === 'coding2' ? (
        <Coding2RoundView
          durationMin={durationMin}
          questions={questions}
          onSubmit={(result) => handleRoundSubmit('coding2', result)}
        />
      ) : session.currentRound === 'technical_interview' ? (
        <TechnicalInterviewView
          sessionId={sessionId}
          durationMin={durationMin}
          questions={questions}
          onQuestionsUpdate={setQuestions}
          onSubmit={(result) => handleRoundSubmit('technical_interview', result)}
        />
      ) : <RoundView
        title={ROUND_TITLES[session.currentRound]}
        durationMin={durationMin}
        questions={questions}
        onSubmit={(result) => handleRoundSubmit(session.currentRound as RoundName, result)}
      />}
    </div>
  );
};

export default ExamRunner;
