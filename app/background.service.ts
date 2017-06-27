
import TaskAnalyser from './task-analyser';
import { settingsService } from './services/settings-service';
import { trackItemService } from './services/track-item-service';
import { appSettingService } from './services/app-setting-service';
import { TrackItemInstance, TrackItemAttributes } from './models/interfaces/track-item-interface';
import { State } from './state.enum';
import { app, ipcMain, dialog } from "electron";
import config from "./config";

import { logManager } from "./log-manager";
import { stateManager } from "./state-manager";
var logger = logManager.getLogger('BackgroundService');

var $q = require('q');

import * as moment from 'moment';
import * as activeWin from 'active-win';
import UserMessages from "./user-messages";
import BackgroundUtils from "./background.utils";
import * as path from 'path';
import { exec, execSync, execFile } from "child_process";
import { TrackItemType } from "./track-item-type.enum";
import { appConstants } from "./app-constants";


const emptyItem = { title: 'EMPTY' };

let shouldSplitLogItemFromDate = null;


let oneThreadRunning = false;

export class BackgroundService {

    addInactivePeriod(beginDate, endDate) {

        var item: any = { app: State.Offline, title: "Inactive" };
        item.taskName = 'StatusTrackItem';
        item.beginDate = beginDate;
        item.endDate = endDate;
        logger.info("Adding inactive trackitem", item);

        stateManager.resetStatusTrackItem();
        return this.createOrUpdate(item);
    }

    async createItems(items) {
        const promiseArray = items.map(async (newItem) => {
            const savedItem = await trackItemService.createItem(newItem);
            return savedItem;
        });
        return await Promise.all(promiseArray);

    }

    async createOrUpdate(rawItem) {

        let color = await appSettingService.getAppColor(rawItem.app);
        rawItem.color = color;

        let item: any;

        let type: TrackItemType = rawItem.taskName;

        if (!type) {
            throw new Error('TaskName not defined.');
        }

        if (BackgroundUtils.shouldSplitInTwoOnMidnight(rawItem.beginDate, rawItem.endDate)) {

            let items: TrackItemAttributes[] = BackgroundUtils.splitItemIntoDayChunks(rawItem);

            if (stateManager.hasSameRunningTrackItem(rawItem)) {
                let firstItem = items.shift();
                stateManager.endRunningTrackItem(firstItem);
            }

            let savedItems = await this.createItems(items);

            let lastItem = savedItems[savedItems.length - 1];
            item = lastItem;
            stateManager.setRunningTrackItem(item);

        } else {

            if (stateManager.hasSameRunningTrackItem(rawItem)) {

                item = await stateManager.updateRunningTrackItemEndDate(type);

            } else if (!stateManager.hasSameRunningTrackItem(rawItem)) {

                item = await stateManager.createNewRunningTrackItem(rawItem);

                TaskAnalyser.analyseAndNotify(item);

                let fromDate: Date = await TaskAnalyser.analyseAndSplit(item);
                if (fromDate) {
                    logger.info("Splitting LogTrackItem from date:", fromDate);
                    shouldSplitLogItemFromDate = fromDate;
                }
            }
        }

        return item;
    }

    saveActiveWindow(newAppTrackItem) {
        if (stateManager.isSystemSleeping()) {
            logger.info('Computer is sleeping, not running saveActiveWindow');
            return 'SLEEPING'; //TODO: throw exception
        }

        if (stateManager.isSystemIdling()) {
            logger.debug('Not saving, app is idling', newAppTrackItem);
            stateManager.resetAppTrackItem();
            return 'IDLING'; //TODO: throw exception
        }

        if (!newAppTrackItem.title && !newAppTrackItem.app) {
            // Lock screen have no title, maybe something
            newAppTrackItem.app = 'NATIVE';
            newAppTrackItem.taskName = 'AppTrackItem';
            newAppTrackItem.title = 'NO_TITLE';
        } else {
            newAppTrackItem.taskName = 'AppTrackItem';
        }

        this.createOrUpdate(newAppTrackItem);
    }

    saveIdleTrackItem(seconds) {

        if (stateManager.isSystemSleeping()) {
            logger.info('Computer is sleeping, not running saveIdleTrackItem');
            return 'SLEEPING';
        }

        let state: State = (seconds > appConstants.IDLE_IN_SECONDS_TO_LOG) ? State.Idle : State.Online;
        // Cannot go from OFFLINE to IDLE
        if (stateManager.isSystemOffline() && state === State.Idle) {
            logger.info('Not saving. Cannot go from OFFLINE to IDLE');
            return 'BAD_STATE';
        }

        var rawItem: any = {
            taskName: 'StatusTrackItem',
            app: state,
            title: state.toString().toLowerCase(),
            beginDate: BackgroundUtils.currentTimeMinusJobInterval(),
            endDate: new Date()
        };

        this.createOrUpdate(rawItem);

    }

    onSleep() {
        stateManager.setSystemToSleep();
    }

    onResume() {
        stateManager.setAwakeFromSleep();
        let statusTrackItem = stateManager.getRunningTrackItem(TrackItemType.StatusTrackItem);
        if (statusTrackItem != null) {
            this.addInactivePeriod(statusTrackItem.endDate, new Date());
        } else {
            logger.info('No lastTrackItems.StatusTrackItem for addInactivePeriod.');
        }
    }

}

export const backgroundService = new BackgroundService();
