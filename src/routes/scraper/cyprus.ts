import { Router } from 'express';

import * as scraper from './../../scraper/cyprus';

const router = Router();

/**
 * @swagger
 *
 * /scraper/cyprus/status:
 *   get:
 *     description: Get the status of the scraper service
 *     responses:
 *       200:
 *         description: service is available
 *       502:
 *          description: service not available anymore
 */
router.get('/status', async (req, res) =>
    (await scraper.isServiceAvailable()) ? res.sendStatus(200) : res.sendStatus(502),
);

router.get('/download', async (req, res) => ((await scraper.downloadData()) ? res.sendStatus(200) : res.sendStatus(502)));

export default router;
