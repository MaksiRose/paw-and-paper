// @ts-check

module.exports.name = 'uptime';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message) => {

	await message
		.reply({
			content: `Uptime: ${Math.floor(client.uptime || 0 / 3600000)} hours ${Math.floor(client.uptime || 0 / 60000) % 60} minutes\nPing: ${client.ws.ping} ms`,
			failIfNotExists: false,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});
	return;
};