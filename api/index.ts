import { createApp } from '../server.ts';

let appPromise: Promise<any> | null = null;

export default async function handler(req: any, res: any) {
  if (!appPromise) {
    appPromise = createApp();
  }
  try {
    const app = await appPromise;
    return app(req, res);
  } catch (err: any) {
    console.error('[Vercel Serverless Function Startup Error]:', err);
    res.status(500).json({
      error: 'Backend API unavailable',
      message: err?.message || String(err)
    });
  }
}
