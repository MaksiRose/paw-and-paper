"use strict";
// @ts-check
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap } = require('./itemsInfo');
const { generateRandomNumber } = require('./randomizers');
/**
 * Picks a random common plant from `commonPlantsMap`.
 * @returns {Promise<string>}
 */
async function pickRandomCommonPlant() {
    return Array.from(commonPlantsMap.keys())[generateRandomNumber(Array.from(commonPlantsMap.keys()).length, 0)];
}
/**
 * Picks a random uncommon plant from `uncommonPlantsMap`.
 * @returns {Promise<string>}
 */
async function pickRandomUncommonPlant() {
    return Array.from(uncommonPlantsMap.keys())[generateRandomNumber(Array.from(uncommonPlantsMap.keys()).length, 0)];
}
/**
 * Picks a random rare plant from `rarePlantsMap`.
 * @returns {Promise<string>}
 */
async function pickRandomRarePlant() {
    return Array.from(rarePlantsMap.keys())[generateRandomNumber(Array.from(rarePlantsMap.keys()).length, 0)];
}
module.exports = {
    pickRandomCommonPlant,
    pickRandomUncommonPlant,
    pickRandomRarePlant,
};
