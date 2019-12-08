import express, { response } from 'express';
const mongoose = require('mongoose');
const body_parser = require('body-parser');
const state = require('./routes/luxembourg');

mongoose
    .connect('mongodb://localhost:27017/misap_DB')
    .then(() => {
        console.log('Database connection successful');
    })
    .catch(() => {
        console.error('Database connection error');
    });
import luxembourg from './routes/scraper/luxembourg';
import bulgary from './routes/scraper/bulgary';

import * as swaggerUi from 'swagger-ui-express';

import { swaggerSpec } from './swaggerDef';

import { getData } from './loader'; // getData will return luxembourg's data so far
import { request } from 'http';

const app = express();
app.use(body_parser.json());
app.use('/api', state);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/scraper/luxembourg', luxembourg);
app.use('/scraper/bulgary', bulgary);
///////////////////DEBUG ROUTES//////////////////////////
app.get('/readCSV-luxembourg', (request, response) => {
    response.send(getData('luxembourg'));
    //response.send(parseCSVLuxembourg('data/source_files/luxembourg/luxembourg.csv'));
});
app.get('/readXLS-cyprus', (request, response) => {
    response.send(getData('cyprus'));
});
///////////////////////////////////////////////////////

app.get('/', (request, response) => {
    response.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(5000);
