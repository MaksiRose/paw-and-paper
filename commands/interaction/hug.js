// @ts-check
const { generateRandomNumber } = require('../../utils/randomizers');
const { error_color } = require('../../config.json');
const { MessageActionRow, MessageButton } = require('discord.js');
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

	const botReply = await message
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

	const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.user.id === firstMentionedUser.id && i.customId.includes('hug');

	botReply
		.awaitMessageComponent({ filter, time: 120_000 })
		.then(async interaction => {

			if (interaction.customId === 'hug-decline') {

				return Promise.reject();
			}

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

			await botReply
				.edit({
					embeds: [...embedArray, {
						color: characterData?.color || message.member?.displayColor || message.author.accentColor || '#ffffff',
						author: {
							name: characterData?.name || message.member?.displayName || message.author?.tag,
							icon_url: characterData?.avatarURL || message.member?.displayAvatarURL() || message.author?.avatarURL() || undefined,
						},
						image: { url: hugURLs[generateRandomNumber(hugURLs.length, 0)] },
					}],
					components: [],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});

			const partnerUserData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: firstMentionedUser.id }));
			const partnerCharacterData = partnerUserData?.characters?.[partnerUserData?.currentCharacter?.[message.guildId || 'DM']];

			if (characterData !== undefined && partnerCharacterData !== undefined) { await addFriendshipPoints(message, userData, characterData._id, partnerUserData, partnerCharacterData._id); }
		})
		.catch(async () => {

			return await botReply
				.edit({
					embeds: [...embedArray, {
						color: characterData?.color || message.member?.displayColor || message.author.accentColor || '#ffffff',
						author: {
							name: characterData?.name || message.member?.displayName || message.author?.tag,
							icon_url: characterData?.avatarURL || message.member?.displayAvatarURL() || message.author?.avatarURL() || undefined,
						},
						description:`${firstMentionedUser.toString()} did not accept the hug.`,
					}],
					components: disableAllComponents(botReply.components),
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
		});

	return;
};