const config = require('../../config.json');
const profileModel = require('../../models/profileSchema');
const checkAccountCompletion = require('../../utils/checkAccountCompletion');

module.exports = {
	name: 'picture',
	aliases: ['pic', 'pfp'],
	async sendMessage(client, message, argumentsArray, profileData) {

		if (await checkAccountCompletion.hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (!argumentsArray.length && message.attachments.size <= 0) {

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { avatarURL: message.author.avatarURL() } },
				{ upsert: true, new: true },
			);

			return await message.reply({
				embeds: [{
					color: config.DEFAULT_COLOR,
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: `The profile picture for ${profileData.name} is now the accounts profile picture!`,
					footer: { text: 'If you want to set a new picture, just send it together in one message with this command!' },
				}],
			});
		}

		if (message.attachments.size <= 0) {

			return await message.reply({
				embeds: [{
					color: config.DEFAULT_COLOR,
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: 'Please send an image to set as your characters profile picture!',
				}],
			});
		}

		const ImageLink = message.attachments.first().url;

		if (!ImageLink.endsWith('.png') && !ImageLink.endsWith('.jpeg') && !ImageLink.endsWith('.jpg') && !ImageLink.endsWith('.raw')) {

			return await message.reply({
				embeds: [{
					color: config.DEFAULT_COLOR,
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: 'This image extension is not supported! Please send a .png, .jp(e)g or .raw image.',
				}],
			});
		}

		await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { avatarURL: ImageLink } },
			{ upsert: true, new: true },
		);

		return await message.reply({
			embeds: [{
				color: config.DEFAULT_COLOR,
				author: { name: message.guild.name, icon_url: message.guild.iconURL() },
				title: `Profile picture for ${profileData.name} set!`,
				image: { url: ImageLink },
			}],
		});
	},
};