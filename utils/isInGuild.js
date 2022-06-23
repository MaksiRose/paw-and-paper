// @ts-check
const { MessageEmbed } = require('discord.js');
const { error_color } = require('../config.json');

/**
 * This is checking if the message is in a guild, if it is not, it will reply to the user with a
 * message saying that the command cannot be executed in DMs.
 * @param {import('discord.js').Message} message
 * @returns {message is import('discord.js').Message<true>}
 */
module.exports = (message) => {

	if (!message.inGuild()) {

		message
			.reply({
				embeds: [ new MessageEmbed({
					color: /** @type {`#${string}`} */ (error_color),
					title: 'This command cannot be executed in DMs!',
				})],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		return false;
	}

	return true;
};