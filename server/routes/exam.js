import express from 'express';
import { ObjectId } from 'mongodb';
import { getDb, getSnapshotBucket, getRecordingBucket } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { isValidEmbedding, euclideanDistance, THRESHOLD } from '../lib/faceMatch.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = express.Router();

const ROUND_ORDER = ['english', 'aptitude', 'ai_technical', 'coding1', 'coding2', 'technical_interview', 'technical', 'personal', 'hr'];
const MAX_FACE_GATE_ATTEMPTS = 3;
const ACTIVE_STATUSES = ['pending_manual_review', 'in_progress'];
const GATE_PENDING_STATUSES = ['face_gate_pending', 'pending_manual_review'];
const SECTION_ALIASES = new Map([
  ['english', 'english'],
  ['english_communication', 'english'],
  ['english communication', 'english'],
  ['aptitude', 'aptitude'],
  ['hard_aptitude', 'aptitude'],
  ['hard aptitude', 'aptitude'],
  ['ai_technical', 'ai_technical'],
  ['ai-technical', 'ai_technical'],
  ['ai technical', 'ai_technical'],
  ['ai literacy and technical knowledge', 'ai_technical'],
  ['coding1', 'coding1'],
  ['coding 1', 'coding1'],
  ['coding_1', 'coding1'],
  ['coding', 'coding1'],
  ['coding2', 'coding2'],
  ['coding 2', 'coding2'],
  ['coding_2', 'coding2'],
  ['ai assisted coding', 'coding2'],
  ['technical_interview', 'technical_interview'],
  ['technical interview', 'technical_interview'],
  ['voice technical interview', 'technical_interview'],
]);

function normalizeSection(value) {
  if (typeof value !== 'string') return null;
  return SECTION_ALIASES.get(value.trim().toLowerCase()) ?? null;
}

function toSessionDto(s) {
  return {
    id: s._id.toString(),
    userId: s.userId.toString(),
    companyId: s.companyId.toString(),
    status: s.status,
    currentRound: s.currentRound ?? null,
    faceGateAttempts: s.faceGateAttempts,
    integrityScore: s.integrityScore,
    technicalPct: s.technicalPct ?? null,
    englishPct: s.englishPct ?? null,
    aptitudePct: s.aptitudePct ?? null,
    personalPct: s.personalPct ?? null,
    hrPct: s.hrPct ?? null,
    overallPct: s.overallPct ?? null,
  };
}

const loadOwnedSession = asyncHandler(async (req, res, next) => {
  let sessionId;
  try {
    sessionId = new ObjectId(req.params.id);
  } catch {
    return res.status(400).json({ error: 'invalid_session' });
  }
  const db = await getDb();
  const session = await db.collection('examSessions').findOne({ _id: sessionId });
  if (!session) return res.status(404).json({ error: 'invalid_session' });
  if (session.userId.toString() !== req.userId && req.role !== 'recruiter') {
    return res.status(403).json({ error: 'forbidden' });
  }
  req.session = session;
  req.db = db;
  next();
});

