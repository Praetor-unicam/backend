import { Document } from 'mongoose';

export interface Translate extends Document {
    state: [
        {
            id: String;
            original_name: String;
            translate: String;
        },
    ];
}
