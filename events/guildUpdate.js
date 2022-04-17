// @ts-check
const serverModel = require('../models/serverModel');

/**
 * @type {import('../typedef').Event}
 */
const event = {
	name: 'guildUpdate',
	once: false,

	/**
	 * Emitted whenever a guild is updated - e.g. name change.
	 * @param {import('../paw').client} client
	 * @param {import('discord.js').Guild} oldGuild
	 * @param {import('discord.js').Guild} newGuild
	 */
	async execute(client, oldGuild, newGuild) {

		await serverModel.findOneAndUpdate(
			{ serverId: newGuild.id },
			{ $set: { name: newGuild.name } },
		);
	},
};
module.exports = event;