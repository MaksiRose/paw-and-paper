const config = require('../../config.json');
const profileModel = require('../../models/profileModel');
const checkAccountCompletion = require('../../utils/checkAccountCompletion');
const startCooldown = require('../../utils/startCooldown');

module.exports = {
	name: 'picture',
	aliases: ['pic', 'pfp'],
	async sendMessage(client, message, argumentsArray, profileData) {

		if (await checkAccountCompletion.hasNotCompletedAccount(message, profileData)) {

			return;
		}

		profileData = await startCooldown(message, profileData);

		if (!argumentsArray.length && message.attachments.size <= 0) {

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { avatarURL: message.author.avatarURL() } },
			);

			return await message
				.reply({
					embeds: [{
						color: profileData.color,
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						title: `The profile picture for ${profileData.name} is now the accounts profile picture!`,
						footer: { text: 'If you want to set a new picture, just send it together in one message with this command!' },
					}],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		if (message.attachments.size <= 0) {

			return await message
				.reply({
					embeds: [{
						color: config.error_color,
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						title: 'Please send an image to set as your characters profile picture!',
					}],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		const ImageLink = message.attachments.first().url;

		if (!ImageLink.endsWith('.png') && !ImageLink.endsWith('.jpeg') && !ImageLink.endsWith('.jpg') && !ImageLink.endsWith('.raw')) {

			return await message
				.reply({
					embeds: [{
						color: config.error_color,
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						title: 'This image extension is not supported! Please send a .png, .jp(e)g or .raw image.',
					}],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { avatarURL: ImageLink } },
		);

		return await message
			.reply({
				embeds: [{
					color: profileData.color,
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: `Profile picture for ${profileData.name} set!`,
					image: { url: ImageLink },
				}],
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});
	},
};