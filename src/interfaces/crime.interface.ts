const mongoose = require('mongoose');
import { Document, Types } from 'mongoose';
import { Year } from './year.interface';

export interface Crime extends Document {
    readonly nameofcrime: string;
    readonly yearType: [Year];
}
