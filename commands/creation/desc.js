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
					throw new Error(error);
				});
		}

		const description = argumentsArray.join(' ');

		(profileData.description != description) && console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): description changed from \x1b[33m${profileData.description} \x1b[0mto \x1b[33m${description} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
		await profileModel
			.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { description: `${description}` } },
			)
			.catch((error) => {
				throw new Error(error);
			});

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
				throw new Error(error);
			});
	},
};