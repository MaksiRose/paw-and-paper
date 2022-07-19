// @ts-check
const startCooldown = require('../../utils/startCooldown');
const { error_color, default_color } = require('../../../config.json');
const profileModel = require('../../models/profileModel');
const { generateRandomNumber, generateRandomNumberWithException, pullFromWeightedTable } = require('../../utils/randomizers');
const { hasCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid, isPassedOut } = require('../../utils/checkValidity');
const { decreaseHealth, decreaseThirst, decreaseHunger, decreaseEnergy } = require('../../utils/checkCondition');
const { checkLevelUp } = require('../../utils/levelHandling');
const { createCommandCollector } = require('../../utils/commandCollector');
const { remindOfAttack } = require('../gameplay_primary/attack');
const { pronoun, pronounAndPlural, upperCasePronounAndPlural } = require('../../utils/getPronouns');
const { restAdvice, drinkAdvice, eatAdvice } = require('../../utils/adviceMessages');
const { MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const disableAllComponents = require('../../utils/disableAllComponents');
const { addFriendshipPoints } = require('../../utils/friendshipHandling');
const isInGuild = require('../../utils/isInGuild');

module.exports.name = 'playfight';

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

	if (!isInGuild(message)) {

		return;
	}

	const characterData = userData?.characters?.[userData?.currentCharacter?.[message.guildId]];
	const profileData = characterData?.profiles?.[message.guildId];

	if (!hasCompletedAccount(message, characterData)) {

		return;
	}

	if (await isInvalid(message, userData, embedArray, [module.exports.name])) {

		return;
	}

	userData = await startCooldown(message);
	const messageContent = remindOfAttack(message);

	const firstMentionedUser = message.mentions.users.first();
	if (firstMentionedUser && firstMentionedUser.id == message.author.id) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `*${characterData.name} believes that ${pronounAndPlural(characterData, 0, 'is', 'are')} so unmatched that only ${pronoun(characterData, 0)} could defeat ${pronoun(characterData, 4)}. But it doesn't take ${pronoun(characterData, 1)} long to realize that it is more fun to fight a partner after all.*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if (!firstMentionedUser) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: /** @type {`#${string}`} */ (error_color),
					title: 'Please mention a user that you want to playfight with!',
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	const partnerUserData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: firstMentionedUser.id }));
	const partnerCharacterData = partnerUserData?.characters?.[partnerUserData?.currentCharacter?.[message.guildId]];
	const partnerProfileData = partnerCharacterData?.profiles?.[message.guildId];

	if (!partnerUserData || !partnerCharacterData || partnerCharacterData.name === '' || partnerCharacterData.species === '' || !partnerProfileData || partnerProfileData.energy <= 0 || partnerProfileData.health <= 0 || partnerProfileData.hunger <= 0 || partnerProfileData.thirst <= 0 || partnerProfileData.hasCooldown === true || partnerProfileData.isResting === true) {

		await message
			.reply({
				content: messageContent,
				embeds: [...embedArray, {
					color: /** @type {`#${string}`} */ (error_color),
					title: 'The mentioned user has no (selected) character, hasn\'t completed setting up their profile, is busy or is passed out :(',
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	let gameType = generateRandomNumber(2, 0) === 0 ? 'Connect Four' : 'Tic Tac Toe';

	if (argumentsArray.includes('connectfour') || argumentsArray.includes('c4')) {

		gameType = 'Connect Four';
	}

	if (argumentsArray.includes('tictactoe') || argumentsArray.includes('ttt')) {

		gameType = 'Tic Tac Toe';
	}

	const botReply = await message
		.reply({
			content: messageContent,
			embeds: [...embedArray, {
				color: characterData.color,
				author: { name: characterData.name, icon_url: characterData.avatarURL },
				description: `*${characterData.name} hangs around the prairie when ${partnerCharacterData.name} comes by. The ${partnerCharacterData.displayedSpecies || partnerCharacterData.species} has things to do but ${characterData.name}'s smug expression implies ${pronoun(partnerCharacterData, 0)} wouldn't be able to beat the ${characterData.displayedSpecies || characterData.species}.*`,
				footer: { text: `You are playing ${gameType}. After 60 seconds, the invitation expires.\n\nTip: To pick a game, include 'connectfour' / 'c4' or 'tictactoe' / 'ttt' somewhere in the original command.` },
			}],
			components: [new MessageActionRow({
				components: [new MessageButton({
					customId: `playfight-confirm-${gameType.split(' ').join('-').toLowerCase()}`,
					label: 'Accept challenge',
					emoji: '🎭',
					style: 'SUCCESS',
				})],
			})],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	const userInjuryObjectPlayer1 = { ...profileData.injuries };
	const userInjuryObjectPlayer2 = { ...partnerProfileData.injuries };

	if (gameType === 'Connect Four') {

		playConnectFour(serverData, userData, partnerUserData, message, botReply, embedArray, messageContent, userInjuryObjectPlayer1, userInjuryObjectPlayer2);
	}

	if (gameType === 'Tic Tac Toe') {

		playTicTacToe(serverData, userData, partnerUserData, message, botReply, embedArray, messageContent, userInjuryObjectPlayer1, userInjuryObjectPlayer2);
	}

};

/**
 * This starts a game of tic tac toe.
 * @param {import('../../typedef').ServerSchema} serverData
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {import('../../typedef').ProfileSchema} partnerUserData
 * @param {import('discord.js').Message<true>} message
 * @param {import('discord.js').Message} botReply
 * @param {Array<import('discord.js').MessageEmbed>} embedArray
 * @param {string | null} messageContent
 * @param {{wounds: number, infections: number, cold: boolean, sprains: number, poison: boolean}} userInjuryObjectPlayer1
 * @param {{wounds: number, infections: number, cold: boolean, sprains: number, poison: boolean}} userInjuryObjectPlayer2
 * @returns {void}
 */
function playTicTacToe(serverData, userData, partnerUserData, message, botReply, embedArray, messageContent, userInjuryObjectPlayer1, userInjuryObjectPlayer2) {

	const characterData = userData.characters[userData.currentCharacter[message.guildId]];
	const partnerCharacterData = partnerUserData.characters[partnerUserData.currentCharacter[message.guildId]];

	const emptyField = '◻️';
	const player1Field = '⭕';
	const player2Field = '❌';

	const componentArray = [
		new MessageActionRow({
			components: [new MessageButton({
				customId: 'board-1-1',
				emoji: emptyField,
				disabled: false,
				style: 'SECONDARY',
			}), new MessageButton({
				customId: 'board-1-2',
				emoji: emptyField,
				disabled: false,
				style: 'SECONDARY',
			}), new MessageButton({
				customId: 'board-1-3',
				emoji: emptyField,
				disabled: false,
				style: 'SECONDARY',
			})],
		}),
		new MessageActionRow({
			components: [new MessageButton({
				customId: 'board-2-1',
				emoji: emptyField,
				disabled: false,
				style: 'SECONDARY',
			}), new MessageButton({
				customId: 'board-2-2',
				emoji: emptyField,
				disabled: false,
				style: 'SECONDARY',
			}), new MessageButton({
				customId: 'board-2-3',
				emoji: emptyField,
				disabled: false,
				style: 'SECONDARY',
			})],
		}),
		new MessageActionRow({
			components: [new MessageButton({
				customId: 'board-3-1',
				emoji: emptyField,
				disabled: false,
				style: 'SECONDARY',
			}), new MessageButton({
				customId: 'board-3-2',
				emoji: emptyField,
				disabled: false,
				style: 'SECONDARY',
			}), new MessageButton({
				customId: 'board-3-3',
				emoji: emptyField,
				disabled: false,
				style: 'SECONDARY',
			})],
		}),
	];

	let newTurnEmbedTextArrayIndex = -1;

	startNewRound((generateRandomNumber(2, 0) == 0) ? true : false);

	/**
	 *
	 * @param {boolean} isPartner
	 * @returns
	 */
	async function startNewRound(isPartner) {

		createCommandCollector(message.author.id, message.guildId, botReply);
		// @ts-ignore, since mentioned user must exist
		createCommandCollector(message.mentions.users.first().id, message.guildId, botReply);

		const currentUserData = (isPartner == true) ? partnerUserData : userData;
		const currentCharacterData = currentUserData.characters[currentUserData.currentCharacter[message.guildId]];
		const otherUserData = (isPartner == true) ? userData : partnerUserData;
		const otherCharacterData = otherUserData.characters[otherUserData.currentCharacter[message.guildId]];

		// @ts-ignore, since mentioned user must exist
		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => (i.customId === 'playfight-confirm-tic-tac-toe' && i.user.id == message.mentions.users.first().id) || (i.customId.includes('board') && i.user.id == currentUserData.userId);

		const { customId } = await botReply
			.awaitMessageComponent({ filter, time: 120_000 })
			.catch(() => { return { customId: '' }; });

		let isEmptyBoard = true;
		forLoop: for (const columnArray of componentArray) {

			for (const rowArray of columnArray.components) {

				if (/** @type {import('discord.js').MessageButton} */ (rowArray).emoji?.name === player1Field || /** @type {import('discord.js').MessageButton} */ (rowArray).emoji?.name === player2Field) {

					isEmptyBoard = false;
					break forLoop;
				}
			}
		}

		if (customId === '') {

			if (isEmptyBoard) {

				botReply = await botReply
					.edit({
						embeds: [...embedArray, {
							color: /** @type {`#${string}`} */ (default_color),
							author: { name: characterData.name, icon_url: characterData.avatarURL },
							description: `*${characterData.name} wouldn't give in so easily and simply passes the pleading looks of the ${characterData.displayedSpecies || characterData.species}.*`,
						}],
						components: disableAllComponents(botReply.components),
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
						return botReply;
					});
			}
			else {

				const { embedFooterStatsTextPlayer1, embedFooterStatsTextPlayer2 } = await decreaseStats(message, userData, characterData.profiles[message.guildId], partnerUserData, partnerCharacterData.profiles[message.guildId]);

				botReply = await botReply
					.edit({
						embeds: [...embedArray, {
							color: characterData.color,
							author: { name: characterData.name, icon_url: characterData.avatarURL },
							description: `*${currentCharacterData.name} takes so long with ${pronoun(currentCharacterData, 2)} decision on how to attack that ${otherCharacterData.name} gets impatient and leaves.*`,
							footer: { text: `${embedFooterStatsTextPlayer1}\n\n${embedFooterStatsTextPlayer2}` },
						}],
						components: disableAllComponents(botReply.components),
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
						return botReply;
					});

				await checkHealthAndLevel(message, botReply, userData, serverData, partnerUserData, userInjuryObjectPlayer1, userInjuryObjectPlayer2);
			}

			return;
		}

		await botReply
			.delete()
			.catch((error) => {
				throw new Error(error);
			});

		if (customId.includes('board')) {

			const column = Number(customId.split('-', 2).pop()) - 1;
			const row = Number(customId.split('-').pop()) - 1;

			/** @type {import('discord.js').MessageButton} */ (componentArray[column].components[row]).setEmoji(isPartner ? player1Field : player2Field);
			componentArray[column].components[row].disabled = true;

			if (isWin()) {

				for (const columnArray of componentArray) {

					for (const rowArray of columnArray.components) {

						rowArray.disabled = true;
					}
				}

				await executeWin(componentArray, message, serverData, userData, partnerUserData, otherUserData, currentUserData, userInjuryObjectPlayer1, userInjuryObjectPlayer2, embedArray, botReply, messageContent);

				return;
			}

			if (isDraw()) {

				for (const columnArray of componentArray) {

					for (const rowArray of columnArray.components) {

						rowArray.disabled = true;
					}
				}

				await executeDraw(componentArray, message, serverData, userData, partnerUserData, embedArray, botReply, messageContent, userInjuryObjectPlayer1, userInjuryObjectPlayer2);

				return;
			}
		}

		const newTurnEmbedTextArray = [
			`*${currentCharacterData.name} bites into ${otherCharacterData.name}, not very deep, but deep enough to hang onto the ${otherCharacterData.displayedSpecies || otherCharacterData.species}. ${otherCharacterData.name} needs to get the ${currentCharacterData.displayedSpecies || currentCharacterData.species} off of ${pronoun(otherCharacterData, 1)}.*`,
			`*${currentCharacterData.name} slams into ${otherCharacterData.name}, leaving the ${otherCharacterData.displayedSpecies || otherCharacterData.species} disoriented. ${otherCharacterData.name} needs to start an attack of ${pronoun(otherCharacterData, 2)} own now.*`,
			`*${otherCharacterData.name} has gotten hold of ${currentCharacterData.name}, but the ${currentCharacterData.displayedSpecies || currentCharacterData.displayedSpecies} manages to get ${pronoun(otherCharacterData, 1)} off, sending the ${otherCharacterData.displayedSpecies || otherCharacterData.species} slamming into the ground. ${otherCharacterData.name} needs to get up and try a new strategy.*`,
		];

		newTurnEmbedTextArrayIndex = generateRandomNumberWithException(newTurnEmbedTextArray.length, 0, newTurnEmbedTextArrayIndex);

		botReply = await message
			.reply({
				content: `<@${otherUserData.userId}>` + (messageContent == null ? '' : messageContent),
				embeds: [...embedArray, {
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: newTurnEmbedTextArray[newTurnEmbedTextArrayIndex],
				}],
				components: componentArray,
				failIfNotExists: false,
			})
			.catch((error) => { throw new Error(error); });

		return await startNewRound(!isPartner);
	}

	/**
	 * Checks if the current wins.
	 * @returns {boolean}
	 */
	function isWin() {

		const diagonal_1_1 = /** @type {import('discord.js').MessageButton} */ (componentArray[1].components[1]).emoji?.name;

		const diagonal_0_0 = /** @type {import('discord.js').MessageButton} */ (componentArray[0].components[0]).emoji?.name;
		const diagonal_2_2 = /** @type {import('discord.js').MessageButton} */ (componentArray[2].components[2]).emoji?.name;

		const diagonal_0_2 = /** @type {import('discord.js').MessageButton} */ (componentArray[0].components[2]).emoji?.name;
		const diagonal_2_0 = /** @type {import('discord.js').MessageButton} */ (componentArray[2].components[0]).emoji?.name;

		if (diagonal_1_1 !== emptyField && ((diagonal_1_1 === diagonal_0_0 && diagonal_1_1 === diagonal_2_2) || (diagonal_1_1 === diagonal_0_2 && diagonal_1_1 === diagonal_2_0))) {

			return true;
		}

		for (const value of [0, 1, 2]) {

			const column_1 = /** @type {import('discord.js').MessageButton} */ (componentArray[value].components[0]).emoji?.name;
			const column_2 = /** @type {import('discord.js').MessageButton} */ (componentArray[value].components[1]).emoji?.name;
			const column_3 = /** @type {import('discord.js').MessageButton} */ (componentArray[value].components[2]).emoji?.name;

			const row_1 = /** @type {import('discord.js').MessageButton} */ (componentArray[0].components[value]).emoji?.name;
			const row_2 = /** @type {import('discord.js').MessageButton} */ (componentArray[1].components[value]).emoji?.name;
			const row_3 = /** @type {import('discord.js').MessageButton} */ (componentArray[2].components[value]).emoji?.name;

			if ((column_1 === column_2 && column_1 === column_3 && column_1 !== emptyField) || (row_1 === row_2 && row_1 === row_3 && row_1 !== emptyField)) {

				return true;
			}
		}

		return false;
	}

	/**
	 * Checks if the game ends in a draw.
	 * @returns {boolean}
	 */
	function isDraw() {

		for (const columnArray of componentArray) {

			for (const rowArray of columnArray.components) {

				if (/** @type {import('discord.js').MessageButton} */ (rowArray).emoji?.name === emptyField) {

					return false;
				}
			}
		}

		return true;
	}

	return;
}

/**
 * This starts a game of connect four.
 * @param {import('../../typedef').ServerSchema} serverData
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {import('../../typedef').ProfileSchema} partnerUserData
 * @param {import('discord.js').Message<true>} message
 * @param {import('discord.js').Message} botReply
 * @param {Array<import('discord.js').MessageEmbed>} embedArray
 * @param {string | null} messageContent
 * @param {{wounds: number, infections: number, cold: boolean, sprains: number, poison: boolean}} userInjuryObjectPlayer1
 * @param {{wounds: number, infections: number, cold: boolean, sprains: number, poison: boolean}} userInjuryObjectPlayer2
 * @returns {void}
 */
function playConnectFour(serverData, userData, partnerUserData, message, botReply, embedArray, messageContent, userInjuryObjectPlayer1, userInjuryObjectPlayer2) {

	const characterData = userData.characters[userData.currentCharacter[message.guildId]];
	const partnerCharacterData = partnerUserData.characters[partnerUserData.currentCharacter[message.guildId]];

	const emptyField = '⚫';
	const player1Field = '🟡';
	const player2Field = '🔴';

	const field = Array.from({ length: 6 }, () => Array.from({ length: 7 }, () => emptyField));


	const componentArray = [
		new MessageActionRow({
			components: [new MessageButton({
				customId: 'field-1',
				emoji: '1️⃣',
				disabled: false,
				style: 'SECONDARY',
			}), new MessageButton({
				customId: 'field-2',
				emoji: '2️⃣',
				disabled: false,
				style: 'SECONDARY',
			}), new MessageButton({
				customId: 'field-3',
				emoji: '3️⃣',
				disabled: false,
				style: 'SECONDARY',
			}), new MessageButton({
				customId: 'field-4',
				emoji: '4️⃣',
				disabled: false,
				style: 'SECONDARY',
			})],
		}),
		new MessageActionRow({
			components: [new MessageButton({
				customId: 'field-5',
				emoji: '5️⃣',
				disabled: false,
				style: 'SECONDARY',
			}), new MessageButton({
				customId: 'field-6',
				emoji: '6️⃣',
				disabled: false,
				style: 'SECONDARY',
			}), new MessageButton({
				customId: 'field-7',
				emoji: '7️⃣',
				disabled: false,
				style: 'SECONDARY',
			})],
		}),
	];

	let newTurnEmbedTextArrayIndex = -1;

	startNewRound((generateRandomNumber(2, 0) == 0) ? true : false);

	/**
	 *
	 * @param {boolean} isPartner
	 * @returns
	 */
	async function startNewRound(isPartner) {

		const currentUserData = (isPartner == true) ? partnerUserData : userData;
		const currentCharacterData = currentUserData.characters[currentUserData.currentCharacter[message.guildId]];
		const otherUserData = (isPartner == true) ? userData : partnerUserData;
		const otherCharacterData = otherUserData.characters[otherUserData.currentCharacter[message.guildId]];

		createCommandCollector(message.author.id, message.guildId, botReply);
		// @ts-ignore, since mentioned user must exist
		createCommandCollector(message.mentions.users.first().id, message.guildId, botReply);

		// @ts-ignore, since mentioned user must exist
		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => (i.customId === 'playfight-confirm-connect-four' && i.user.id === message.mentions.users.first().id) || (i.customId.includes('field') && i.user.id === currentUserData.userId);

		const { customId } = await botReply
			.awaitMessageComponent({ filter, time: 120_000 })
			.catch(() => { return { customId: '' }; });

		let isEmptyBoard = true;
		forLoop: for (let column = 0; column < field.length; column++) {

			for (let row = 0; row < field[column].length; row++) {

				if (field[column][row] === player1Field || field[column][row] === player2Field) {

					isEmptyBoard = false;
					break forLoop;
				}
			}
		}

		if (customId === '') {

			if (isEmptyBoard) {

				botReply = await botReply
					.edit({
						embeds: [...embedArray, {
							color: /** @type {`#${string}`} */ (default_color),
							author: { name: characterData.name, icon_url: characterData.avatarURL },
							description: `*${partnerCharacterData.name} wouldn't give in so easily and simply passes the pleading looks of the ${characterData.displayedSpecies || characterData.species}.*`,
						}],
						components: disableAllComponents(botReply.components),
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
						return botReply;
					});
			}
			else {

				const { embedFooterStatsTextPlayer1, embedFooterStatsTextPlayer2 } = await decreaseStats(message, userData, characterData.profiles[message.guildId], partnerUserData, partnerCharacterData.profiles[message.guildId]);

				botReply = await botReply
					.edit({
						embeds: [...embedArray, {
							color: characterData.color,
							author: { name: characterData.name, icon_url: characterData.avatarURL },
							description: `*${currentCharacterData.name} takes so long with ${pronoun(currentCharacterData, 2)} decision on how to attack that ${otherCharacterData.name} gets impatient and leaves.*`,
							footer: { text: `${embedFooterStatsTextPlayer1}\n\n${embedFooterStatsTextPlayer2}` },
						}],
						components: disableAllComponents(botReply.components),
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
						return botReply;
					});

				await checkHealthAndLevel(message, botReply, userData, serverData, partnerUserData, userInjuryObjectPlayer1, userInjuryObjectPlayer2);
			}

			return;
		}


		await botReply
			.delete()
			.catch((error) => {
				throw new Error(error);
			});

		if (customId.includes('field')) {

			let row = null;
			const column = Number(customId.split('-').pop()) - 1;

			for (let r = 5; r >= 0; r--) {

				if (field[r][column] === emptyField) {

					row = r;
					field[r][column] = (isPartner === true) ? player1Field : player2Field;

					if (r === 0) {

						componentArray[column <= 3 ? 0 : 1].components[column <= 3 ? column : column - 4].disabled = true;
					}

					break;
				}
			}

			if (row && isWin(field, row, column, true)) {

				await executeWin(undefined, message, serverData, userData, partnerUserData, otherUserData, currentUserData, userInjuryObjectPlayer1, userInjuryObjectPlayer2, [...embedArray, new MessageEmbed({ color: characterData.color, description: field.map(r => r.join('')).join('\n') })], botReply, messageContent);

				return;
			}

			if (isDraw(isPartner)) {

				await executeDraw(undefined, message, serverData, userData, partnerUserData, [...embedArray, new MessageEmbed({ color: characterData.color, description: field.map(r => r.join('')).join('\n') })], botReply, messageContent, userInjuryObjectPlayer1, userInjuryObjectPlayer2);

				return;
			}
		}

		const newTurnEmbedTextArray = [
			`*${currentCharacterData.name} bites into ${otherCharacterData.name}, not very deep, but deep enough to hang onto the ${otherCharacterData.displayedSpecies || otherCharacterData.species}. ${otherCharacterData.name} needs to get the ${currentCharacterData.displayedSpecies || currentCharacterData.species} off of ${pronoun(otherCharacterData, 1)}.*`,
			`*${currentCharacterData.name} slams into ${otherCharacterData.name}, leaving the ${otherCharacterData.displayedSpecies || otherCharacterData.species} disoriented. ${otherCharacterData.name} needs to start an attack of ${pronoun(otherCharacterData, 2)} own now.*`,
			`*${otherCharacterData.name} has gotten hold of ${currentCharacterData.name}, but the ${currentCharacterData.displayedSpecies || currentCharacterData.species} manages to get ${pronoun(otherCharacterData, 1)} off, sending the ${otherCharacterData.displayedSpecies || otherCharacterData.species} slamming into the ground. ${otherCharacterData.name} needs to get up and try a new strategy.*`,
		];

		newTurnEmbedTextArrayIndex = generateRandomNumberWithException(newTurnEmbedTextArray.length, 0, newTurnEmbedTextArrayIndex);

		botReply = await message
			.reply({
				content: `<@${otherUserData.userId}>` + (messageContent == null ? '' : messageContent),
				embeds: [...embedArray, {
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					description: `${newTurnEmbedTextArray[newTurnEmbedTextArrayIndex]}\n${field.map(row => row.join('')).join('\n')}\n1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣`,
				}],
				components: componentArray,
				failIfNotExists: false,
			})
			.catch((error) => { throw new Error(error); });

		return await startNewRound(!isPartner);
	}

	/**
	 *
	 * @param {Array<Array<string>>} actualField
	 * @param {number} row
	 * @param {number} column
	 * @param {boolean} isFinal
	 * @returns {boolean}
	 */
	function isWin(actualField, row, column, isFinal) {

		/** @type {Array<Array<string>>} */
		const testField = deepCopy(actualField);

		const coindropRow = testField[row];
		const rowCoords = [[row, 0], [row, 1], [row, 2], [row, 3], [row, 4], [row, 5], [row, 6]];

		const coindropColumn = [testField[0][column], testField[1][column], testField[2][column], testField[3][column], testField[4][column], testField[5][column]];
		const columnCoords = [[0, column], [1, column], [2, column], [3, column], [4, column], [5, column]];

		const coindropDiagonal1 = [];
		const diagonal1Coords = [];
		for (let r = row - column > 0 ? row - column : 0, c = column - row > 0 ? column - row : 0; r < 6 && c < 7; r++, c++) {

			coindropDiagonal1.push(testField[r][c]);
			diagonal1Coords.push([r, c]);
		}

		const coindropDiagonal2 = [];
		const diagonal2Coords = [];
		for (let r = row + column > 5 ? 5 : row + column, c = row + column < 5 ? 0 : row + column - 5; r >= 0 && c < 7; r--, c++) {

			coindropDiagonal2.push(testField[r][c]);
			diagonal2Coords.push([r, c]);
		}

		/**
		 * Checks if four of the same player emojis have been placed in a row.
		 * @param {Array<string>} array - An array of emojis
		 * @param {Array<Array<number>>} coordinatesArray - The coordinates for the above array.
		 * @returns {boolean}
		 */
		function hasFourInARow(array, coordinatesArray) {

			if (array.length < 4) {

				return false;
			}

			if (array[0] !== emptyField && array[0] === array[1] && array[0] === array[2] && array[0] === array[3]) {

				if (isFinal) {

					const replaceField = array[0] === player1Field ? '🟨' : '🟥';

					field[coordinatesArray[0][0]][coordinatesArray[0][1]] = replaceField;
					field[coordinatesArray[1][0]][coordinatesArray[1][1]] = replaceField;
					field[coordinatesArray[2][0]][coordinatesArray[2][1]] = replaceField;
					field[coordinatesArray[3][0]][coordinatesArray[3][1]] = replaceField;
				}

				return true;
			}

			array.shift();
			coordinatesArray.shift();
			return hasFourInARow(array, coordinatesArray);
		}

		if (hasFourInARow(coindropRow, rowCoords) === true || hasFourInARow(coindropColumn, columnCoords) === true || hasFourInARow(coindropDiagonal1, diagonal1Coords) === true || hasFourInARow(coindropDiagonal2, diagonal2Coords) === true) {

			return true;
		}

		return false;
	}

	/**
	 *
	 * @param {boolean} isPartner
	 * @returns {boolean}
	 */
	function isDraw(isPartner) {

		/** @type {Array<Array<string>>} */
		const temporaryField = deepCopy(field);

		for (let row = 0; row < temporaryField.length; row++) {

			for (let column = 0; column < 7; column++) {

				if (temporaryField[row][column] === emptyField) {

					temporaryField[row][column] = (isPartner === true) ? player2Field : player1Field;

					if (isWin(temporaryField, row, column, false) === true) {

						return false;
					}
				}
			}
		}

		return true;
	}

	return;
}

/**
 * Decreases both players thirst, hunger and energy, and returns the footer text.
 * @param {import('discord.js').Message<true>} message
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {import('../../typedef').Profile} profileData
 * @param {import('../../typedef').ProfileSchema} partnerUserData
 * @param {import('../../typedef').Profile} partnerProfileData
 * @returns {Promise<{ embedFooterStatsTextPlayer1: string, embedFooterStatsTextPlayer2: string }>}
 */
async function decreaseStats(message, userData, profileData, partnerUserData, partnerProfileData) {

	let embedFooterStatsTextPlayer1 = '';
	let embedFooterStatsTextPlayer2 = '';

	const thirstPointsPlayer1 = await decreaseThirst(profileData);
	const hungerPointsPlayer1 = await decreaseHunger(profileData);
	const energyPointsPlayer1 = function(energy) { return (profileData.energy - energy < 0) ? profileData.energy : energy; }(generateRandomNumber(5, 1) + await decreaseEnergy(profileData));

	userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
		{ userId: message.author.id },
		(/** @type {import('../../typedef').ProfileSchema} */ p) => {
			p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].energy -= energyPointsPlayer1;
			p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].hunger -= hungerPointsPlayer1;
			p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].thirst -= thirstPointsPlayer1;
			p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].currentRegion = 'prairie';
			p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].hasCooldown = false;
		},
	));
	const characterData = userData.characters[userData.currentCharacter[message.guildId]];
	profileData = characterData.profiles[message.guildId];

	embedFooterStatsTextPlayer1 = `-${energyPointsPlayer1} energy (${profileData.energy}/${profileData.maxEnergy}) for ${characterData.name}`;

	if (hungerPointsPlayer1 >= 1) {

		embedFooterStatsTextPlayer1 += `\n-${hungerPointsPlayer1} hunger (${profileData.hunger}/${profileData.maxHunger}) for ${characterData.name}`;
	}

	if (thirstPointsPlayer1 >= 1) {

		embedFooterStatsTextPlayer1 += `\n-${thirstPointsPlayer1} thirst (${profileData.thirst}/${profileData.maxThirst}) for ${characterData.name}`;
	}


	const thirstPointsPlayer2 = await decreaseThirst(partnerProfileData);
	const hungerPointsPlayer2 = await decreaseHunger(partnerProfileData);
	const energyPointsPlayer2 = function(energy) { return (partnerProfileData.energy - energy < 0) ? partnerProfileData.energy : energy; }(generateRandomNumber(5, 1) + await decreaseEnergy(partnerProfileData));

	partnerUserData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
		// @ts-ignore, since mentioned user must exist
		{ userId: message.mentions.users.first().id },
		(/** @type {import('../../typedef').ProfileSchema} */ p) => {
			p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].energy -= energyPointsPlayer2;
			p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].hunger -= hungerPointsPlayer2;
			p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].thirst -= thirstPointsPlayer2;
			p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].currentRegion = 'prairie';
			p.characters[p.currentCharacter[message.guildId]].profiles[message.guildId].hasCooldown = false;
		},
	));
	const partnerCharacterData = partnerUserData.characters[partnerUserData.currentCharacter[message.guildId]];
	partnerProfileData = partnerCharacterData.profiles[message.guildId];

	embedFooterStatsTextPlayer2 = `-${energyPointsPlayer2} energy (${partnerProfileData.energy}/${partnerProfileData.maxEnergy}) for ${partnerCharacterData.name}`;

	if (hungerPointsPlayer2 >= 1) {

		embedFooterStatsTextPlayer2 += `\n-${hungerPointsPlayer2} hunger (${partnerProfileData.hunger}/${partnerProfileData.maxHunger}) for ${partnerCharacterData.name}`;
	}

	if (thirstPointsPlayer2 >= 1) {

		embedFooterStatsTextPlayer2 += `\n-${thirstPointsPlayer2} thirst (${partnerProfileData.thirst}/${partnerProfileData.maxThirst}) for ${partnerCharacterData.name}`;
	}

	return { embedFooterStatsTextPlayer1, embedFooterStatsTextPlayer2 };
}

