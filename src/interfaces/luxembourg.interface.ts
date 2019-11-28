const mongoose = require('mongoose');
import { Document, Types } from 'mongoose';
import { Crime } from '../interfaces/crime.interface';

export interface Luxembourg extends Document {
    readonly state: string;
    readonly crime: Crime;
}
