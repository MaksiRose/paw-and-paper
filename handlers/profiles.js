const fs = require('fs');
const profileModel = require('../models/profileModel');
const otherProfileModel = require('../models/otherProfileModel');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('../utils/itemsInfo');

module.exports = {
	execute(client) {

		const invalidGuilds = [];

		const files = fs.readdirSync('./database/profiles').filter(file => file.endsWith('.json'));

		for (const file of files) {

			const dataObject = JSON.parse(fs.readFileSync(`./database/profiles/${file}`));

			dataObject.inventoryObject = {
				commonPlants: Object.fromEntries([...commonPlantsMap.keys()].sort().map(key => [key, dataObject.inventoryObject.commonPlants[key] || 0])),
				uncommonPlants: Object.fromEntries([...uncommonPlantsMap.keys()].sort().map(key => [key, dataObject.inventoryObject.uncommonPlants[key] || 0])),
				rarePlants: Object.fromEntries([...rarePlantsMap.keys()].sort().map(key => [key, dataObject.inventoryObject.rarePlants[key] || 0])),
				meat: Object.fromEntries([...speciesMap.keys()].sort().map(key => [key, dataObject.inventoryObject.meat[key] || 0])),
			};

			if (dataObject.pronounArray !== undefined) {

				dataObject.pronounSets = [dataObject.pronounArray];
				delete dataObject.pronounArray;
				profileModel.save(dataObject);
			}

			if (dataObject.saplingObject === undefined) {

				dataObject.saplingObject = { exists: false, health: 100, waterCycles: 0, nextWaterTimestamp: null };
				profileModel.save(dataObject);
			}

			profileModel
				.findOneAndUpdate(
					{ userId: dataObject.userId, serverId: dataObject.serverId },
					{
						$set: {
							inventoryObject: dataObject.inventoryObject,
							hasCooldown: false,
							isResting: false,
							energy: dataObject.maxEnergy,
						},
					},
				)
				.then(async () => {

					const inactiveUserProfiles = await otherProfileModel.find({
						userId: dataObject.userId,
						serverId: dataObject.serverId,
					});

					if (invalidGuilds.includes(dataObject.serverId)) {

						moveFile(file, `${dataObject.serverId}${dataObject.userId}`, dataObject.name);
						moveOtherFiles(inactiveUserProfiles);
					}
					else {

						client.guilds
							.fetch(dataObject.serverId)
							.then(guild => {

								guild.members
									.fetch(dataObject.userId)
									.catch(() => moveFile(file, `${dataObject.serverId}${dataObject.userId}`, dataObject.name) && moveOtherFiles(inactiveUserProfiles));
							})
							.catch(error => {

								invalidGuilds.push(dataObject.serverId);
								if (error.httpStatus === 403) {

									moveFile(file, `${dataObject.serverId}${dataObject.userId}`, dataObject.name);
									moveOtherFiles(inactiveUserProfiles);
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

function moveFile(file, id, name) {

	fs.renameSync(`./database/profiles/${file}`, `./database/toDelete/${file}`);

	const toDeleteList = JSON.parse(fs.readFileSync('./database/toDeleteList.json'));

	toDeleteList[id] = toDeleteList[id] || {};
	toDeleteList[id][name] = { fileName: file, deletionTimestamp: Date.now() + 2073600000 };

	fs.writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));
}

function moveOtherFiles(profiles) {

	for (const profile of profiles) {

		fs.renameSync(`./database/profiles/inactiveProfiles/${profile.uuid}.json`, `./database/toDelete/${profile.uuid}.json`);

		const toDeleteList = JSON.parse(fs.readFileSync('./database/toDeleteList.json'));

		toDeleteList[`${profile.serverId}${profile.userId}`] = toDeleteList[`${profile.serverId}${profile.userId}`] || {};
		toDeleteList[`${profile.serverId}${profile.userId}`][profile.name] = { fileName: `${profile.uuid}.json`, deletionTimestamp: Date.now() + 2073600000 };

		fs.writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));
	}
}