/**
 * Checks for both players whether to decrease their health, level them up, if they are passed out and if they need to be given any advice.
 * @param {import('discord.js').Message<true>} message
 * @param {import('discord.js').Message} botReply
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {import('../../typedef').ServerSchema} serverData
 * @param {import('../../typedef').ProfileSchema} partnerUserData
 * @param {{wounds: number, infections: number, cold: boolean, sprains: number, poison: boolean}} userInjuryObjectPlayer1
 * @param {{wounds: number, infections: number, cold: boolean, sprains: number, poison: boolean}} userInjuryObjectPlayer2
 */
async function checkHealthAndLevel(message, botReply, userData, serverData, partnerUserData, userInjuryObjectPlayer1, userInjuryObjectPlayer2) {

	botReply = await decreaseHealth(userData, botReply, userInjuryObjectPlayer1);
	botReply = await decreaseHealth(partnerUserData, botReply, userInjuryObjectPlayer2);

	botReply = await checkLevelUp(message, userData, serverData, botReply) || botReply;
	botReply = await checkLevelUp(message, partnerUserData, serverData, botReply) || botReply;

	await isPassedOut(message, userData.uuid, true);
	await isPassedOut(message, partnerUserData.uuid, true);

	await addFriendshipPoints(message, userData, userData.currentCharacter[message.guildId], partnerUserData, partnerUserData.currentCharacter[message.guildId]);

	await restAdvice(message, userData);
	await restAdvice(message, partnerUserData);

	await drinkAdvice(message, userData);
	await drinkAdvice(message, partnerUserData);

	await eatAdvice(message, userData);
	await eatAdvice(message, partnerUserData);
}

