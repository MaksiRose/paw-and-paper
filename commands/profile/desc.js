// @ts-check
const { MessageEmbed } = require('discord.js');
const profileModel = require('../../models/profileModel');
const { hasNoName } = require('../../utils/checkAccountCompletion');
const startCooldown = require('../../utils/startCooldown');

module.exports.name = 'desc';
module.exports.aliases = ['description'];

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} userData
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData) => {

	const characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild?.id || 'DM']];

	if (await hasNoName(message, characterData)) {

		return;
	}

	userData = await startCooldown(message);

	if (!argumentsArray.length) {

		await profileModel.findOneAndUpdate(
			{ uuid: userData.uuid },
			(/** @type {import('../../typedef').ProfileSchema} */ p) => {
				p.characters[p.currentCharacter[message.guild?.id || 'DM']].description = '';
			},
		);

		await message
			.reply({
				embeds: [ new MessageEmbed({
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					title: 'Your description has been reset!',
				})],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	const description = argumentsArray.join(' ');
	await profileModel.findOneAndUpdate(
		{ uuid: userData.uuid },
		(/** @type {import('../../typedef').ProfileSchema} */ p) => {
			p.characters[p.currentCharacter[message.guild?.id || 'DM']].description = description;
		},
	);

	await message
		.reply({
			embeds: [ new MessageEmbed({
				color: characterData.color,
				author: { name: characterData.name, icon_url: characterData.avatarURL },
				title: `Description for ${characterData.name} set:`,
				description: description,
			})],
			failIfNotExists: false,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});

	return;
};