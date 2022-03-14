const serverModel = require('../models/serverModel');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('../utils/itemsInfo');

module.exports = {
	name: 'guildCreate',
	once: false,
	async execute(client, guild) {

		const serverInventoryObject = {
			commonPlants: Object.fromEntries([...commonPlantsMap.keys()].sort().map(key => [key, 0])),
			uncommonPlants: Object.fromEntries([...uncommonPlantsMap.keys()].sort().map(key => [key, 0])),
			rarePlants: Object.fromEntries([...rarePlantsMap.keys()].sort().map(key => [key, 0])),
			meat: Object.fromEntries([...speciesMap.keys()].sort().map(key => [key, 0])),
		};

		await serverModel.create({
			serverId: guild.id,
			name: guild.name,
			inventoryObject: serverInventoryObject,
			accountsToDelete: {},
			activeUsersArray: [],
			nextPossibleAttack: Date.now(),
		});
	},
};