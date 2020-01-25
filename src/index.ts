import express, { response } from 'express';
const mongoose = require('mongoose');
const body_parser = require('body-parser');
const fileUpload = require('express-fileupload');
const state = require('./routes/luxembourg');
const upload = require('./routes/upload');
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


const app = express();
var bodyParser = require('body-parser');
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

app.use(body_parser.json());
// enable files upload
app.use(fileUpload({
    createParentPath: true
}));
app.use('/api', state);

var path = require('path');

import { swaggerSpec } from './swaggerDef';

import { getCrimeCategories, getFlattenedData } from './loader'; // getData will return luxembourg's data so far
import { compare } from './comparator';
import { request } from 'http';


app.use(helmet()); // Add security headers



app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/upload', upload);
app.use('/form', express.static(path.join(__dirname, '../upload_data')));

//app.use(express.static(path.join(__dirname, '../frontend')));

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
    response.send(await getFlattenedData('luxembourg'));
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
