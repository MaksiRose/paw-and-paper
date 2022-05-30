// @ts-check
const { MessageEmbed, MessageActionRow, MessageButton } = require('discord.js');
const profileModel = require('../../models/profileModel');
const { hasNoName } = require('../../utils/checkAccountCompletion');
const disableAllComponents = require('../../utils/disableAllComponents');
const { getFriendshipPoints, getFriendshipHearts, checkOldMentions } = require('../../utils/friendshipHandling');
const sendNoDM = require('../../utils/sendNoDM');
const startCooldown = require('../../utils/startCooldown');

module.exports.name = 'friendships';
module.exports.aliases = ['friendship', 'relationships', 'relationship', 'friends', 'friend'];

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} userData
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData) => {

	if (await sendNoDM(message)) {

		return;
	}

	const characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];

	if (await hasNoName(message, characterData)) {

		return;
	}

	userData = await startCooldown(message);

	/** @type {Array<string>} */
	const friendships = [];

	const allUsersList = /** @type {Array<import('../../typedef').ProfileSchema>} */ (await profileModel.find());
	const friendshipList = [
		...new Set(
			Object.keys(characterData.mentions).concat(
				...allUsersList.map(u => Object.values(u.characters).filter(c => Object.keys(c.mentions).includes(characterData._id)).map(c => c._id)),
			),
		),
	];

	for (const _id of friendshipList) {

		let otherUserData = allUsersList.find(u => u.characters[_id] !== undefined);
		[userData, otherUserData] = await checkOldMentions(userData, characterData._id, otherUserData, _id);
		const friendshipHearts = getFriendshipHearts(getFriendshipPoints(userData.characters[characterData._id].mentions[_id], otherUserData.characters[_id].mentions[characterData._id]));
		friendships.push(`${otherUserData.characters[_id].name} (<@${otherUserData.userId}>) - ${'❤️'.repeat(friendshipHearts) + '🖤'.repeat(10 - friendshipHearts)}`);
	}


	const friendshipPageComponent = new MessageActionRow({
		components: [ new MessageButton({
			customId: 'friendship-left',
			emoji: '⬅️',
			style: 'SECONDARY',
		}), new MessageButton({
			customId: 'friendship-right',
			emoji: '➡️',
			style: 'SECONDARY',
		})],
	});

	let pageNumber = 0;
	let botReply = await message
		.reply({
			embeds: [ new MessageEmbed({
				color: characterData.color,
				author: { name: characterData.name, icon_url: characterData.avatarURL },
				description: friendships.length > 0 ? friendships.slice(pageNumber, 25).join('\n') : 'You have not formed any friendships yet :(',
			})],
			components: friendships.length > 25 ? [friendshipPageComponent] : [],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	interactionCollector();

	async function interactionCollector() {

		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.customId.includes('friendship') && i.user.id == message.author.id;

		/** @type {import('discord.js').MessageComponentInteraction | null} */
		await botReply
			.awaitMessageComponent({ filter, time: 120_000 })
			.then(async interaction => {

				if (interaction.customId === 'friendship-left') {

					pageNumber -= 1;

					if (pageNumber < 0) {

						pageNumber = Math.ceil(friendships.length / 25) - 1;
					}

				}

				if (interaction.customId === 'friendship-right') {

					pageNumber += 1;

					if (pageNumber >= Math.ceil(friendships.length / 25)) {

						pageNumber = 0;
					}
				}

				botReply.embeds[0].description = friendships.slice(pageNumber, 25).join('\n');

				botReply = await botReply
					.edit({
						embeds: botReply.embeds,
						components: botReply.components,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
						return botReply;
					});

				interactionCollector();
			})
			.catch(async () => {

				await botReply
					.edit({
						components: disableAllComponents(botReply.components),
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
				return;
			});
	}
};