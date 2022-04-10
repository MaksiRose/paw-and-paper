// @ts-check
const serverModel = require('../models/serverModel');
const profileModel = require('../models/profileModel');
const { renameSync, readFileSync, writeFileSync, existsSync, unlinkSync } = require('fs');

/**
 * @type {import('../typedef').Event}
 */
const event = {
	name: 'guildDelete',
	once: false,

	/**
	 * Emitted whenever a guild kicks the client or the guild is deleted/left.
	 * @param {import('../paw').client} client
	 * @param {import('discord.js').Guild} guild
	 */
	async execute(client, guild) {

		const serverData = await serverModel.findOne({
			serverId: guild.id,
		});

		if (serverData === null) {

			return;
		}

		renameSync(`./database/servers/${serverData.uuid}.json`, `./database/toDelete/${serverData.uuid}.json`);

		/**
		 * @type {import('../typedef').DeleteList}
		 */
		let toDeleteList = JSON.parse(readFileSync('./database/toDeleteList.json', 'utf-8'));

		toDeleteList[guild.id] = toDeleteList[guild.id] ?? {};
		toDeleteList[guild.id][guild.name] = { fileName: `${serverData.uuid}.json`, deletionTimestamp: Date.now() + 2592000000 };

		writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));

		for (const profileData of (await profileModel.find({ serverId: guild.id }))) {

			renameSync(`./database/profiles/${profileData.uuid}.json`, `./database/toDelete/${profileData.uuid}.json`);

			toDeleteList = JSON.parse(readFileSync('./database/toDeleteList.json', 'utf-8'));

			toDeleteList[`${profileData.userId}${profileData.serverId}`] = toDeleteList[`${profileData.userId}${profileData.serverId}`] ?? {};
			toDeleteList[`${profileData.userId}${profileData.serverId}`][profileData.name] = { fileName: `${profileData.uuid}.json`, deletionTimestamp: Date.now() + 2073600000 };

			writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));

			setTimeout(async () => {

				if (existsSync(`./database/toDelete/${profileData.uuid}.json`) == true) {

					const dataObject = JSON.parse(readFileSync(`./database/toDelete/${profileData.uuid}.json`, 'utf-8'));
					unlinkSync(`./database/toDelete/${profileData.uuid}.json`);
					console.log('Deleted File: ', dataObject);

					delete toDeleteList[`${profileData.userId}${profileData.serverId}`][profileData.name];
					if (Object.entries(toDeleteList[`${profileData.userId}${profileData.serverId}`]).length === 0) { delete toDeleteList[`${profileData.userId}${profileData.serverId}`]; }
					writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));
				}
			}, 2592000000);
		}

		setTimeout(async () => {

			if (existsSync(`./database/toDelete/${serverData.uuid}.json`) == true) {

				const dataObject = JSON.parse(readFileSync(`./database/toDelete/${serverData.uuid}.json`, 'utf-8'));
				unlinkSync(`./database/toDelete/${serverData.uuid}.json`);
				console.log('Deleted File: ', dataObject);

				delete toDeleteList[guild.id];
				writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));
			}
		}, 2592000000);
	},
};
module.exports = event;