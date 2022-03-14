const fs = require('fs');
const serverModel = require('../models/serverModel');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('../utils/itemsInfo');

module.exports = {
	execute() {

		for (const file of fs.readdirSync('./database/servers')) {

			if (!file.endsWith('.json')) {

				continue;
			}

			const dataObject = JSON.parse(fs.readFileSync(`./database/servers/${file}`));

			if (Object.hasOwn(dataObject.inventoryObject.commonPlants, 'neem')) {

				dataObject.inventoryObject.commonPlants = Object.fromEntries(
					Object.entries(dataObject.inventoryObject.commonPlants).map(([key, value]) => (key == 'neem') ? ['arnica', value] : [key, value]),
				);
			}

			dataObject.inventoryObject = {
				commonPlants: Object.fromEntries([...commonPlantsMap.keys()].sort().map(key => [key, dataObject.inventoryObject.commonPlants[key] || 0])),
				uncommonPlants: Object.fromEntries([...uncommonPlantsMap.keys()].sort().map(key => [key, dataObject.inventoryObject.uncommonPlants[key] || 0])),
				rarePlants: Object.fromEntries([...rarePlantsMap.keys()].sort().map(key => [key, dataObject.inventoryObject.rarePlants[key] || 0])),
				meat: Object.fromEntries([...speciesMap.keys()].sort().map(key => [key, dataObject.inventoryObject.meat[key] || 0])),
			};

			serverModel.findOneAndUpdate(
				{ serverId: dataObject.serverId },
				{
					$set: {
						inventoryObject: dataObject.inventoryObject,
						activeUsersArray: [],
					},
					$add: {
						nextPossibleAttack: Date.now(),
					},
				},
			);
		}
	},
};