const fs = require('fs');
const profileModel = require('../models/profileModel');
const otherProfileModel = require('../models/otherProfileModel');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('../utils/itemsInfo');

module.exports = {
	execute(client) {

		const invalidGuilds = [];

		const files = [...fs.readdirSync('./database/profiles').map(file => ['./database/profiles', file]), ...fs.readdirSync('./database/profiles/inactiveProfiles').map(file => ['./database/profiles/inactiveProfiles', file])].filter(([, file]) => file.endsWith('.json'));

		for (const [path, file] of files) {

			const dataObject = JSON.parse(fs.readFileSync(`${path}/${file}`));

			dataObject.inventoryObject = {
				commonPlants: Object.fromEntries([...commonPlantsMap.keys()].sort().map(key => [key, dataObject.inventoryObject.commonPlants[key] || 0])),
				uncommonPlants: Object.fromEntries([...uncommonPlantsMap.keys()].sort().map(key => [key, dataObject.inventoryObject.uncommonPlants[key] || 0])),
				rarePlants: Object.fromEntries([...rarePlantsMap.keys()].sort().map(key => [key, dataObject.inventoryObject.rarePlants[key] || 0])),
				meat: Object.fromEntries([...speciesMap.keys()].sort().map(key => [key, dataObject.inventoryObject.meat[key] || 0])),
			};

			if (dataObject.roles !== undefined) {

				dataObject.roles = [];
				(path.includes('inactiveProfiles') ? otherProfileModel : profileModel).save(dataObject);
			}

			(path.includes('inactiveProfiles') ? otherProfileModel : profileModel)
				.findOneAndUpdate(
					{ userId: dataObject.userId, serverId: dataObject.serverId },
					{
						$set: {
							inventoryObject: dataObject.inventoryObject,
							hasCooldown: false,
							isResting: false,
							energy: dataObject.energy === 0 ? 0 : dataObject.maxEnergy,
						},
					},
				)
				.then(async () => {

					if (invalidGuilds.includes(dataObject.serverId)) {

						moveFile(file, `${dataObject.serverId}${dataObject.userId}`, dataObject.name, path);
					}
					else {

						client.guilds
							.fetch(dataObject.serverId)
							.then(guild => {

								guild.members
									.fetch(dataObject.userId)
									.catch(() => moveFile(file, `${dataObject.serverId}${dataObject.userId}`, dataObject.name, path));
							})
							.catch(error => {

								invalidGuilds.push(dataObject.serverId);
								if (error.httpStatus === 403) {

									moveFile(file, `${dataObject.serverId}${dataObject.userId}`, dataObject.name, path);
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

function moveFile(file, id, name, path) {

	fs.renameSync(`${path}/${file}`, `./database/toDelete/${file}`);

	const toDeleteList = JSON.parse(fs.readFileSync('./database/toDeleteList.json'));

	toDeleteList[id] = toDeleteList[id] || {};
	toDeleteList[id][name] = { fileName: file, deletionTimestamp: Date.now() + 2073600000 };

	fs.writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));
}