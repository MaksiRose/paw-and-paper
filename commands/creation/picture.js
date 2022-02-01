const config = require('../../config.json');
const profileModel = require('../../models/profileSchema');
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

			(profileData.avatarURL != message.author.avatarURL()) && console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): avatarURL changed from \x1b[33m${profileData.avatarURL} \x1b[0mto \x1b[33m${message.author.avatarURL()} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
			await profileModel
				.findOneAndUpdate(
					{ userId: message.author.id, serverId: message.guild.id },
					{ $set: { avatarURL: message.author.avatarURL() } },
					{ new: true },
				)
				.catch((error) => {
					throw new Error(error);
				});

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
					throw new Error(error);
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
					throw new Error(error);
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
					throw new Error(error);
				});
		}

		(profileData.avatarURL != ImageLink) && console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): avatarURL changed from \x1b[33m${profileData.avatarURL} \x1b[0mto \x1b[33m${ImageLink} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
		await profileModel
			.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { avatarURL: ImageLink } },
				{ new: true },
			)
			.catch((error) => {
				throw new Error(error);
			});

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
				throw new Error(error);
			});
	},
};