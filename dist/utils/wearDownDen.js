"use strict";
// @ts-check
const serverModel = require('../models/serverModel');
const { generateRandomNumber } = require('./randomizers');
/**
 * It randomly selects one of the four den stats, and then randomly selects a number between 1 and 5,
 * and then subtracts that number from the selected stat
 * @param {import('../typedef').ServerSchema} serverData
 * @param {'sleeping dens' | 'medicine den' | 'food den'} denKind
 * @returns {Promise<string>}
 */
async function wearDownDen(serverData, denKind) {
    const denName = ['sleepingDens', 'foodDen', 'medicineDen'][['sleeping dens', 'food den', 'medicine den'].indexOf(denKind)];
    const denStatkind = ['structure', 'bedding', 'thickness', 'evenness'][generateRandomNumber(4, 0)];
    const denWeardownPoints = function (weardown) { return (serverData.dens[denName][denStatkind] - weardown < 0) ? serverData.dens[denName][denStatkind] : weardown; }(generateRandomNumber(5, 1));
    serverData = /** @type {import('../typedef').ServerSchema} */ (await serverModel.findOneAndUpdate({ serverId: serverData.serverId }, (/** @type {import('../typedef').ServerSchema} */ s) => {
        s.dens[denName][denStatkind] -= denWeardownPoints;
    }));
    return `-${denWeardownPoints}% ${denStatkind} for ${denKind} (${serverData.dens[denName][denStatkind]}% total)`;
}
module.exports = wearDownDen;
