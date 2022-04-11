// @ts-check
const { readFileSync, renameSync, writeFileSync } = require('fs');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('./itemsInfo');
const serverModel = require('../models/serverModel');

/**
 *
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').Guild} guild
 * @returns
 */
async function createGuild(client, guild) {

	/** @type {import('../typedef').BanList} */
	const bannedList = JSON.parse(readFileSync('./database/bannedList.json', 'utf-8'));

	const user = await client.users.fetch(guild.ownerId);

	await user
		.createDM()
		.catch((error) => {
			if (error.httpStatus !== 404) {
				throw new Error(error);
			}
		});

	if (bannedList.servers.includes(guild.id)) {

		await user
			.send({ content: `I am sorry to inform you that your guild \`${guild.name}\` has been banned from using this bot.` })
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
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
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
	}, 300000);

	/** @type {import('../typedef').DeleteList} */
	const toDeleteList = JSON.parse(readFileSync('./database/toDeleteList.json', 'utf-8'));

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
	renameSync(`./database/toDelete/${guildFile}`, `./database/servers/${guildFile}`);
	delete toDeleteList[guild.id];
	writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));

	/** @type {import('../typedef').ServerSchema} */
	const serverData = /** @type {import('../typedef').ServerSchema} */ (await serverModel.findOne({
		serverId: guild.id,
	}));

	serverData.inventoryObject = {
		commonPlants: Object.fromEntries([...commonPlantsMap.keys()].sort().map(key => [key, serverData.inventoryObject.commonPlants[key] || 0])),
		uncommonPlants: Object.fromEntries([...uncommonPlantsMap.keys()].sort().map(key => [key, serverData.inventoryObject.uncommonPlants[key] || 0])),
		rarePlants: Object.fromEntries([...rarePlantsMap.keys()].sort().map(key => [key, serverData.inventoryObject.rarePlants[key] || 0])),
		meat: Object.fromEntries([...speciesMap.keys()].sort().map(key => [key, serverData.inventoryObject.meat[key] || 0])),
	};

	return await serverModel.findOneAndUpdate(
		{ serverId: serverData.serverId },
		{ $set: { inventoryObject: serverData.inventoryObject } },
	);
}

module.exports = createGuild;