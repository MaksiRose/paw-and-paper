// @ts-check
const { createGuild } = require('../utils/updateGuild');

/**
 * @type {import('../typedef').Event}
 */
const event = {
	name: 'guildCreate',
	once: false,

	/**
	 * Emitted whenever the client joins a guild.
	 * @param {import('../paw').client} client
	 * @param {import('discord.js').Guild} guild
	 */
	async execute(client, guild) {

		await createGuild(client, guild);
	},
};
module.exports = event;