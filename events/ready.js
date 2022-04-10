// @ts-check
const serverModel = require('../models/serverModel');
const createGuild = require('../utils/createGuild');

/**
 * @type {import('../typedef').Event}
 */
const event = {
	name: 'ready',
	once: true,
	/**
	 * Fires when the bot is first ready.
	 * @param {import('../paw').client} client
	 */
	async execute(client) {

		console.log('Paw and Paper is online!');
		client.user.setActivity('this awesome RPG :)\nrp help', { type: 'PLAYING' });

		for (const file of ['commands', 'votes', 'profiles', 'servers']) {

			require(`../handlers/${file}`).execute(client);
		}


		for (const [, OAuth2Guild] of await client.guilds.fetch()) {

			const serverData = serverModel.findOne({
				serverId: OAuth2Guild.id,
			});

			if (!serverData) {

				const guild = await client.guilds.fetch(OAuth2Guild.id);
				await createGuild(client, guild);
			}
		}
	},
};
module.exports = event;