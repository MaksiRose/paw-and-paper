// @ts-check
const { readFileSync, unlinkSync, writeFileSync } = require('fs');
const serverModel = require('../models/serverModel');
const { createGuild } = require('../utils/updateGuild');

/**
 * @type {import('../typedef').Event}
 */
const event = {
	name: 'ready',
	once: true,

	/**
	 * Emitted when the client becomes ready to start working.
	 * @param {import('../paw').client} client
	 */
	async execute(client) {

		console.log('Paw and Paper is online!');
		client.user.setActivity('this awesome RPG :)\nrp help', { type: 'PLAYING' });

		for (const file of ['commands', 'votes', 'servers', 'profiles']) {

			try {

				await require(`../handlers/${file}`).execute(client);
			}
			catch (error) {

				console.error(error);
			}
		}

		const allServers = await client.guilds.fetch();
		for (const [, OAuth2Guild] of allServers) {

			const serverData = /** @type {import('../typedef').ServerSchema} */ (await serverModel.findOne({
				serverId: OAuth2Guild.id,
			}));

			if (!serverData) {

				const guild = await client.guilds.fetch(OAuth2Guild.id);
				await createGuild(client, guild);
			}
		}

		setInterval(() => {

			/** @type {import('../typedef').DeleteList} */
			const toDeleteList = JSON.parse(readFileSync('./database/toDeleteList.json', 'utf-8'));

			for (const [filename, deletionTime] of Object.entries(toDeleteList)) {

				if (deletionTime < Date.now() + 3600000) {

					unlinkSync(`./database/toDelete/${filename}.json`);
					delete toDeleteList[filename];
				}
			}

			writeFileSync('./database/toDeleteList.json', JSON.stringify(toDeleteList, null, '\t'));
		}, 3600000);
	},
};
module.exports = event;