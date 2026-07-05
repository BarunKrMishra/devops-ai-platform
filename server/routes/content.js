import express from 'express';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const contentPath = join(__dirname, '../content/app.json');
const CACHE_TTL_MS = 60 * 1000;

let cache = {
  loadedAt: 0,
  data: null
};

const loadContent = () => {
  const now = Date.now();
  if (cache.data && now - cache.loadedAt < CACHE_TTL_MS) {
    return cache.data;
  }

  try {
    const raw = fs.readFileSync(contentPath, 'utf8');
    const parsed = JSON.parse(raw);
    cache = { loadedAt: now, data: parsed };
    return parsed;
  } catch (error) {
    console.error('Content load error:', error);
    return cache.data || { landing: {}, marketingPages: [] };
  }
};

router.get('/app', (req, res) => {
  res.json(loadContent());
});

export default router;
