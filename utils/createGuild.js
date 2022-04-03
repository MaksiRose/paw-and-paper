const fs = require('fs');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('./itemsInfo');
const serverModel = require('../models/serverModel');

module.exports = async (client, guild) => {

	const bannedList = JSON.parse(fs.readFileSync('./database/bannedList.json'));

	const user = await client.users.fetch(guild.ownerId);

	await user
		.createDM()
		.catch((error) => {
			if (error.httpStatus !== 404) {
				throw new Error(error);
			}
		});

	if (bannedList.serversArray.includes(guild.id)) {

		await user
			.send({ content: `I am sorry to inform you that your guild \`${guild.name}\` has been banned from using this bot.` })
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		await guild
			.leave()
			.catch((error) => {
				throw new Error(error);
			});

		return;
	}

	setTimeout(async () => {

		await user
			.send({ content: 'Thank you for adding Paw and Paper to your server! 🥰\nYour server can receive updates about new releases and features. Just go in your server and type `rp getupdates #channel`, with #channel being the channel that you want to receive udpates. Don\'t worry, I won\'t spam you! 😊' })
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});
	}, 300000);

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
			currentlyVisiting: null,
			shop: [],
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

	return await serverData.findOneAndUpdate(
		{ userId: serverData.userId, serverId: serverData.serverId },
		{
			$set: { inventoryObject: serverData.inventoryObject },
		},
	);
};