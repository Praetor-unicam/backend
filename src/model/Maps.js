//import * as mongoose from 'mongoose';
// import { GeoJSONMultiPointSchema } from './geoJSONMultiPoint.schema';
// import { RankSchema } from './rank.schema';
const mongoose = require('mongoose');
const features = require('../model/Features');
const MapsSchema = new mongoose.Schema({
    crs: {
        type: { type: String },
        properties: {
            name: String,
        },
    },
    type: { type: String },
    ID: String,
    features: [
        {
            geometry: {
                type: { type: String },
                coordinates: [],
            },
            type: { type: String },
            properties: {
                LAU_CODE: String,
                LAU_LABEL: String,
                GISCO_ID: String,
                Shape_Leng: Number,
                Shape_Area: Number,
                NUTS_NAME: String,
                NUTS_ID: String,
            },
            id: String,
        },
    ],
});
module.exports = mongoose.model('Maps', MapsSchema);
