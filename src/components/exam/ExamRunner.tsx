import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { loadFaceModels, getFaceDescriptor } from '@/lib/faceEngine';
import { loadFaceLandmarker, detectFrame } from '@/lib/faceMesh';
import { createStrikeTracker, createViolationPolicy, type ViolationType, type ConfirmedViolation } from '@/utils/proctorEngine';
import { fetchRoundQuestions, submitRoundResponses, recordRoundScore, scoreAnswer, type QuestionBankRow, type RoundName } from '@/lib/examRounds';
import RoundView from './RoundView';

interface ExamRunnerProps {
  sessionId: string;
  onExamComplete: () => void;
}

interface SessionInfo {
  company_id: string;
  current_round: RoundName | null;
  status: string;
}

interface CompanyDurations {
  technical_duration_min: number;
  personal_duration_min: number;
  hr_duration_min: number;
}

const PRESENCE_CHECK_MS = 1000;
const IDENTITY_CHECK_MS = 8000;
const MAX_YAW_DEG = 30;
const MAX_PITCH_DEG = 25;

const ROUND_TITLES: Record<RoundName, string> = {
  technical: 'Technical Round',
  personal: 'Personal Round',
  hr: 'HR Round',
};

/**
 * Owns the camera + continuous proctoring for the whole exam session (never torn down
 * between rounds), and sequentially renders Technical -> Personal -> HR content sourced
 * from question_bank, persisting every answer to exam_responses.
 */
const ExamRunner = ({ sessionId, onExamComplete }: ExamRunnerProps) => {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [durations, setDurations] = useState<CompanyDurations | null>(null);
  const [questions, setQuestions] = useState<QuestionBankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [ended, setEnded] = useState<'submitted' | 'auto_submitted' | null>(null);
  const [liveViolations, setLiveViolations] = useState<ConfirmedViolation[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const userIdRef = useRef<string | null>(null);
  const strikeTracker = useRef(createStrikeTracker());
  const violationPolicy = useRef(createViolationPolicy());
  const presenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const identityIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endedRef = useRef(false);

  const stopEverything = useCallback(() => {
    if (presenceIntervalRef.current) clearInterval(presenceIntervalRef.current);
    if (identityIntervalRef.current) clearInterval(identityIntervalRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const captureSnapshotPath = useCallback(async (): Promise<string | null> => {
    if (!videoRef.current || !userIdRef.current) return null;
    if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7));
    if (!blob) return null;

    const path = `${userIdRef.current}/${sessionId}/${Date.now()}.jpg`;
    const { error } = await supabase.storage.from('violation-snapshots').upload(path, blob, { contentType: 'image/jpeg' });
    return error ? null : path;
  }, [sessionId]);

  const recordViolation = useCallback(
    async (violation: ConfirmedViolation) => {
      if (endedRef.current) return;
      setLiveViolations((prev) => [...prev, violation]);

      const snapshotPath = await captureSnapshotPath();
      await supabase.from('violations').insert({
        session_id: sessionId,
        user_id: userIdRef.current,
        type: violation.type,
        severity: violation.severity,
        message: violation.message,
        snapshot_path: snapshotPath,
      });

      const policyResult = violationPolicy.current.record();
      if (policyResult.shouldAutoSubmit) {
        endedRef.current = true;
        stopEverything();
        await supabase.rpc('auto_submit_exam_session', { p_session_id: sessionId });
        setEnded('auto_submitted');
      }
    },
    [sessionId, captureSnapshotPath, stopEverything],
  );

  const handleTabHidden = useCallback(() => {
    if (document.hidden) recordViolation({ type: 'TAB_HIDDEN', severity: 'warning', message: 'Browser tab lost focus or was hidden.' });
  }, [recordViolation]);

  // Load session + camera + models once.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      userIdRef.current = userData.user?.id ?? null;

      const { data: sessionRow } = await supabase
        .from('exam_sessions')
        .select('company_id, current_round, status')
        .eq('id', sessionId)
        .maybeSingle();
      if (cancelled || !sessionRow) return;
      setSession(sessionRow as SessionInfo);

      const { data: companyRow } = await supabase
        .from('companies')
        .select('technical_duration_min, personal_duration_min, hr_duration_min')
        .eq('id', sessionRow.company_id)
        .maybeSingle();
      if (!cancelled && companyRow) setDurations(companyRow as CompanyDurations);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      const landmarker = await loadFaceLandmarker();
      await loadFaceModels();
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

      identityIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || endedRef.current) return;
        const descriptor = await getFaceDescriptor(videoRef.current);
        if (!descriptor) return;
        const { data, error } = await supabase.functions.invoke('match-face', {
          body: { embedding: Array.from(descriptor) },
        });
        if (error || !data) return;
        if (data.match) {
          strikeTracker.current.clear('IDENTITY_MISMATCH');
        } else {
          const confirmed = strikeTracker.current.strike('IDENTITY_MISMATCH');
          if (confirmed) recordViolation(confirmed);
        }
      }, IDENTITY_CHECK_MS);

      document.addEventListener('visibilitychange', handleTabHidden);
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleTabHidden);
      stopEverything();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Fetch this round's questions whenever current_round changes.
  useEffect(() => {
    if (!session?.company_id || !session.current_round) return;
    fetchRoundQuestions(session.company_id, session.current_round).then(setQuestions);
  }, [session?.company_id, session?.current_round]);

  const handleRoundSubmit = async (round: RoundName, result: { score: number; pct: number; answers: Record<string, string> }) => {
    await submitRoundResponses(
      questions.map((q) => ({
        session_id: sessionId,
        question_id: q.id,
        round,
        answer: result.answers[q.id] ?? '',
        score: scoreAnswer(q, result.answers[q.id] ?? ''),
      })),
    );
    await recordRoundScore(sessionId, round, result.score, result.pct);

    const { data: updated } = await supabase
      .from('exam_sessions')
      .select('company_id, current_round, status')
      .eq('id', sessionId)
      .maybeSingle();

    if (!updated || updated.status === 'submitted') {
      endedRef.current = true;
      stopEverything();
      setEnded('submitted');
      return;
    }
    setSession(updated as SessionInfo);
  };

  if (ended) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-900 border-slate-700">
          <CardHeader className="text-center space-y-2">
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
            <CardTitle className="text-white">
              {ended === 'auto_submitted' ? 'Exam Auto-Submitted' : 'Exam Submitted'}
            </CardTitle>
            <CardDescription className="text-slate-300">
              {ended === 'auto_submitted'
                ? 'Your exam was automatically submitted due to repeated proctoring flags. A human reviewer will check the recorded evidence.'
                : 'Your responses have been recorded.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <button onClick={onExamComplete} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg">
              Continue
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading || !session?.current_round || !durations) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white">Loading your exam...</p>
      </div>
    );
  }

  const durationMin =
    session.current_round === 'technical'
      ? durations.technical_duration_min
      : session.current_round === 'personal'
        ? durations.personal_duration_min
        : durations.hr_duration_min;

  return (
    <div className="relative">
      <video ref={videoRef} autoPlay muted playsInline className="fixed bottom-4 right-4 w-40 h-32 object-cover rounded-lg border border-slate-700 z-50" />

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

      <Badge className="fixed top-4 left-4 z-50 bg-slate-800 text-white">{ROUND_TITLES[session.current_round]}</Badge>

      <RoundView
        title={ROUND_TITLES[session.current_round]}
        durationMin={durationMin}
        questions={questions}
        onSubmit={(result) => handleRoundSubmit(session.current_round as RoundName, result)}
      />
    </div>
  );
};

export default ExamRunner;