router.get('/sessions/:id/report', requireAuth, loadOwnedSession, asyncHandler(async (req, res) => {
  const session = req.session;
  const rounds = session.section ? [session.section] : ROUND_ORDER;
  const [questions, responses, violations] = await Promise.all([
    req.db.collection('questionBank').find({ companyId: session.companyId, round: { $in: rounds } }).project({
      _id: 1, round: 1, prompt: 1, category: 1, subtopic: 1, points: 1, correctAnswer: 1,
    }).toArray(),
    req.db.collection('examResponses').find({ sessionId: session._id }).sort({ createdAt: 1 }).toArray(),
    req.db.collection('violations').find({ sessionId: session._id }).project({ type: 1, severity: 1, message: 1, createdAt: 1 }).sort({ createdAt: 1 }).toArray(),
  ]);
  const responseByQuestion = new Map();
  for (const response of responses) responseByQuestion.set(String(response.questionId), response);
  const summary = new Map();
  const questionReport = questions.map((question) => {
    const response = responseByQuestion.get(String(question._id));
    const topic = question.category || question.round;
    const subtopic = question.subtopic || 'General';
    const key = `${topic}::${subtopic}`;
    const group = summary.get(key) ?? { topic, subtopic, total: 0, answered: 0, correct: 0, score: 0, maxScore: 0 };
    group.total += 1;
    group.maxScore += question.points ?? 0;
    if (response?.answer?.trim()) group.answered += 1;
    if (response && typeof response.score === 'number') {
      group.score += response.score;
      if (response.score >= (question.points ?? 0) && (question.points ?? 0) > 0) group.correct += 1;
    }
    summary.set(key, group);
    return {
      id: String(question._id),
      round: question.round,
      prompt: question.prompt,
      topic,
      subtopic,
      answered: Boolean(response?.answer?.trim()),
      answer: response?.answer ?? '',
      correctAnswer: question.correctAnswer ?? null,
      result: !response?.answer?.trim() ? 'unanswered' : response?.score >= (question.points ?? 0) && (question.points ?? 0) > 0 ? 'correct' : 'review',
      score: response?.score ?? 0,
      maxScore: question.points ?? 0,
    };
  });
  const totalScore = questionReport.reduce((sum, question) => sum + question.score, 0);
  const maxScore = questionReport.reduce((sum, question) => sum + question.maxScore, 0);
  const startedAt = session.startedAt ? new Date(session.startedAt) : null;
  const endedAt = session.endedAt ? new Date(session.endedAt) : new Date();
  res.json({
    report: {
      sessionId: String(session._id),
      status: session.status,
      section: session.section ?? null,
      startedAt: session.startedAt ?? null,
      endedAt: session.endedAt ?? null,
      durationSeconds: startedAt ? Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)) : null,
      questionCount: questionReport.length,
      answeredCount: questionReport.filter((question) => question.answered).length,
      unansweredCount: questionReport.filter((question) => !question.answered).length,
      score: totalScore,
      maxScore,
      percentage: maxScore ? Math.round((totalScore / maxScore) * 100) : 0,
      topicSummary: [...summary.values()],
      questions: questionReport,
      violations,
    },
  });
}));

router.get('/reports', requireAuth, asyncHandler(async (req, res) => {
  const db = await getDb();
  const sessions = await db.collection('examSessions').find({
    userId: new ObjectId(req.userId),
    status: { $in: ['submitted', 'auto_submitted'] },
  }).sort({ endedAt: -1, createdAt: -1 }).toArray();
  res.json({
    reports: sessions.map((session) => ({
      sessionId: String(session._id),
      section: session.section ?? session.currentRound ?? null,
      status: session.status,
      startedAt: session.startedAt ?? null,
      endedAt: session.endedAt ?? null,
      score: session.section === 'coding1' ? session.coding1Score ?? null
        : session.section === 'coding2' ? session.coding2Score ?? null
          : session.section === 'technical_interview' ? session.technical_interviewScore ?? null
          : session.section === 'english' ? session.englishScore ?? null
            : session.section === 'aptitude' ? session.aptitudeScore ?? null
              : session.section === 'ai_technical' ? session.aiTechnicalScore ?? null
                : session.overallPct ?? null,
      percentage: session.section === 'coding1' ? session.coding1Pct ?? null
        : session.section === 'coding2' ? session.coding2Pct ?? null
          : session.section === 'technical_interview' ? session.technical_interviewPct ?? null
          : session.section === 'english' ? session.englishPct ?? null
            : session.section === 'aptitude' ? session.aptitudePct ?? null
              : session.section === 'ai_technical' ? session.aiTechnicalPct ?? null
                : session.overallPct ?? null,
    })),
  });
}));

// Creates a new attempt for a company, or resumes an unfinished one.
router.post('/sessions', requireAuth, asyncHandler(async (req, res) => {
  const { companyId } = req.body ?? {};
  const section = normalizeSection(req.body?.section ?? 'english');
  if (!section) {
    return res.status(400).json({ error: 'invalid_section' });
  }
  let companyObjectId = null;
  if (companyId) {
    try {
      companyObjectId = new ObjectId(String(companyId));
    } catch {
      return res.status(400).json({ error: 'invalid_input', detail: 'companyId is not a valid id' });
    }
  }

  const db = await getDb();
  if (!companyObjectId) {
    const generalCompany = await db.collection('companies').findOne({ slug: 'general', isActive: true });
    if (!generalCompany)     return res.status(503).json({ error: 'exam_not_configured', detail: 'Assessment section is not configured.' });
    companyObjectId = generalCompany._id;
  }
  const userId = new ObjectId(req.userId);

  const existing = await db.collection('examSessions').findOne(
    { userId, companyId: companyObjectId, currentRound: section, status: { $in: ACTIVE_STATUSES } },
    { sort: { createdAt: -1 } },
  );
  if (existing) return res.json({ sessionId: existing._id.toString() });

  const now = new Date();
  const { insertedId } = await db.collection('examSessions').insertOne({
    userId,
    companyId: companyObjectId,
    status: 'in_progress',
    currentRound: section,
    section,
    faceGateAttempts: 0,
    faceGatePassedAt: null,
    startedAt: now,
    endedAt: null,
    integrityScore: 100,
    technicalScore: null,
    technicalPct: null,
    personalScore: null,
    personalPct: null,
    hrScore: null,
    hrPct: null,
    overallPct: null,
    createdAt: now,
  });
  res.status(201).json({ sessionId: insertedId.toString() });
}));

