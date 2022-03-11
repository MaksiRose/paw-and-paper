const serverModel = require('../models/serverModel');

module.exports = {
	name: 'guildUpdate',
	once: false,
	async execute(client, oldGuild, newGuild) {

		await serverModel.findOneAndUpdate(
			{ serverId: newGuild.id },
			{ $set: { name: newGuild.name } },
		);
	},
};