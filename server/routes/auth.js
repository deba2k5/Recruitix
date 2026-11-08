import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { toUserDto } from '../lib/sanitize.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = express.Router();
const TOKEN_EXPIRY = '7d';

function issueToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

router.post('/signup', asyncHandler(async (req, res) => {
  const { name, email, year, department, enrollmentNo, password } = req.body ?? {};
  if (
    typeof name !== 'string' ||
    typeof email !== 'string' ||
    typeof year !== 'string' ||
    typeof department !== 'string' ||
    typeof enrollmentNo !== 'string' ||
    typeof password !== 'string' ||
    !name.trim() ||
    !email.trim() ||
    !year.trim() ||
    !department.trim() ||
    !enrollmentNo.trim() ||
    password.length < 6
  ) {
    return res.status(400).json({
      error: 'invalid_input',
      detail: 'name, email, year, department, enrollmentNo, and a password of 6+ characters are required.',
    });
  }

  const db = await getDb();
  const users = db.collection('users');

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await users.findOne({ email: normalizedEmail });
  if (existing) return res.status(409).json({ error: 'email_taken' });

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();
  const doc = {
    email: normalizedEmail,
    passwordHash,
    displayName: name,
    year: String(year).trim(),
    department: String(department).trim(),
    enrollmentNo: String(enrollmentNo).trim(),
    role: 'candidate',
    faceEnrolled: false,
    enrollmentStatus: 'pending',
    createdAt: now,
    updatedAt: now,
  };
  const { insertedId } = await users.insertOne(doc);
  doc._id = insertedId;

  res.status(201).json({ token: issueToken(doc), user: toUserDto(doc) });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return res.status(400).json({ error: 'invalid_input' });
  }

  const db = await getDb();
  const user = await db.collection('users').findOne({ email: email.trim().toLowerCase() });
  if (!user) return res.status(401).json({ error: 'invalid_credentials' });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

  res.json({ token: issueToken(user), user: toUserDto(user) });
}));

router.post('/recruiter-login', asyncHandler(async (req, res) => {
  const { id, password } = req.body ?? {};
  const configuredId = process.env.ADMIN_EMAIL || 'admin@gmail.com';
  const configuredPassword = process.env.ADMIN_PASSWORD || 'admin123';
  if (typeof id !== 'string' || typeof password !== 'string' || id !== configuredId || password !== configuredPassword) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  const recruiter = {
    _id: new ObjectId('000000000000000000000001'),
    email: configuredId,
    displayName: 'Hirex Administrator',
    role: 'recruiter',
  };
  res.json({ token: issueToken(recruiter), user: toUserDto(recruiter) });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const db = await getDb();
  const user = await db.collection('users').findOne({ _id: new ObjectId(req.userId) });
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json({ user: toUserDto(user) });
}));

export default router;
