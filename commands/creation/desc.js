const config = require('../../config.json');
const profileModel = require('../../models/profileModel');
const checkAccountCompletion = require('../../utils/checkAccountCompletion');
const startCooldown = require('../../utils/startCooldown');

module.exports = {
	name: 'desc',
	aliases: ['description'],
	async sendMessage(client, message, argumentsArray, profileData) {

		if (await checkAccountCompletion.hasNotCompletedAccount(message, profileData)) {

			return;
		}

		profileData = await startCooldown(message, profileData);

		if (!argumentsArray.length) {
			return await message
				.reply({
					embeds: [{
						color: config.default_color,
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						title: 'Tell us more about your character! Here is how to use the command:',
						description: '\n\nrp desc [description]\nReplace [description] with your text.',
					}],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		const description = argumentsArray.join(' ');
		await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { description: `${description}` } },
		);

		return await message
			.reply({
				embeds: [{
					color: profileData.color,
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: `Description for ${profileData.name} set:`,
					description: `${description}`,
				}],
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});
	},
};