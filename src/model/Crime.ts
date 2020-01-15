import * as mongoose from 'mongoose';
// import { GeoJSONMultiPointSchema } from './geoJSONMultiPoint.schema';
// import { RankSchema } from './rank.schema';

const CrimeSchema = new mongoose.Schema({
    ICCS_code: String,
    ICCS_crime: String,
    crime: String,
    value: Number,
});

export { CrimeSchema };
