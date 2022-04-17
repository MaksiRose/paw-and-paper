// @ts-check
const { error_color, default_color, update_channel_id } = require('../../config.json');

module.exports.name = 'getupdates';
module.exports.aliases = ['updates', 'enableupdates'];

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message) => {

	if (message.member.permissions.has('ADMINISTRATOR') === false) {

		await message
			.reply({
				embeds: [{
					color: /** @type {`#${string}`} */ (error_color),
					title: 'Only administrators of a server can use this command!',
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if (message.mentions.channels.size > 0) {

		const newsChannel = /** @type {import('discord.js').NewsChannel} */ (await client.channels.fetch(update_channel_id));
		await newsChannel.addFollower(message.mentions.channels.first().id);

		await message
			.reply({
				embeds: [{
					color: /** @type {`#${string}`} */ (default_color),
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					description: `Updates are now posted to ${message.mentions.channels.first().toString()}!`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	await message
		.reply({
			embeds: [{
				color: /** @type {`#${string}`} */ (error_color),
				description: 'Please mention a channel to turn updates on. To turn them off, just go into the channel\'s settings, click "Integrations" (or "Webhooks"), click "Channels Followed" and then unfollow.',
			}],
			failIfNotExists: false,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});
	return;
};