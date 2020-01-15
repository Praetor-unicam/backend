import * as mongoose from 'mongoose';
import { CrimeSchema } from './Crime';
import { RegionSchema } from './Region';

const YearSchema = new mongoose.Schema({
    year: String,
    region: [RegionSchema],
    data: [CrimeSchema],
});

export { YearSchema };
