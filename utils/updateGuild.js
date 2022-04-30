// @ts-check
const { readFileSync, renameSync, writeFileSync, readdirSync } = require('fs');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('./itemsInfo');
const serverModel = require('../models/serverModel');
const { otherProfileModel } = require('../models/profileModel');

/**
 * This creates a new guild if the guild isn't on the ban list, or restores it from the guilds that are to be deleted.
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
			.send({ content: 'Thank you for adding Paw and Paper to your server! 🥰\nYour server can receive updates about new releases and features. Just go in your server and type `rp getupdates #channel`, with #channel being the channel that you want to receive updates. Don\'t worry, I won\'t spam you! 😊' })
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
	}, 300000);

	/** @type {import('../typedef').DeleteList} */
	const toDeleteList = JSON.parse(readFileSync('./database/toDeleteList.json', 'utf-8'));
	let isNewServer = true;

	/* Here we are finding every file in the toDelete folder and adding its uuid to an Array if the server IDs match. We are also moving the files out of the toDelete folder. */
	for (const file of readdirSync('./database/toDelete').filter(f => f.endsWith('.json'))) {

		/** @type {Object.<string, *>} */
		const dataObject = JSON.parse(readFileSync(`'./database/toDelete'/${file}`, 'utf-8'));

		if (Object.hasOwn(dataObject, 'serverId') && dataObject.serverId === guild.id) {

			delete toDeleteList[dataObject.uuid];

			renameSync(`./database/toDelete/${dataObject.uuid}`, `./database/${Object.hasOwn(dataObject, 'userId') ? 'profiles/inactiveProfiles' : 'servers'}/${dataObject.uuid}`);

			if (Object.hasOwn(dataObject, 'userId') === false) { isNewServer = false; }
			await (Object.hasOwn(dataObject, 'userId') ? otherProfileModel : serverModel).update(dataObject.uuid);
		}
	}

	if (isNewServer) {

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
	else {

		writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));
	}
}


module.exports.createGuild = createGuild;