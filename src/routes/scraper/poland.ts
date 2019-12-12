import { Router } from 'express';

import * as scraper from './../../scraper/poland';

const router = Router();

/**
 * @swagger
 *
 * /scraper/luxembourg/status:
 *   get:
 *     description: Get the status of the scraper service
 *     responses:
 *       200:
 *         description: service is available
 *       502:
 *          description: service not available anymore
 */
router.get('/status', async (req, res) => {
    try {
        await scraper.getVariables();
    } catch (error) {
        return res.sendStatus(502);
    }

    return res.sendStatus(200);
});

router.get('/download', async (req, res) => res.sendStatus(501));

router.get('/api/variables', async (req, res) => {

    let variables;
    try {
        variables = await scraper.getVariables();
    } catch (error) {
        return res.sendStatus(502);
    }

    res.json( { variables });
});


export default router;