router.get('/sessions/:id', requireAuth, loadOwnedSession, (req, res) => {
  res.json({ session: toSessionDto(req.session) });
});

// Mirrors the (superseded) Supabase plan's unlock-exam-session edge function.
router.post('/sessions/:id/unlock', requireAuth, loadOwnedSession, asyncHandler(async (req, res) => {
  const { embedding, livenessPassed } = req.body ?? {};
  if (!isValidEmbedding(embedding)) return res.status(400).json({ error: 'invalid_embedding' });
  if (!GATE_PENDING_STATUSES.includes(req.session.status)) {
    return res.status(400).json({ error: 'invalid_session', detail: `session status is ${req.session.status}` });
  }

  const stored = await req.db.collection('faceEmbeddings').findOne({ userId: req.session.userId });
  if (!stored) return res.status(404).json({ error: 'no_enrollment' });

  const distance = euclideanDistance(embedding, stored.embedding);
  const identityPassed = distance <= THRESHOLD;
  const livenessOk = livenessPassed === true;
  const unlocked = identityPassed && livenessOk;

  await req.db.collection('faceGateAttempts').insertOne({
    sessionId: req.session._id,
    userId: req.session.userId,
    distance,
    livenessPassed: livenessOk,
    identityPassed,
    snapshotFileId: null,
    createdAt: new Date(),
  });

  if (unlocked) {
    await req.db.collection('examSessions').updateOne(
      { _id: req.session._id },
      { $set: { status: 'in_progress', currentRound: 'technical', faceGatePassedAt: new Date(), startedAt: new Date() } },
    );
    return res.json({ unlocked: true });
  }

  const attempts = req.session.faceGateAttempts + 1;
  const reason = !identityPassed ? 'identity' : 'liveness';

  if (attempts >= MAX_FACE_GATE_ATTEMPTS) {
    await req.db.collection('examSessions').updateOne(
      { _id: req.session._id },
      { $set: { status: 'pending_manual_review', faceGateAttempts: attempts } },
    );
    return res.json({ unlocked: false, reason: 'max_attempts', status: 'pending_manual_review' });
  }

  await req.db.collection('examSessions').updateOne({ _id: req.session._id }, { $set: { faceGateAttempts: attempts } });
  res.json({ unlocked: false, reason, attemptsRemaining: MAX_FACE_GATE_ATTEMPTS - attempts });
}));

router.post('/sessions/:id/responses', requireAuth, loadOwnedSession, asyncHandler(async (req, res) => {
  const { responses } = req.body ?? {};
  if (!Array.isArray(responses)) return res.status(400).json({ error: 'invalid_input' });
  if (responses.length === 0) return res.json({ ok: true });

  const docs = responses.map((r) => ({
    sessionId: req.session._id,
    questionId: r.questionId ? new ObjectId(r.questionId) : null,
    round: r.round,
    answer: r.answer ?? '',
    score: typeof r.score === 'number' ? r.score : 0,
    createdAt: new Date(),
  }));

  await req.db.collection('examResponses').insertMany(docs);
  res.json({ ok: true });
}));

