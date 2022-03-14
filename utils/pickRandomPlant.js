const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap } = require('./itemsInfo');
const { generateRandomNumber } = require('./randomizers');

module.exports = {

	async pickRandomCommonPlant() {

		return Array.from(commonPlantsMap.keys())[generateRandomNumber(Array.from(commonPlantsMap.keys()).length, 0)];
	},

	async pickRandomUncommonPlant() {

		return Array.from(uncommonPlantsMap.keys())[generateRandomNumber(Array.from(uncommonPlantsMap.keys()).length, 0)];
	},

	async pickRandomRarePlant() {

		return Array.from(rarePlantsMap.keys())[generateRandomNumber(Array.from(rarePlantsMap.keys()).length, 0)];
	},

};