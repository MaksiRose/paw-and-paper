const serverModel = require('../models/serverModel');

module.exports = {
	name: 'ready',
	once: true,
	async execute(client) {

		console.log('Paw and Paper is online!');
		client.user.setActivity('this awesome RPG :)\nrp help', { type: 'PLAYING' });

		for (const file of ['commands', 'profiles', 'servers']) {

			require(`../handlers/${file}`).execute(client);
		}

		// eslint-disable-next-line no-unused-vars
		for (const [guild_key, guild] of client.guilds.cache) {

			const serverData = await serverModel.findOne({
				serverId: guild.id,
			});

			if (!serverData) {

				return;
			}
		}
	},
};