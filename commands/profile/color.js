// @ts-check
const { default_color, error_color } = require('../../config.json');
const { profileModel } = require('../../models/profileModel');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const startCooldown = require('../../utils/startCooldown');

module.exports.name = 'color';
module.exports.aliases = ['colour'];

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} profileData
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, profileData) => {

	if (await hasNotCompletedAccount(message, profileData)) {

		return;
	}

	profileData = await startCooldown(message, profileData);

	if (!argumentsArray.length) {

		await message
			.reply({
				embeds: [{
					color: /** @type {`#${string}`} */ (default_color),
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: 'Enter a valid hex code to give your messages and profile that color!',
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	let hexColor = argumentsArray[0].toLowerCase();

	if (hexColor.charAt(0) == '#') {

		hexColor = hexColor.slice(1);
	}

	if (!isHexValid(hexColor)) {

		await message
			.reply({
				embeds: [{
					color: /** @type {`#${string}`} */ (error_color),
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: 'Please send a valid hex code! Valid hex codes consist of 6 characters and contain only letters from \'a\' to \'f\' and/or numbers.',
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	hexColor = '#' + hexColor;

	await profileModel.findOneAndUpdate(
		{ userId: message.author.id, serverId: message.guild.id },
		{ $set: { color: hexColor } },
	);

	await message
		.reply({
			embeds: [{
				color: profileData.color,
				author: { name: message.guild.name, icon_url: message.guild.iconURL() },
				title: `Profile color set to ${hexColor}!`,
			}],
			failIfNotExists: false,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});
	return;
};

/**
 * Checks if a string is a valid hex code.
 * @param {string} input - The string to check.
 * @returns {boolean}
 */
function isHexValid(input) {

	const hexLegend = '0123456789abcdef';

	if (input.length !== 6) {

		return false;
	}

	for (let i = 0; i < input.length; i++) {

		if (hexLegend.includes(input[i])) {

			continue;
		}

		return false;
	}

	return true;
}