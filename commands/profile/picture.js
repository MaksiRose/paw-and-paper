// @ts-check
const { MessageEmbed } = require('discord.js');
const { error_color } = require('../../config.json');
const profileModel = require('../../models/profileModel');
const { hasNoName } = require('../../utils/checkAccountCompletion');
const startCooldown = require('../../utils/startCooldown');

module.exports.name = 'picture';
module.exports.aliases = ['pic', 'pfp', 'avatar'];

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} userData
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData) => {

	const characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];

	if (await hasNoName(message, characterData)) {

		return;
	}

	userData = await startCooldown(message);

	if (!argumentsArray.length && message.attachments.size <= 0) {

		await profileModel.findOneAndUpdate(
			{ uuid: userData.uuid },
			(/** @type {import('../../typedef').ProfileSchema} */ p) => {
				p.characters[p.currentCharacter[message.guild.id]].avatarURL = message.author.avatarURL();
			},
		);

		await message
			.reply({
				embeds: [ new MessageEmbed({
					color: characterData.color,
					author: { name: characterData.name, icon_url: message.author.avatarURL() },
					title: `The profile picture for ${characterData.name} is now the accounts profile picture!`,
					footer: { text: 'If you want to set a new picture, just send it together in one message with this command!' },
				})],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if (message.attachments.size <= 0) {

		await message
			.reply({
				embeds: [ new MessageEmbed({
					color: /** @type {`#${string}`} */ (error_color),
					title: 'Please send an image to set as your characters profile picture!',
				})],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	const ImageLink = message.attachments.first().url;

	if (!ImageLink.endsWith('.png') && !ImageLink.endsWith('.jpeg') && !ImageLink.endsWith('.jpg') && !ImageLink.endsWith('.raw') && !ImageLink.endsWith('.webp')) {

		await message
			.reply({
				embeds: [ new MessageEmbed({
					color: /** @type {`#${string}`} */ (error_color),
					title: 'This image extension is not supported! Please send a .png, .jp(e)g, .raw or .webp image.',
				})],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
		{ uuid: userData.uuid },
		(/** @type {import('../../typedef').ProfileSchema} */ p) => {
			p.characters[p.currentCharacter[message.guild.id]].avatarURL = ImageLink;
		},
	));

	await message
		.reply({
			embeds: [ new MessageEmbed({
				color: characterData.color,
				author: { name: characterData.name, icon_url: ImageLink },
				title: `Profile picture for ${characterData.name} set!`,
				image: { url: ImageLink },
			})],
			failIfNotExists: false,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});

	return;
};