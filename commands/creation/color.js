const config = require('../../config.json');
const profileModel = require('../../models/profileSchema');
const checkAccountCompletion = require('../../utils/checkAccountCompletion');
const startCooldown = require('../../utils/startCooldown');

module.exports = {
	name: 'color',
	aliases: ['colour'],
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
						title: 'Enter a valid hex code to give your messages and profile that color!',
					}],
				})
				.catch((error) => {
					throw new Error(error);
				});
		}

		let hexColor = argumentsArray[0].toLowerCase();

		if (hexColor.charAt(0) == '#') {

			hexColor = hexColor.slice(1);
		}

		if (!isHexValid(hexColor)) {

			return await message
				.reply({
					embeds: [{
						color: config.error_color,
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						title: 'Please send a valid hex code! Valid hex codes consist of 6 characters and contain only letters from \'a\' to \'f\' and/or numbers.',
					}],
				})
				.catch((error) => {
					throw new Error(error);
				});
		}

		hexColor = '#' + hexColor;

		(profileData.color != hexColor) && console.log(`\x1b[32m\x1b[0m${message.author.tag} (${message.author.id}): color changed from \x1b[33m${profileData.color} \x1b[0mto \x1b[33m${hexColor} \x1b[0min \x1b[32m${message.guild.name} \x1b[0mat \x1b[3m${new Date().toLocaleString()} \x1b[0m`);
		await profileModel
			.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { color: hexColor } },
				{ new: true },
			)
			.catch((error) => {
				throw new Error(error);
			});

		return await message
			.reply({
				embeds: [{
					color: `${hexColor}`,
					author: { name: `${message.guild.name}`, icon_url: message.guild.iconURL() },
					title: `Profile color set to ${hexColor}!`,
				}],
			})
			.catch((error) => {
				throw new Error(error);
			});
	},
};

function isHexValid(inputString) {

	const hexLegend = '0123456789abcdef';

	if (inputString.length != 6) {

		return false;
	}

	for (let i = 0; i < inputString.length; i++) {

		if (hexLegend.includes(inputString[i])) {

			continue;
		}

		return false;
	}

	return true;
}