const config = require('../../config.json');
const profileModel = require('../../models/profileModel');
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
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
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
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		hexColor = '#' + hexColor;

		await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { color: hexColor } },
		);

		return await message
			.reply({
				embeds: [{
					color: `${hexColor}`,
					author: { name: `${message.guild.name}`, icon_url: message.guild.iconURL() },
					title: `Profile color set to ${hexColor}!`,
				}],
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
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