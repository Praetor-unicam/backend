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

const app = express();
app.use(body_parser.json());
app.use('/api', state);

app.listen(5000);
