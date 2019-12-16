const mongoose = require('mongoose');
import { Document, Types } from 'mongoose';

export interface Year extends Document {
    readonly current_year: Number;
    readonly numberofcrime: Number;
}
