const config = require('../../config.json');
const profileModel = require('../../models/profileSchema');
const checkAccountCompletion = require('../../utils/checkAccountCompletion');

module.exports = {
	name: 'desc',
	aliases: ['description'],
	async sendMessage(client, message, argumentsArray, profileData) {

		if (await checkAccountCompletion.hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (!argumentsArray.length) {
			return await message.reply({
				embeds: [{
					color: config.DEFAULT_COLOR,
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: 'Tell us more about your character! Here is how to use the command:',
					description: '\n\nrp desc [description]\nReplace [description] with your text.',
				}],
			});
		}

		const description = argumentsArray.join(' ');

		await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { description: `${description}` } },
			{ upsert: true, new: true },
		);

		return await message.reply({
			embeds: [{
				color: config.DEFAULT_COLOR,
				author: { name: message.guild.name, icon_url: message.guild.iconURL() },
				title: `Description for ${profileData.name} set:`,
				description: `${description}`,
			}],
		});
	},
};