import express from 'express';
import { ObjectId } from 'mongodb';
import { getDb, getRecordingBucket, getSnapshotBucket } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = express.Router();

function parseObjectId(value) {
  return ObjectId.isValid(value) ? new ObjectId(value) : null;
}

async function deleteSessionData(db, session) {
  const sessionId = session._id;
  const [violations, responses, cv, speaking, voice] = await Promise.all([
    db.collection('violations').find({ sessionId }).project({ snapshotFileId: 1 }).toArray(),
    db.collection('examResponses').deleteMany({ sessionId }),
    db.collection('candidateCvs').deleteMany({ sessionId }),
    db.collection('speakingRecordings').find({ sessionId }).project({ fileId: 1 }).toArray(),
    db.collection('voiceInterviewResponses').find({ sessionId }).project({ fileId: 1 }).toArray(),
  ]);
  const snapshotIds = violations.map((item) => item.snapshotFileId).filter(Boolean);
  const recordingIds = [...speaking, ...voice].map((item) => item.fileId).filter(Boolean);
  const snapshotBucket = await getSnapshotBucket();
  const recordingBucket = await getRecordingBucket();
  await Promise.all([
    ...snapshotIds.map((id) => snapshotBucket.delete(id)),
    ...recordingIds.map((id) => recordingBucket.delete(id)),
  ]);
  await Promise.all([
    db.collection('violations').deleteMany({ sessionId }),
    db.collection('speakingRecordings').deleteMany({ sessionId }),
    db.collection('voiceInterviewResponses').deleteMany({ sessionId }),
    db.collection('faceGateAttempts').deleteMany({ sessionId }),
    db.collection('questionBank').deleteMany({ sessionId }),
    db.collection('examSessions').deleteOne({ _id: sessionId }),
  ]);
  return responses.deletedCount;
}

router.get('/overview', requireAuth, requireRole('recruiter'), asyncHandler(async (_req, res) => {
  const db = await getDb();
  const [users, sessions, violations] = await Promise.all([
    db.collection('users').find({ role: 'candidate' }).project({
      passwordHash: 0,
      faceEmbedding: 0,
    }).sort({ createdAt: -1 }).toArray(),
    db.collection('examSessions').find({}).project({
      userId: 1,
      section: 1,
      status: 1,
      startedAt: 1,
      endedAt: 1,
      createdAt: 1,
      overallPct: 1,
      englishPct: 1,
      aptitudePct: 1,
      aiTechnicalPct: 1,
      coding1Pct: 1,
      coding2Pct: 1,
      technical_interviewPct: 1,
      integrityScore: 1,
    }).sort({ createdAt: -1 }).toArray(),
    db.collection('violations').find({}).project({ sessionId: 1 }).toArray(),
  ]);

  const violationsBySession = new Map();
  for (const violation of violations) {
    const key = String(violation.sessionId);
    violationsBySession.set(key, (violationsBySession.get(key) ?? 0) + 1);
  }
  const sessionsByUser = new Map();
  for (const session of sessions) {
    const key = String(session.userId);
    const list = sessionsByUser.get(key) ?? [];
    list.push({
      id: String(session._id),
      section: session.section ?? 'assessment',
      status: session.status,
      startedAt: session.startedAt ?? session.createdAt ?? null,
      endedAt: session.endedAt ?? null,
      percentage: session.section === 'english' ? session.englishPct
        : session.section === 'aptitude' ? session.aptitudePct
          : session.section === 'ai_technical' ? session.aiTechnicalPct
            : session.section === 'coding1' ? session.coding1Pct
              : session.section === 'coding2' ? session.coding2Pct
                : session.section === 'technical_interview' ? session.technical_interviewPct
                  : session.overallPct ?? null,
      integrityScore: session.integrityScore ?? null,
      violations: violationsBySession.get(String(session._id)) ?? 0,
    });
    sessionsByUser.set(key, list);
  }

  const candidates = users.map((user) => {
    const candidateSessions = sessionsByUser.get(String(user._id)) ?? [];
    const completed = candidateSessions.filter((session) => ['submitted', 'auto_submitted'].includes(session.status));
    const percentages = completed.map((session) => session.percentage).filter((value) => typeof value === 'number');
    return {
      id: String(user._id),
      name: user.displayName ?? '',
      email: user.email ?? '',
      year: user.year ?? '',
      department: user.department ?? '',
      enrollmentNo: user.enrollmentNo ?? '',
      enrollmentStatus: user.enrollmentStatus ?? 'pending',
      createdAt: user.createdAt ?? null,
      lastUpdatedAt: user.updatedAt ?? null,
      sessions: candidateSessions,
      completedAssessments: completed.length,
      averagePercentage: percentages.length ? Math.round(percentages.reduce((sum, value) => sum + value, 0) / percentages.length) : null,
    };
  });

  const completedSessions = sessions.filter((session) => ['submitted', 'auto_submitted'].includes(session.status));
  const scored = completedSessions.map((session) => session.section === 'english' ? session.englishPct
    : session.section === 'aptitude' ? session.aptitudePct
      : session.section === 'ai_technical' ? session.aiTechnicalPct
        : session.section === 'coding1' ? session.coding1Pct
          : session.section === 'coding2' ? session.coding2Pct
            : session.section === 'technical_interview' ? session.technical_interviewPct
              : session.overallPct).filter((value) => typeof value === 'number');
  res.json({
    generatedAt: new Date().toISOString(),
    analytics: {
      registeredCandidates: candidates.length,
      completedAssessments: completedSessions.length,
      activeAssessments: sessions.filter((session) => ['pending_manual_review', 'in_progress'].includes(session.status)).length,
      averageScore: scored.length ? Math.round(scored.reduce((sum, value) => sum + value, 0) / scored.length) : 0,
      flaggedAssessments: violationsBySession.size,
    },
    candidates,
  });
}));

router.delete('/candidates/:id', requireAuth, requireRole('recruiter'), asyncHandler(async (req, res) => {
  const userId = parseObjectId(req.params.id);
  if (!userId) return res.status(400).json({ error: 'invalid_candidate' });
  const db = await getDb();
  const candidate = await db.collection('users').findOne({ _id: userId, role: 'candidate' });
  if (!candidate) return res.status(404).json({ error: 'candidate_not_found' });
  const sessions = await db.collection('examSessions').find({ userId }).toArray();
  for (const session of sessions) await deleteSessionData(db, session);
  await Promise.all([
    db.collection('faceEmbeddings').deleteMany({ userId }),
    db.collection('users').deleteOne({ _id: userId, role: 'candidate' }),
  ]);
  res.json({ deleted: true, candidateId: String(userId), sessionsDeleted: sessions.length });
}));

router.delete('/sessions/:id', requireAuth, requireRole('recruiter'), asyncHandler(async (req, res) => {
  const sessionId = parseObjectId(req.params.id);
  if (!sessionId) return res.status(400).json({ error: 'invalid_session' });
  const db = await getDb();
  const session = await db.collection('examSessions').findOne({ _id: sessionId });
  if (!session) return res.status(404).json({ error: 'report_not_found' });
  const candidate = await db.collection('users').findOne({ _id: session.userId, role: 'candidate' }, { projection: { _id: 1 } });
  if (!candidate) return res.status(404).json({ error: 'candidate_not_found' });
  await deleteSessionData(db, session);
  res.json({ deleted: true, sessionId: String(sessionId) });
}));

export default router;
