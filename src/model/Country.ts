import * as mongoose from 'mongoose';
import { CrimeSchema } from './Crime';

const CountrySchema = new mongoose.Schema({
    country: String,
    data: [CrimeSchema],
});

export { CountrySchema };
