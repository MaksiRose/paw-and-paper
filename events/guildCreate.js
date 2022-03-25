const serverModel = require('../models/serverModel');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('../utils/itemsInfo');
const fs = require('fs');

module.exports = {
	name: 'guildCreate',
	once: false,
	async execute(client, guild) {

		const toDeleteList = JSON.parse(fs.readFileSync('./database/toDeleteList.json'));

		if (toDeleteList[guild.id] === undefined) {

			const serverInventoryObject = {
				commonPlants: Object.fromEntries([...commonPlantsMap.keys()].sort().map(key => [key, 0])),
				uncommonPlants: Object.fromEntries([...uncommonPlantsMap.keys()].sort().map(key => [key, 0])),
				rarePlants: Object.fromEntries([...rarePlantsMap.keys()].sort().map(key => [key, 0])),
				meat: Object.fromEntries([...speciesMap.keys()].sort().map(key => [key, 0])),
			};

			return await serverModel.create({
				serverId: guild.id,
				name: guild.name,
				inventoryObject: serverInventoryObject,
				blockedEntranceObject: { den: null, blockedKind: null },
				activeUsersArray: [],
				nextPossibleAttack: Date.now(),
				visitChannelId: null,
			});
		}

		const guildFile = toDeleteList[guild.id].fileName;
		fs.renameSync(`./database/toDelete/${guildFile}`, `./database/servers/${guildFile}`);
		delete toDeleteList[guild.id];
		fs.writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));

		const serverData = await serverModel.findOne({
			serverId: guild.id,
		});

		serverData.inventoryObject = {
			commonPlants: Object.fromEntries([...commonPlantsMap.keys()].sort().map(key => [key, serverData.inventoryObject.commonPlants[key] || 0])),
			uncommonPlants: Object.fromEntries([...uncommonPlantsMap.keys()].sort().map(key => [key, serverData.inventoryObject.uncommonPlants[key] || 0])),
			rarePlants: Object.fromEntries([...rarePlantsMap.keys()].sort().map(key => [key, serverData.inventoryObject.rarePlants[key] || 0])),
			meat: Object.fromEntries([...speciesMap.keys()].sort().map(key => [key, serverData.inventoryObject.meat[key] || 0])),
		};

		await serverData.findOneAndUpdate(
			{ userId: serverData.userId, serverId: serverData.serverId },
			{
				$set: { inventoryObject: serverData.inventoryObject },
			},
		);


	},
};