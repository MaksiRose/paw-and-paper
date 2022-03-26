const fs = require('fs');
const serverModel = require('../models/serverModel');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('../utils/itemsInfo');

module.exports = {
	execute(client) {

		const validGuilds = new Map();
		const invalidGuilds = [];
		const files = fs.readdirSync('./database/servers').filter(file => file.endsWith('.json'));

		for (const file of files) {

			const dataObject = JSON.parse(fs.readFileSync(`./database/servers/${file}`));

			dataObject.inventoryObject = {
				commonPlants: Object.fromEntries([...commonPlantsMap.keys()].sort().map(key => [key, dataObject.inventoryObject.commonPlants[key] || 0])),
				uncommonPlants: Object.fromEntries([...uncommonPlantsMap.keys()].sort().map(key => [key, dataObject.inventoryObject.uncommonPlants[key] || 0])),
				rarePlants: Object.fromEntries([...rarePlantsMap.keys()].sort().map(key => [key, dataObject.inventoryObject.rarePlants[key] || 0])),
				meat: Object.fromEntries([...speciesMap.keys()].sort().map(key => [key, dataObject.inventoryObject.meat[key] || 0])),
			};

			if (dataObject.blockedEntranceObject === undefined) {

				dataObject.blockedEntranceObject = { den: null, blockedKind: null };
				serverModel.save(dataObject);
			}

			if (dataObject.visitChannelId === undefined) {

				dataObject.visitChannelId = null,
				dataObject.currentlyVisiting = null,
				serverModel.save(dataObject);
			}

			serverModel
				.findOneAndUpdate(
					{ serverId: dataObject.serverId },
					{
						$set: {
							inventoryObject: dataObject.inventoryObject,
							activeUsersArray: [],
							currentlyVisiting: null,
						},
					},
				)
				.then(() => {

					if (invalidGuilds.includes(dataObject.serverId)) {

						moveFile(file, dataObject.serverId);
					}
					else if (validGuilds.has(dataObject.serverId) == false) {

						client.guilds
							.fetch(dataObject.serverId)
							.then(guild => validGuilds.set(dataObject.serverId, guild))
							.catch(error => {

								invalidGuilds.push(dataObject.serverId);
								if (error.httpStatus === 403) {

									moveFile(file, dataObject.serverId);
								}
								else {
									console.error(error);
								}
							});
					}
				});
		}
	},
};

function moveFile(file, id) {
	fs.renameSync(`./database/servers/${file}`, `./database/toDelete/${file}`);
	const toDeleteList = JSON.parse(fs.readFileSync('./database/toDeleteList.json'));
	toDeleteList[id] = { fileName: file, deletionTimestamp: Date.now() + 2073600000 };
	fs.writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));
}
