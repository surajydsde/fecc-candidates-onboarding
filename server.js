import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import app from './api/index.js';

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const distPath = path.resolve(process.cwd(), 'dist');
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    if (!fs.existsSync(path.join(distPath, 'index.html'))) {
      console.error('dist/index.html not found. Run "npm run build" first.');
      process.exit(1);
    }
    app.use(express.static(distPath, { index: false, maxAge: '1h' }));
    app.all('/api/*', (_req, res) => res.status(404).json({ error: 'API route not found' }));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FECC Candidate Onboarding running at http://localhost:${PORT}`);
  });
}

startServer();