/**
 *
 * @param {undefined | Array<Required<import('discord.js').BaseMessageComponentOptions> & import('discord.js').MessageActionRowOptions>} componentArray
 * @param {import('discord.js').Message<true>} message
 * @param {import('../../typedef').ServerSchema} serverData
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {import('../../typedef').ProfileSchema} partnerUserData
 * @param {import('../../typedef').ProfileSchema} otherUserData
 * @param {import('../../typedef').ProfileSchema} currentUserData
 * @param {{wounds: number, infections: number, cold: boolean, sprains: number, poison: boolean}} userInjuryObjectPlayer1
 * @param {{wounds: number, infections: number, cold: boolean, sprains: number, poison: boolean}} userInjuryObjectPlayer2
 * @param {Array<import('discord.js').MessageEmbed>} embedArray
 * @param {import('discord.js').Message} botReply
 * @param {string | null} messageContent
 */
async function executeWin(componentArray, message, serverData, userData, partnerUserData, otherUserData, currentUserData, userInjuryObjectPlayer1, userInjuryObjectPlayer2, embedArray, botReply, messageContent) {

	const characterData = userData?.characters?.[userData?.currentCharacter?.[message.guildId]];
	const profileData = characterData?.profiles?.[message.guildId];
	const partnerCharacterData = partnerUserData?.characters?.[partnerUserData?.currentCharacter?.[message.guildId]];
	const partnerProfileData = partnerCharacterData?.profiles?.[message.guildId];

	let { embedFooterStatsTextPlayer1, embedFooterStatsTextPlayer2 } = await decreaseStats(message, userData, profileData, partnerUserData, partnerProfileData);

	let currentCharacterData = currentUserData?.characters?.[currentUserData?.currentCharacter?.[message.guildId]];
	let currentProfileData = currentCharacterData?.profiles?.[message.guildId];
	let otherCharacterData = otherUserData?.characters?.[otherUserData?.currentCharacter?.[message.guildId]];
	let otherProfileData = otherCharacterData?.profiles?.[message.guildId];

	const x = (otherProfileData.levels - currentProfileData.levels < 0) ? 0 : otherProfileData.levels - currentProfileData.levels;
	const extraExperience = Math.round((80 / (1 + Math.pow(Math.E, -0.09375 * x))) - 40);
	const experiencePoints = generateRandomNumber(11, 10) + extraExperience;

	if (currentUserData.userId === userData.userId) {

		embedFooterStatsTextPlayer1 = `+${experiencePoints} XP (${currentProfileData.experience + experiencePoints}/${currentProfileData.levels * 50}) for ${currentCharacterData.name}\n${embedFooterStatsTextPlayer1}`;
	}
	else {

		embedFooterStatsTextPlayer2 = `+${experiencePoints} XP (${currentProfileData.experience + experiencePoints}/${currentProfileData.levels * 50}) for ${currentCharacterData.name}\n${embedFooterStatsTextPlayer2}`;
	}

	currentUserData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
		{ userId: currentUserData.userId },
		(/** @type {import('../../typedef').ProfileSchema} */ p) => {
			p.characters[currentCharacterData._id].profiles[message.guildId].experience += experiencePoints;
		},
	));
	currentCharacterData = currentUserData?.characters?.[currentUserData?.currentCharacter?.[message.guildId]];
	currentProfileData = currentCharacterData?.profiles?.[message.guildId];

	let getHurtText = '';
	const getHurtChance = pullFromWeightedTable({ 0: 10, 1: 90 + otherProfileData.sapling.waterCycles });
	if (getHurtChance === 0) {

		let healthPoints = generateRandomNumber(5, 3);
		const userInjuryObject = (otherUserData.userId === userData.userId) ? { ...userInjuryObjectPlayer1 } : { ...userInjuryObjectPlayer2 };

		if (otherProfileData.health - healthPoints < 0) {

			healthPoints = otherProfileData.health;
		}

		otherUserData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
			{ userId: otherUserData.userId },
			(/** @type {import('../../typedef').ProfileSchema} */ p) => {
				p.characters[otherCharacterData._id].profiles[message.guildId].health -= healthPoints;
			},
		));
		otherCharacterData = otherUserData?.characters?.[otherUserData?.currentCharacter?.[message.guildId]];
		otherProfileData = otherCharacterData?.profiles?.[message.guildId];

		switch (pullFromWeightedTable({ 0: 1, 1: 1 })) {

			case 0:

				userInjuryObject.infections += 1;

				getHurtText += `*${otherCharacterData.name} has enjoyed the roughhousing, but ${pronounAndPlural(otherCharacterData, 0, 'is', 'are')} struck by exhaustion. After taking a short nap, ${pronounAndPlural(otherCharacterData, 0, 'notice')} the rash creeping along ${pronoun(otherCharacterData, 2)} back. Oh no! The ${otherCharacterData.displayedSpecies || otherCharacterData.species} has gotten an infection while playing!*`;

				if (otherUserData.userId === userData.userId) {

					embedFooterStatsTextPlayer1 = `-${healthPoints} HP (from infection)\n${embedFooterStatsTextPlayer1}`;
				}
				else {

					embedFooterStatsTextPlayer2 = `-${healthPoints} HP (from infection)\n${embedFooterStatsTextPlayer2}`;
				}

				break;

			default:

				userInjuryObject.sprains += 1;

				getHurtText += `*${otherCharacterData.name} tries to get up with ${currentCharacterData.name}'s help, but the ${otherCharacterData.displayedSpecies || otherCharacterData.species} feels a horrible pain as ${pronoun(otherCharacterData, 0)} get up. Ironically, ${otherCharacterData.name} got a sprain from getting up after the fight.*`;

				if (otherUserData.userId === userData.userId) {

					embedFooterStatsTextPlayer1 = `-${healthPoints} HP (from sprain)\n${embedFooterStatsTextPlayer1}`;
				}
				else {

					embedFooterStatsTextPlayer2 = `-${healthPoints} HP (from sprain)\n${embedFooterStatsTextPlayer2}`;
				}
		}

		userInjuryObjectPlayer1 = (otherUserData.userId === userData.userId) ? userInjuryObject : userInjuryObjectPlayer1;
		userInjuryObjectPlayer2 = (otherUserData.userId === userData.userId) ? userInjuryObjectPlayer2 : userInjuryObject;
	}

	botReply = await message
		.reply({
			content: messageContent,
			embeds: [...embedArray, {
				color: characterData.color,
				author: { name: characterData.name, icon_url: characterData.avatarURL },
				description: `*The two animals are pressing against each other with all their might. It seems like the fight will never end this way, but ${currentCharacterData.name} has one more trick up ${pronoun(currentCharacterData, 2)} sleeve: ${pronoun(currentCharacterData, 0)} simply moves out of the way, letting ${otherCharacterData.name} crash into the ground. ${upperCasePronounAndPlural(otherCharacterData, 0, 'has', 'have')} a wry grin on ${pronoun(otherCharacterData, 2)} face as ${pronounAndPlural(otherCharacterData, 0, 'look')} up at the ${currentCharacterData.displayedSpecies || currentCharacterData.species}. ${currentCharacterData.name} wins this fight, but who knows about the next one?*\n\n${getHurtText}`,
				footer: { text: `${embedFooterStatsTextPlayer1}\n\n${embedFooterStatsTextPlayer2}` },
			}],
			components: componentArray,
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	await checkHealthAndLevel(message, botReply, userData, serverData, partnerUserData, userInjuryObjectPlayer1, userInjuryObjectPlayer2);
}

/**
 *
 * @param {undefined | Array<Required<import('discord.js').BaseMessageComponentOptions> & import('discord.js').MessageActionRowOptions>} componentArray
 * @param {import('discord.js').Message<true>} message
 * @param {import('../../typedef').ServerSchema} serverData
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {import('../../typedef').ProfileSchema} partnerUserData
 * @param {Array<import('discord.js').MessageEmbed>} embedArray
 * @param {import('discord.js').Message} botReply
 * @param {{wounds: number, infections: number, cold: boolean, sprains: number, poison: boolean}} userInjuryObjectPlayer1
 * @param {{wounds: number, infections: number, cold: boolean, sprains: number, poison: boolean}} userInjuryObjectPlayer2
 * @param {string | null} messageContent
 */
async function executeDraw(componentArray, message, serverData, userData, partnerUserData, embedArray, botReply, messageContent, userInjuryObjectPlayer1, userInjuryObjectPlayer2) {

	const characterData = userData?.characters?.[userData?.currentCharacter?.[message.guildId]];
	const profileData = characterData?.profiles?.[message.guildId];
	const partnerCharacterData = partnerUserData?.characters?.[partnerUserData?.currentCharacter?.[message.guildId]];
	const partnerProfileData = partnerCharacterData?.profiles?.[message.guildId];

	let { embedFooterStatsTextPlayer1, embedFooterStatsTextPlayer2 } = await decreaseStats(message, userData, profileData, partnerUserData, partnerProfileData);

	const experiencePoints = generateRandomNumber(11, 5);

	embedFooterStatsTextPlayer1 = `+${experiencePoints} XP (${profileData.experience + experiencePoints}/${profileData.levels * 50}) for ${characterData.name}\n${embedFooterStatsTextPlayer1}`;
	embedFooterStatsTextPlayer2 = `+${experiencePoints} XP (${partnerProfileData.experience + experiencePoints}/${partnerProfileData.levels * 50}) for ${partnerCharacterData.name}\n${embedFooterStatsTextPlayer2}`;

	userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
		{ userId: message.author.id },
		(/** @type {import('../../typedef').ProfileSchema} */ p) => {
			p.characters[characterData._id].profiles[message.guildId].experience += experiencePoints;
		},
	));

	partnerUserData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
		// @ts-ignore, since mentioned user must exist
		{ userId: message.mentions.users.first().id },
		(/** @type {import('../../typedef').ProfileSchema} */ p) => {
			p.characters[partnerCharacterData._id].profiles[message.guildId].experience += experiencePoints;
		},
	));

	botReply = await message
		.reply({
			content: messageContent,
			embeds: [...embedArray, {
				color: characterData.color,
				author: { name: characterData.name, icon_url: characterData.avatarURL },
				description: `*The two animals wrestle with each other until ${characterData.name} falls over the ${partnerCharacterData.displayedSpecies || partnerCharacterData.displayedSpecies || partnerCharacterData.species} and both of them land on the ground. They pant and glare at each other, but ${partnerCharacterData.name} can't contain ${pronoun(partnerCharacterData, 2)} laughter. The ${characterData.displayedSpecies || characterData.species} starts to giggle as well. The fight has been fun, even though no one won.*`,
				footer: { text: `${embedFooterStatsTextPlayer1}\n\n${embedFooterStatsTextPlayer2}` },
			}],
			components: componentArray,
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	await checkHealthAndLevel(message, botReply, userData, serverData, partnerUserData, userInjuryObjectPlayer1, userInjuryObjectPlayer2);
}

/**
 *
 * @param {any} obj
 * @returns {any}
 */
function deepCopy(obj) {

	if (Array.isArray(obj)) {

		return obj.map(deepCopy);
	}

	return obj;
}