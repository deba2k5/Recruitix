let appPromise;

async function getApp() {
  appPromise ??= import('../server/app.js').then(({ default: app }) => app);
  return appPromise;
}

export default async function handler(req, res) {
  if (req.url?.split('?')[0] === '/api/health') {
    return res.status(200).json({ ok: true });
  }

  const app = await getApp();
  return app(req, res);
}
