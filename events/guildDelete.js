const serverModel = require('../models/serverModel');
const profileModel = require('../models/profileModel');

module.exports = {
	name: 'guildDelete',
	once: false,
	async execute(client, guild) {

		await serverModel.findOneAndDelete({
			serverId: guild.id,
		});

		for (const profile of await profileModel.find({ serverId: guild.id })) {

			await profileModel.findOneAndDelete(profile);
		}
	},
};