// @ts-check
const { generateRandomNumber } = require('../../utils/randomizers');
const { error_color } = require('../../../config.json');
const { MessageActionRow, MessageButton, Message } = require('discord.js');
const disableAllComponents = require('../../utils/disableAllComponents');
const profileModel = require('../../models/profileModel');
const { addFriendshipPoints } = require('../../utils/friendshipHandling');

module.exports.name = 'hug';
module.exports.aliases = ['snuggle'];

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {import('../../typedef').ServerSchema} serverData
 * @param {Array<import('discord.js').MessageEmbed>} embedArray
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData, serverData, embedArray) => {

	const characterData = userData?.characters?.[userData?.currentCharacter?.[message.guildId || 'DM']];

	const firstMentionedUser = message.mentions.users.first();
	if (firstMentionedUser && firstMentionedUser.id === message.author.id) {

		const selfHugURLs = [
			'https://c.tenor.com/kkW-x5TKP-YAAAAC/seal-hug.gif',
			'https://c.tenor.com/a2ZPJZC3E50AAAAC/duck-sleeping.gif',
			'https://c.tenor.com/uPyoU80DaMsAAAAd/yawn-pampered-pandas.gif',
			'https://c.tenor.com/P5lPftY1nzUAAAAd/tired-exhausted.gif'];

		const embed = {
			color: characterData?.color || message.member?.displayColor || message.author.accentColor || '#ffffff',
			author: {
				name: characterData?.name || message.member?.displayName || message.author?.tag,
				icon_url: characterData?.avatarURL || message.member?.displayAvatarURL() || message.author?.avatarURL() || undefined,
			},
			image: { url: selfHugURLs[generateRandomNumber(selfHugURLs.length, 0)] },
		};

		await message
			.reply({
				embeds: [...embedArray, embed],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if (!firstMentionedUser) {

		const embed = {
			color: /** @type {`#${string}`} */ (error_color),
			title: 'Please mention a user that you want to hug!',
		};

		await message
			.reply({
				embeds: [...embedArray, embed],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	await message
		.reply({
			embeds: [...embedArray, {
				color: characterData?.color || message.member?.displayColor || message.author.accentColor || '#ffffff',
				author: {
					name: characterData?.name || message.member?.displayName || message.author?.tag,
					icon_url: characterData?.avatarURL || message.member?.displayAvatarURL() || message.author?.avatarURL() || undefined,
				},
				description: `${firstMentionedUser.toString()}, do you accept the hug?`,
			}],
			components: [ new MessageActionRow({
				components: [ new MessageButton({
					customId: 'hug-accept',
					label: 'Accept',
					emoji: '🫂',
					style: 'SUCCESS',
				}), new MessageButton({
					customId: 'hug-decline',
					label: 'Decline',
					style: 'DANGER',
				})],
			})],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });
};

/**
 * A function that is called when the user accepts the hug. It edits the message to show a hug gif and
 * adds friendship points.
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {import('../../typedef').ProfileSchema} partnerUserData
 * @param {import('../../typedef').Character} partnerCharacterData
 * @param {import('discord.js').Message} referencedMessage
 */
module.exports.sendHugMessage = async (interaction, partnerUserData, partnerCharacterData, referencedMessage) => {

	if (!(interaction.message instanceof Message)) { return; }

	const hugURLs = [
		'https://c.tenor.com/h94rl66G50cAAAAC/hug-cats.gif',
		'https://c.tenor.com/-YZ5lgNG7ecAAAAd/yes-love.gif',
		'https://c.tenor.com/K-mORy7U1SsAAAAd/wolf-animal.gif',
		'https://c.tenor.com/x2Ne9xx0SBgAAAAC/funny-animals-monkey-hug.gif',
		'https://c.tenor.com/a8H63f_WrqEAAAAC/border-collie-hug.gif',
		'https://c.tenor.com/jQud2Zph9OoAAAAC/animal-animals.gif',
		'https://c.tenor.com/tyK64-bjkikAAAAC/sweet-animals-cute.gif',
		'https://c.tenor.com/K2uYNMCeqe4AAAAC/bear-hug.gif',
		'https://c.tenor.com/j9ovpes78QsAAAAd/huge-hug-bromance.gif',
		'https://c.tenor.com/EKlPRdcuoccAAAAC/otter-cute.gif',
		'https://c.tenor.com/N-MAzVmbytEAAAAd/cat-dog.gif',
		'https://c.tenor.com/WvsUTL2ocVkAAAAd/cute-cats-cuddling-cats.gif',
		'https://c.tenor.com/8SjdZ9f64s8AAAAd/animals-kiss.gif',
		'https://c.tenor.com/VOLRmvc9PawAAAAd/cute-animals.gif',
		'https://c.tenor.com/N4wxlSS6s6YAAAAd/wake-up-360baby-pandas.gif',
	];

	const userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: referencedMessage.author.id }));
	const characterData = userData?.characters?.[userData?.currentCharacter?.[referencedMessage.guildId || 'DM']];

	const embedArray = interaction.message.embeds.slice(0, interaction.message.embeds.length - 1);
	await interaction.message
		.edit({
			embeds: [...embedArray, {
				color: characterData?.color || referencedMessage.member?.displayColor || referencedMessage.author.accentColor || '#ffffff',
				author: {
					name: characterData?.name || referencedMessage.member?.displayName || referencedMessage.author?.tag,
					icon_url: characterData?.avatarURL || referencedMessage.member?.displayAvatarURL() || referencedMessage.author?.avatarURL() || undefined,
				},
				image: { url: hugURLs[generateRandomNumber(hugURLs.length, 0)] },
			}],
			components: [],
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});

	if (characterData !== undefined && partnerCharacterData !== undefined) { await addFriendshipPoints(referencedMessage, userData, characterData._id, partnerUserData, partnerCharacterData._id); }
};

/**
 * A function that is called when the user declines the hug. It edits the message to show that the user
 * declined the hug.
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {import('discord.js').Message} referencedMessage
 */
module.exports.sendNoHugMessage = async (interaction, referencedMessage) => {

	if (!(interaction.message instanceof Message)) { return; }

	const userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: referencedMessage.author.id }));
	const characterData = userData?.characters?.[userData?.currentCharacter?.[referencedMessage.guildId || 'DM']];

	const embedArray = interaction.message.embeds.slice(0, interaction.message.embeds.length - 1);
	await interaction.message
		.edit({
			embeds: [...embedArray, {
				color: characterData?.color || referencedMessage.member?.displayColor || referencedMessage.author.accentColor || '#ffffff',
				author: {
					name: characterData?.name || referencedMessage.member?.displayName || referencedMessage.author?.tag,
					icon_url: characterData?.avatarURL || referencedMessage.member?.displayAvatarURL() || referencedMessage.author?.avatarURL() || undefined,
				},
				description:`${referencedMessage.mentions.users.first()?.toString()} did not accept the hug.`,
			}],
			components: disableAllComponents(interaction.message.components),
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});
};