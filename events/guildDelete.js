// @ts-check
const serverModel = require('../models/serverModel');
const { deleteGuild } = require('../utils/updateGuild');

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

		const serverData = /** @type {import('../typedef').ServerSchema} */ (await serverModel.findOne({
			serverId: guild.id,
		}));

		if (serverData === null) {

			return;
		}

		deleteGuild(guild.id);
	},
};
module.exports = event;