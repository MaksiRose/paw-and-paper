"use strict";
// @ts-check
/** @type {Map<string, { activeCommands: number, lastGentleWaterReminderTimestamp: number, activityTimeout: null | NodeJS.Timeout, cooldownTimeout: null | NodeJS.Timeout, restingTimeout: null | NodeJS.Timeout }>} */
const userMap = new Map();
module.exports = userMap;
