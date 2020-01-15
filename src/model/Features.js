//import * as mongoose from 'mongoose';
// import { GeoJSONMultiPointSchema } from './geoJSONMultiPoint.schema';
// import { RankSchema } from './rank.schema';
const mongoose = require('mongoose');

const FeaturesSchema = new mongoose.Schema({
    features: [
        {
            geometry: {
                type: String,
                coordinates: [
                    [
                        {
                            lat: Number,
                            lng: Number,
                        },
                    ],
                ],
            },
            type: String,
            properties: {
                NUNTS_NAME: String,
                NUNTS_ID: String,
            },
            id: String,
        },
    ],
});
module.exports = mongoose.model('Features', FeaturesSchema);
