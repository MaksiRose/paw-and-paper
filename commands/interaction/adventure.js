// @ts-check
const { readFileSync } = require('fs');
const { profileModel } = require('../../models/profileModel');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid } = require('../../utils/checkValidity');
const { getFriendshipHearts, getFriendshipPoints, getFriendshipKey } = require('../../utils/friendshipHandling');
const { pronoun } = require('../../utils/getPronouns');
const startCooldown = require('../../utils/startCooldown');
const { remindOfAttack } = require('../gameplay/attack');
const { error_color } = require('../../config.json');
const { MessageActionRow, MessageButton } = require('discord.js');
const { generateRandomNumber } = require('../../utils/randomizers');
const { createCommandCollector } = require('../../utils/commandCollector');
const disableAllComponents = require('../../utils/disableAllComponents');

module.exports.name = 'adventure';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} profileData
 * @param {import('../../typedef').ServerSchema} serverData
 * @param {Array<import('discord.js').MessageEmbedOptions>} embedArray
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, profileData, serverData, embedArray) => {

	if (await hasNotCompletedAccount(message, profileData)) {

		return;
	}

	if (await isInvalid(message, profileData, embedArray, [module.exports.name])) {

		return;
	}

	profileData = await startCooldown(message, profileData);
	const messageContent = remindOfAttack(message);

	if (!message.mentions.users.size) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `*${profileData.name} is looking to go on an adventure, but going alone is very dangerous. The ${profileData.species} should find someone to take with ${pronoun(profileData, 1)}.*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	const partnerProfileData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({
		userId: message.mentions.users.first()?.id,
		serverId: message.guild.id,
	}));

	if (!partnerProfileData || partnerProfileData.name === '' || partnerProfileData.species === '' || partnerProfileData.energy <= 0 || partnerProfileData.health <= 0 || partnerProfileData.hunger <= 0 || partnerProfileData.thirst <= 0 || partnerProfileData.hasCooldown === true || partnerProfileData.isResting === true) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: /** @type {`#${string}`} */ (error_color),
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: 'The mentioned user has no account, is passed out or busy :(',
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	/** @type {import('../../typedef').FriendsList} */
	const friendshipList = JSON.parse(readFileSync('./database/friendshipList.json', 'utf-8'));
	const friendshipKey = getFriendshipKey(friendshipList, profileData, partnerProfileData);
	const friendshipPoints = getFriendshipPoints(friendshipList[friendshipKey]?.[profileData.uuid], friendshipList[friendshipKey]?.[partnerProfileData.uuid]);
	const friendshipHearts = getFriendshipHearts(friendshipPoints);

	if (friendshipHearts < 6) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: /** @type {`#${string}`} */ (error_color),
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					title: `You and ${partnerProfileData.name} need at least 6 ❤️ to be able to adventure together!`,
					description: 'You gain ❤️ by mentioning and interacting with each other. To check your friendships, type `rp friendships`.',
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	let botReply = await message
		.reply({
			content: messageContent,
			embeds: [...embedArray, {
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} impatiently paces at the pack borders, hoping for ${partnerProfileData.name} to come and adventure with ${pronoun(profileData, 1)}.*`,
				footer: { text: 'After 60 seconds, the invitation expires.' },
			}],
			components: [ new MessageActionRow({
				components: [ new MessageButton({
					customId: 'adventure-confirm',
					label: 'Start adventure',
					emoji: '🧭',
					style: 'SUCCESS',
				})],
			})],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	const userInjuryObjectPlayer1 = { ...profileData.injuryObject };
	const userInjuryObjectPlayer2 = { ...partnerProfileData.injuryObject };

	const emptyField = '⬛';
	const memoryCardOptions = ['🌱', '🌿', '☘️', '🍀', '🍃', '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🍇', '🍊', '🫒', '🌰', '🏕️', '🌲', '🌳', '🍂', '🍁', '🍄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐁', '🦔', '🌵', '🦂', '🏜️', '🎍', '🪴', '🎋', '🪨', '🌾', '🐍', '🦎', '🐫', '🐙', '🦑', '🦀', '🐡', '🐠', '🐟', '🌊', '🐚', '🪨', '🪵', '🌴'];

	const memoryCardEmojis = [];
	for (let i = 0; i < 10; i++) {

		const chosenEmoji = memoryCardOptions.splice(generateRandomNumber(memoryCardOptions.length, 0), 1)[0];
		memoryCardEmojis.push(chosenEmoji, chosenEmoji);
	}

	const componentArray = [];
	const cardPositionsArray = [];
	for (let i = 0; i < 4; i++) {

		componentArray.push(new MessageActionRow({ components: [] }));
		cardPositionsArray.push([]);
		for (let j = 0; j < 5; j++) {

			componentArray[i].components.push(new MessageButton({
				customId: `board-${i}-${j}`,
				emoji: emptyField,
				disabled: false,
				style: 'SECONDARY',
			}));
			cardPositionsArray[i].push(...memoryCardEmojis.splice(generateRandomNumber(memoryCardEmojis.length, 0), 1));
		}
	}

	let rounds = 0;

	startNewRound(generateRandomNumber(2, 0) === 0 ? true : false, false, [null, null]);

	/**
	 *
	 * @param {boolean} isPartner
	 * @param {boolean} isFirstPick
	 * @param {Array<number>} lastPickPosition
	 */
	async function startNewRound(isPartner, isFirstPick, lastPickPosition) {

		createCommandCollector(message.author.id, message.guild.id, botReply);
		createCommandCollector(message.mentions.users.first().id, message.guild.id, botReply);

		const currentProfileData = (isPartner === true) ? partnerProfileData : profileData;
		const otherProfileData = (isPartner === true) ? profileData : partnerProfileData;

		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => (i.customId === 'adventure-confirm' && i.user.id === message.mentions.users.first().id) || (i.customId.includes('board') && i.user.id == currentProfileData.userId);

		const { customId } = await botReply
			.awaitMessageComponent({ filter, time: 60000 })
			.catch(() => { return { customId: '' }; });

		if (customId === '') {

			if (rounds === 0) {

				botReply = await botReply
					.edit({
						embeds: [...embedArray, {
							color: profileData.color,
							author: { name: profileData.name, icon_url: profileData.avatarURL },
							description: `*${partnerProfileData.name} seems to be busy and turns ${profileData.name} down.*`,
						}],
						components: disableAllComponents(botReply.components),
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
						return botReply;
					});
			}
			else {

				// const { embedFooterStatsTextPlayer1, embedFooterStatsTextPlayer2 } = await decreaseStats(message, profileData, partnerProfileData);

				botReply = await botReply
					.edit({
						embeds: [...embedArray, {
							color: profileData.color,
							author: { name: profileData.name, icon_url: profileData.avatarURL },
							description: `*${currentProfileData.name} takes so long with ${pronoun(currentProfileData, 2)} decision on how to attack that ${otherProfileData.name} gets impatient and leaves.*`,
							// footer: { text: `${embedFooterStatsTextPlayer1}\n\n${embedFooterStatsTextPlayer2}` },
						}],
						components: disableAllComponents(botReply.components),
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
						return botReply;
					});

				// await checkHealthAndLevel(message, botReply, profileData, serverData, partnerProfileData, userInjuryObjectPlayer1, userInjuryObjectPlayer2);
			}
			return;
		}

		rounds += 1;

		/** @type {number} */
		let column = null;
		/** @type {number} */
		let row = null;

		if (customId.includes('board')) {

			column = Number(customId.split('-', 2).pop());
			row = Number(customId.split('-').pop());

			/** @type {import('discord.js').MessageButton} */ (componentArray[column].components[row]).emoji.name = cardPositionsArray[column][row];
			componentArray[column].components[row].disabled = true;


			botReply = await botReply
				.edit({
					components: componentArray,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
					return botReply;
				});
		}

		if (!isFirstPick) {

			setTimeout(async () => {

				if (/** @type {import('discord.js').MessageButton} */ (componentArray[lastPickPosition[0]]?.components[lastPickPosition[1]])?.emoji?.name !== /** @type {import('discord.js').MessageButton} */ (componentArray[column]?.components[row])?.emoji?.name) {

					/** @type {import('discord.js').MessageButton} */ { (componentArray[lastPickPosition[0]].components[lastPickPosition[1]]).emoji.name = emptyField; }
					componentArray[lastPickPosition[0]].components[lastPickPosition[1]].disabled = false;

					/** @type {import('discord.js').MessageButton} */ (componentArray[column].components[row]).emoji.name = emptyField;
					componentArray[column].components[row].disabled = false;
				}

				await botReply
					.delete()
					.catch((error) => {
						throw new Error(error);
					});

				botReply = await message
					.reply({
						content: `<@${otherProfileData.userId}>` + (messageContent == null ? '' : messageContent),
						embeds: [...embedArray, {
							color: profileData.color,
							author: { name: profileData.name, icon_url: profileData.avatarURL },
							description: 'test',
						}],
						components: componentArray,
						failIfNotExists: false,
					})
					.catch((error) => { throw new Error(error); });

				// check here if all emojis have been uncovered, and if they were, then initate winning instead of new round
				// check here if else rounds === 20, and if so, then initiate losing instead of new round
				return await startNewRound(!isPartner, true, [null, null]);
			}, 3000);
		}
		else {

			return await startNewRound(isPartner, false, [column, row]);
		}
	}
};