

import { TrackItemType } from '../app/track-item-type.enum';
import { TrackItemAttributes } from './models/interfaces/track-item-interface';
import * as moment from 'moment';

export default class TrackItemTestData {

    static getAppTrackItem(data = {}, addHours = 0): TrackItemAttributes {
        const rawItem: TrackItemAttributes = {
            app: 'Chrome',
            title: 'google.com',
            taskName: TrackItemType.AppTrackItem,
            beginDate: moment().startOf('day').add(addHours, 'hours').toDate(),
            endDate: moment().startOf('day').add(addHours + 1, 'hours').toDate()
        };

        return Object.assign({}, rawItem, data);
    }

    static getLogTrackItem(data = {}, addDays = 1): TrackItemAttributes {
        const rawItem: TrackItemAttributes = {
            app: 'WORK',
            title: 'Some work.',
            taskName: TrackItemType.LogTrackItem,
            beginDate: moment().startOf('day').add(addDays, 'hours').toDate(),
            endDate: moment().startOf('day').add(addDays + 1, 'hours').toDate()
        };

        return Object.assign({}, rawItem, data);
    }

    static getStatusTrackItem(data: TrackItemAttributes = {}, addDays = 1): TrackItemAttributes {
        const rawItem: TrackItemAttributes = {
            app: 'IDLE',
            taskName: TrackItemType.StatusTrackItem,
            beginDate: moment().startOf('day').add(addDays, 'hours').toDate(),
            endDate: moment().startOf('day').add(addDays + 1, 'hours').toDate()
        };
        rawItem.title = (data.app) ? data.app.toString().toLowerCase() : rawItem.app.toString().toLowerCase();
        return Object.assign({}, rawItem, data);
    }

}


