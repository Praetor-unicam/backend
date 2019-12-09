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

import * as swaggerUi from 'swagger-ui-express';

import { swaggerSpec } from './swaggerDef';

import { getData, parseXLSHungary, parseXLSBulgaria, parseCSVPortugal } from './loader'; // getData will return luxembourg's data so far
import { request } from 'http';

const app = express();
app.use(body_parser.json());
app.use('/api', state);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/scraper/luxembourg', luxembourg);
///////////////////DEBUG ROUTES//////////////////////////
app.get('/loader', (request, response) => {
    response.send(parseCSVPortugal(['data/source_files/portugal/portugal.xls']));
});
app.get('/getdata', (request, response) => {
    response.send(getData('hungary'));
});
///////////////////////////////////////////////////////

app.get('/', (request, response) => {
    response.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(5000);
