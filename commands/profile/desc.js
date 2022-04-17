// @ts-check
const { default_color } = require('../../config.json');
const { profileModel } = require('../../models/profileModel');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const startCooldown = require('../../utils/startCooldown');

module.exports.name = 'desc';
module.exports.aliases = ['description'];

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

		await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { description: '' } },
		);

		await message
			.reply({
				embeds: [{
					color: /** @type {`#${string}`} */ (default_color),
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: 'Your description has been reset!',
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	const description = argumentsArray.join(' ');
	await profileModel.findOneAndUpdate(
		{ userId: message.author.id, serverId: message.guild.id },
		{ $set: { description: description } },
	);

	await message
		.reply({
			embeds: [{
				color: profileData.color,
				author: { name: message.guild.name, icon_url: message.guild.iconURL() },
				title: `Description for ${profileData.name} set:`,
				description: description,
			}],
			failIfNotExists: false,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});
	return;
};