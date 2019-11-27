import express from 'express';
import { getData, parseXLSCyprus, parseCSVLuxembourg } from './loader'; // getData will return luxembourg's data so far
const app = express();

app.get('/', (request, response) => {
    response.send('Hello world!');
});

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
