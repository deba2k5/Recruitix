import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.js';
import faceRoutes from './routes/face.js';
import companyRoutes from './routes/companies.js';
import examRoutes from './routes/exam.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '5mb' })); // snapshots are base64 JPEGs in the JSON body

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/face', faceRoutes);
app.use('/api', companyRoutes);
app.use('/api/exam', examRoutes);

app.use((err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
});

export default app;
