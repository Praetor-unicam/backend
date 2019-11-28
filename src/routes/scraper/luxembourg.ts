import { Router } from 'express';

import * as scraper from './../../scraper/luxembourg';

const router = Router();

router.get('/status', async (req, res) =>
    (await scraper.isServiceAvailable()) ? res.sendStatus(200) : res.sendStatus(502),
);

router.get('/download', async (req, res) => ((await scraper.scrapeData()) ? res.sendStatus(200) : res.sendStatus(502)));

export default router;
