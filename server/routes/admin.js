import express from 'express';
import { getDb } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = express.Router();

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

export default router;
