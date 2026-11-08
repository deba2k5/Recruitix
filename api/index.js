let appPromise;

async function getApp() {
  appPromise ??= import('../server/app.js').then(({ default: app }) => app);
  return appPromise;
}

export default async function handler(req, res) {
  if (req.url?.split('?')[0] === '/api/health') {
    return res.status(200).json({ ok: true });
  }

  try {
    const app = await getApp();
    await new Promise((resolve, reject) => {
      res.once('finish', resolve);
      res.once('close', resolve);
      app(req, res);
    });
  } catch (error) {
    console.error('Vercel API invocation failed', error);
    if (!res.headersSent) res.status(500).json({ error: 'api_boot_failed' });
  }
}
