// @ts-check
const { readFileSync, renameSync, writeFileSync, readdirSync } = require('fs');
const { commonPlantsMap, uncommonPlantsMap, rarePlantsMap, speciesMap } = require('./itemsInfo');
const serverModel = require('../models/serverModel');

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

	/* This is checking if the guild is on the ban list. If it is, then the bot will leave the guild and
	send a message to the owner of the guild. */
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

	await user
		.send({ content: `Thank you for adding Paw and Paper to **${guild.name}**! 🥰\nYour server can receive updates about new releases and features. This is important since the bot is frequently being updated. Just go in your server and type \`rp getupdates #channel\`, with #channel being the channel that you want to receive updates in. Don't worry, I won't spam you! 😊\n\nThere are more features such as being able to visit other servers (\`rp allowvisits\`) or earning roles (\`rp shopadd\`). You can check page 5 of the \`rp help\` command to find out more.` })
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});

	const toDeleteList = /** @type {import('../typedef').DeleteList} */ (JSON.parse(readFileSync('./database/toDeleteList.json', 'utf-8')));
	let isNewServer = true;

	/* This is checking if the guild is in the toDelete folder. If it is, then it will move the guild out
	of the toDelete folder and update the guild. */
	for (const file of readdirSync('./database/toDelete').filter(f => f.endsWith('.json'))) {

		const serverData = /** @type {import('../typedef').ServerSchema} */ (JSON.parse(readFileSync(`./database/toDelete/${file}`, 'utf-8')));

		if (Object.hasOwn(serverData, 'serverId') && serverData.serverId === guild.id) {

			delete toDeleteList[serverData.uuid];
			renameSync(`./database/toDelete/${serverData.uuid}.json`, `./database/servers/${serverData.uuid}.json`);
			isNewServer = false;
			await serverModel.update(serverData.uuid);
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
			inventory: serverInventoryObject,
			dens: {
				sleepingDens: {
					structure: 100,
					bedding: 100,
					thickness: 100,
					evenness: 100,
				},
				foodDen: {
					structure: 100,
					bedding: 100,
					thickness: 100,
					evenness: 100,
				},
				medicineDen: {
					structure: 100,
					bedding: 100,
					thickness: 100,
					evenness: 100,
				},
			},
			nextPossibleAttack: Date.now(),
			visitChannelId: null,
			currentlyVisiting: null,
			shop: [],
			proxysetting: {
				all: [],
				auto: [],
			},
			skills: ['strength', 'dexterity', 'constitution', 'charisma', 'wisdom', 'intelligence'],
		});
	}
	else {

		writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));
	}
}

/**
 * This moves a guild and the user profiles from that guild into the toDelete folder and adds them to the toDeleteList.
 * @param {string} guildId
 */
async function deleteGuild(guildId) {

	/** @type {import('../typedef').DeleteList} */
	const toDeleteList = JSON.parse(readFileSync('./database/toDeleteList.json', 'utf-8'));

	const serverData = (await serverModel.findOne({ serverId: guildId }));
	renameSync(`./database/servers/${serverData.uuid}.json`, `./database/toDelete/${serverData.uuid}.json`);

	toDeleteList[serverData.uuid] = Date.now() + 2592000000;

	writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));
}


module.exports.createGuild = createGuild;
module.exports.deleteGuild = deleteGuild;