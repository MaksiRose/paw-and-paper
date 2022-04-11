// @ts-check
const serverModel = require('../models/serverModel');
const { startDeleteListTimeouts } = require('../paw');
const createGuild = require('../utils/createGuild');

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

		for (const file of ['commands', 'votes', 'profiles', 'servers']) {

			require(`../handlers/${file}`).execute(client);
		}


		for (const [, OAuth2Guild] of await client.guilds.fetch()) {

			const serverData = /** @type {import('../typedef').ServerSchema} */ (await serverModel.findOne({
				serverId: OAuth2Guild.id,
			}));

			if (!serverData) {

				const guild = await client.guilds.fetch(OAuth2Guild.id);
				await createGuild(client, guild);
			}
		}

		startDeleteListTimeouts();
	},
};
module.exports = event;