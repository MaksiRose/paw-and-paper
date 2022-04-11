const config = require('../../config.json');

module.exports = {
	name: 'getupdates',
	aliases: ['updates', 'enableupdates'],
	async sendMessage(client, message) {

		if (message.member.permissions.has('ADMINISTRATOR') === false) {

			return await message
				.reply({
					embeds: [{
						color: config.error_color,
						title: 'Only administrators of a server can use this command!',
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
		}

		if (message.mentions.channels.size > 0) {

			const newsChannel = await client.channels.fetch(config.update_channel_id);
			await newsChannel.addFollower(message.mentions.channels.first().id);

			return await message
				.reply({
					embeds: [{
						color: config.default_color,
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						description: `Updates are now posted to ${message.mentions.channels.first().toString()}!`,
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
		}

		return await message
			.reply({
				embeds: [{
					color: config.error_color,
					description: 'Please mention a channel to turn updates on. To turn them off, just go into the channel\'s settings, click "Integrations" (or "Webhooks"), click "Channels Followed" and then unfollow.',
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
	},
};