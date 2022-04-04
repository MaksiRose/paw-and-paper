const serverModel = require('../models/serverModel');
const createGuild = require('../utils/createGuild');

module.exports = {
	name: 'ready',
	once: true,
	async execute(client) {

		console.log('Paw and Paper is online!');
		client.user.setActivity('this awesome RPG :)\nrp help', { type: 'PLAYING' });

		for (const file of ['commands', 'votes', 'profiles', 'servers']) {

			require(`../handlers/${file}`).execute(client);
		}

		for (const [, guild] of await client.guilds.fetch()) {

			const serverData = await serverModel.findOne({
				serverId: guild.id,
			});

			if (!serverData) {

				await createGuild(client, guild);
			}
		}
	},
};