router.post('/sessions/:id/cv', requireAuth, loadOwnedSession, asyncHandler(async (req, res) => {
    const { fileName, text, fileBase64, contentType } = req.body ?? {};
    if (typeof fileName !== 'string' || !fileName.trim()) {
      return res.status(400).json({ error: 'invalid_input', detail: 'A CV filename is required.' });
    }
    let extractedText = typeof text === 'string' ? text : '';
    if (fileBase64) {
      if (typeof fileBase64 !== 'string' || fileBase64.length > 12_000_000) {
        return res.status(400).json({ error: 'invalid_input', detail: 'The CV file is too large.' });
      }
      if (contentType !== 'application/pdf' && !fileName.toLowerCase().endsWith('.pdf')) {
        return res.status(400).json({ error: 'invalid_input', detail: 'Binary CV uploads must be PDF files.' });
      }
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: Buffer.from(fileBase64, 'base64') });
      const parsed = await parser.getText();
      await parser.destroy();
      extractedText = parsed.text ?? '';
    }
    const cleanText = extractedText.replace(/\s+/g, ' ').trim().slice(0, 50000);
    if (!cleanText) {
      return res.status(422).json({ error: 'cv_text_unavailable', detail: 'This PDF contains no selectable text. Upload a text-based PDF or an OCR-readable CV.' });
    }
    const keywords = [...new Set((cleanText.match(/[A-Za-z][A-Za-z+#.-]{2,}/g) ?? []).map((word) => word.toLowerCase()))]
      .filter((word) => !['and', 'the', 'with', 'for', 'from', 'this', 'that', 'using'].includes(word))
      .slice(0, 20);
    const skills = keywords.filter((word) => /^(javascript|typescript|react|node|python|java|c\+\+|sql|mongodb|postgres|aws|docker|kubernetes|tensorflow|pytorch|machine|learning|api|git)$/.test(word));
    const focus = skills.length ? skills.slice(0, 5) : keywords.slice(0, 5);
    const generatedQuestionDocs = focus.map((skill) => ({
      _id: new ObjectId(),
      companyId: req.session.companyId,
      sessionId: req.session._id,
      round: 'technical_interview',
      qtype: 'behavioral',
      category: 'CV-based technical interview',
      subtopic: skill,
      prompt: `You listed ${skill} on your CV. Explain one project where you used ${skill}, the technical decisions you made, and how you measured the result.`,
      options: null,
      correctAnswer: `A project using ${skill} with clear technical decisions and measurable results.`,
      points: 10,
    }));
    await req.db.collection('questionBank').deleteMany({ sessionId: req.session._id });
    await req.db.collection('questionBank').insertMany(generatedQuestionDocs);
    const generatedQuestions = generatedQuestionDocs.map(({ _id, companyId, sessionId, ...question }) => ({
      ...question,
      id: String(_id),
    }));
    await req.db.collection('candidateCvs').updateOne(
      { sessionId: req.session._id },
      { $set: { sessionId: req.session._id, userId: req.session.userId, fileName: fileName.trim(), text: cleanText, keywords, updatedAt: new Date() } },
      { upsert: true },
    );
  res.json({ ok: true, keywords, questions: generatedQuestions });
}));

// Mirrors the (superseded) Supabase plan's record_round_score RPC.
router.post('/sessions/:id/round-score', requireAuth, loadOwnedSession, asyncHandler(async (req, res) => {
  const { round, score, pct } = req.body ?? {};
  if (!ROUND_ORDER.includes(round) || typeof score !== 'number' || typeof pct !== 'number') {
    return res.status(400).json({ error: 'invalid_input' });
  }

  const fieldSet = {
    [`${round}Score`]: score,
    [`${round}Pct`]: pct,
  };
  await req.db.collection('examSessions').updateOne({ _id: req.session._id }, { $set: fieldSet });

  const isStandaloneCoding = ['coding1', 'coding2', 'technical_interview'].includes(req.session.section) || ['coding1', 'coding2', 'technical_interview'].includes(req.session.currentRound);
  const nextIndex = ROUND_ORDER.indexOf(round) + 1;
  const nextRound = isStandaloneCoding ? null : (nextIndex < ROUND_ORDER.length ? ROUND_ORDER[nextIndex] : null);

  if (nextRound) {
    await req.db.collection('examSessions').updateOne({ _id: req.session._id }, { $set: { currentRound: nextRound } });
  } else {
    const updated = await req.db.collection('examSessions').findOne({ _id: req.session._id });
    const overallPct = isStandaloneCoding
      ? pct
      : Math.round(((updated.englishPct ?? 0) + (updated.aptitudePct ?? 0) + (updated.aiTechnicalPct ?? 0) + (updated.technicalPct ?? 0) + (updated.personalPct ?? 0) + (updated.hrPct ?? 0)) / 6);
    await req.db.collection('examSessions').updateOne(
      { _id: req.session._id },
      { $set: { currentRound: null, status: 'submitted', endedAt: new Date(), overallPct } },
    );
  }

  res.json({ ok: true });
}));

router.post('/sessions/:id/auto-submit', requireAuth, loadOwnedSession, asyncHandler(async (req, res) => {
  const s = req.session;
  const overallPct = Math.round(((s.englishPct ?? 0) + (s.aptitudePct ?? 0) + (s.technicalPct ?? 0) + (s.personalPct ?? 0) + (s.hrPct ?? 0)) / 5);
  await req.db.collection('examSessions').updateOne(
    { _id: s._id },
    { $set: { status: 'auto_submitted', endedAt: new Date(), overallPct } },
  );
  res.json({ ok: true });
}));

router.post('/sessions/:id/violations', requireAuth, loadOwnedSession, asyncHandler(async (req, res) => {
  const { type, severity, message, snapshotBase64 } = req.body ?? {};
  if (!type || !severity || !message) return res.status(400).json({ error: 'invalid_input' });

  let snapshotFileId = null;
  if (snapshotBase64) {
    const bucket = await getSnapshotBucket();
    const buffer = Buffer.from(snapshotBase64, 'base64');
    const uploadStream = bucket.openUploadStream(`${req.session.userId}_${req.session._id}_${Date.now()}.jpg`, {
      contentType: 'image/jpeg',
    });
    await new Promise((resolve, reject) => {
      uploadStream.end(buffer, (err) => (err ? reject(err) : resolve()));
    });
    snapshotFileId = uploadStream.id;
  }

  await req.db.collection('violations').insertOne({
    sessionId: req.session._id,
    userId: req.session.userId,
    type,
    severity,
    message,
    snapshotFileId,
    createdAt: new Date(),
  });

  res.status(201).json({ ok: true });
}));

router.post('/sessions/:id/speaking-recordings', requireAuth, loadOwnedSession, asyncHandler(async (req, res) => {
  const { questionId, mediaBase64, contentType } = req.body ?? {};
  if (!questionId || typeof mediaBase64 !== 'string' || !mediaBase64 || typeof contentType !== 'string') {
    return res.status(400).json({ error: 'invalid_input', detail: 'questionId, mediaBase64, and contentType are required' });
  }
  if (!contentType.startsWith('video/')) return res.status(400).json({ error: 'invalid_media_type' });

  const bucket = await getRecordingBucket();
  const buffer = Buffer.from(mediaBase64, 'base64');
  const uploadStream = bucket.openUploadStream(
    `${req.session.userId}_${req.session._id}_${questionId}_${Date.now()}.webm`,
    { contentType, metadata: { sessionId: req.session._id, questionId: String(questionId), type: 'speaking_response' } },
  );
  await new Promise((resolve, reject) => {
    uploadStream.end(buffer, (err) => (err ? reject(err) : resolve()));
  });

  await req.db.collection('speakingRecordings').insertOne({
    sessionId: req.session._id,
    userId: req.session.userId,
    questionId: new ObjectId(String(questionId)),
    fileId: uploadStream.id,
    contentType,
    durationSeconds: 60,
    createdAt: new Date(),
  });
  res.status(201).json({ ok: true });
}));

router.post('/sessions/:id/voice-recordings', requireAuth, loadOwnedSession, asyncHandler(async (req, res) => {
  const { questionId, mediaBase64, contentType } = req.body ?? {};
  if (!questionId || typeof mediaBase64 !== 'string' || !mediaBase64 || typeof contentType !== 'string' || !contentType.startsWith('audio/')) {
    return res.status(400).json({ error: 'invalid_input', detail: 'questionId, audio data, and an audio content type are required' });
  }
  const bucket = await getRecordingBucket();
  const uploadStream = bucket.openUploadStream(`${req.session.userId}_${req.session._id}_${questionId}_${Date.now()}.webm`, {
    contentType,
    metadata: { sessionId: req.session._id, questionId: String(questionId), type: 'technical_interview_voice' },
  });
  await new Promise((resolve, reject) => {
    uploadStream.end(Buffer.from(mediaBase64, 'base64'), (err) => (err ? reject(err) : resolve()));
  });
  await req.db.collection('voiceInterviewResponses').insertOne({
    sessionId: req.session._id,
    userId: req.session.userId,
    questionId: new ObjectId(String(questionId)),
    fileId: uploadStream.id,
    contentType,
    createdAt: new Date(),
  });
  res.status(201).json({ ok: true });
}));

export default router;
