import express, { response } from 'express';
const mongoose = require('mongoose');
const body_parser = require('body-parser');
const state = require('./routes/luxembourg');
import * as dotenv from 'dotenv';
import helmet from 'helmet';

dotenv.config();

mongoose
    .connect(`mongodb://${process.env.MONGO_HOST}:${process.env.MONGO_PORT}/${process.env.MONGO_DB_NAME}`)
    .then(() => {
        console.log('Database connection successful');
    })
    .catch((err: any) => {
        console.error(err);
    });
import luxembourg from './routes/scraper/luxembourg';
import bulgary from './routes/scraper/bulgary';
import cyprus from './routes/scraper/cyprus';
import poland from './routes/scraper/poland';
import hungary from './routes/scraper/hungary';
import england from './routes/scraper/england';
import ireland from './routes/scraper/ireland';
import france from './routes/scraper/france';
import germany from './routes/scraper/germany';

import * as swaggerUi from 'swagger-ui-express';

import { swaggerSpec } from './swaggerDef';

import { getData, getCrimeCategories, getFlattenedData } from './loader'; // getData will return luxembourg's data so far
import { compare } from './comparator';
import { request } from 'http';

const app = express();
app.use(helmet()); // Add security headers
app.use(body_parser.json());
app.use('/api', state);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/scraper/luxembourg', luxembourg);
app.use('/scraper/bulgary', bulgary);
app.use('/scraper/cyprus', cyprus);
app.use('/scraper/poland', poland);
app.use('/scraper/hungary', hungary);
app.use('/scraper/england', england);
app.use('/scraper/ireland', ireland);
app.use('/scraper/france', france);
app.use('/scraper/germany', germany);
///////////////////DEBUG ROUTES//////////////////////////
app.get('/getdata', async (request, response) => {
    response.send(await getFlattenedData(await getData('italy')));
});

app.get('/getcategories', async (request, response) => {
    response.send(await getCrimeCategories('italy'));
});

app.get('/compare', async (request, response) => {
    response.send(await compare(['Cyprus', 'Luxembourg'], ['Cyprus', 'Luxembourg'], 'national', '2017'));
});
///////////////////////////////////////////////////////

app.get('/', (request, response) => {
    response.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(5000);
