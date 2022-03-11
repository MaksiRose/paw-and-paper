const serverModel = require('../models/serverModel');

module.exports = {
	name: 'guildDelete',
	once: false,
	async execute(client, guild) {

		await serverModel.findOneAndDelete({
			serverId: guild.id,
		});
	},
};