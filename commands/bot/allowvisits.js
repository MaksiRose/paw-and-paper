const config = require('../../config.json');
const serverModel = require('../../models/serverModel');

module.exports = {
	name: 'allowvisits',
	async sendMessage(client, message, argumentsArray) {

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
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		if (argumentsArray[0] === 'off') {

			await serverModel.findOneAndUpdate(
				{ serverId: message.guild.id },
				{ $set: { visitChannelId: null } },
			);

			return await message
				.reply({
					embeds: [{
						color: config.default_color,
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						description: 'Visits have successfully been turned off!',
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		if (message.mentions.channels.size > 0) {

			console.log(message.mentions.channels.first().id);

			await serverModel.findOneAndUpdate(
				{ serverId: message.guild.id },
				{ $set: { visitChannelId: message.mentions.channels.first().id } },
			);

			return await message
				.reply({
					embeds: [{
						color: config.default_color,
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						description: `Visits are now possible in ${message.mentions.channels.first().toString()}!`,
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		return await message
			.reply({
				embeds: [{
					color: config.error_color,
					description: 'Please mention a channel to turn visits on, or type `rp allowvisits off` to turn visits off.',
					footer: { text: 'The channel you mention will be the channel through which two packs can communicate.' },
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});
	},
};