import express from 'express';
const mongoose = require('mongoose');
const body_parser = require('body-parser');
var state = require('./routes/luxembourg');

mongoose
    .connect('mongodb://localhost:27017/misap_DB')
    .then(() => {
        console.log('Database connection successful');
    })
    .catch(() => {
        console.error('Database connection error');
    });
import luxembourg from './routes/scraper/luxembourg';

import { getData } from './loader'; // getData will return luxembourg's data so far


const app = express();
app.use(body_parser.json());
app.use('/api', state);

app.use('/scraper/luxembourg', luxembourg);
///////////////////DEBUG ROUTES//////////////////////////
app.get('/readCSV-luxembourg', (request, response) => {
    response.send(getData('luxembourg'));
    //response.send(parseCSVLuxembourg('data/source_files/luxembourg/luxembourg.csv'));
});
app.get('/readXLS-cyprus', (request, response) => {
    response.send(getData('cyprus'));
});
///////////////////////////////////////////////////////

app.listen(5000);
