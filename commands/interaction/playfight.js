const startCooldown = require('../../utils/startCooldown');
const config = require('../../config.json');
const profileModel = require('../../models/profileModel');
const { generateRandomNumber, generateRandomNumberWithException, pullFromWeightedTable } = require('../../utils/randomizers');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isInvalid, isPassedOut } = require('../../utils/checkValidity');
const { decreaseHealth, decreaseThirst, decreaseHunger, decreaseEnergy } = require('../../utils/checkCondition');
const { checkLevelUp } = require('../../utils/levelHandling');
const { createCommandCollector } = require('../../utils/commandCollector');
const { remindOfAttack } = require('../gameplay/attack');
const { pronoun, pronounAndPlural, upperCasePronounAndPlural } = require('../../utils/getPronouns');
const { restAdvice, drinkAdvice, eatAdvice } = require('../../utils/adviceMessages');

module.exports = {
	name: 'playfight',
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

		if (await hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await isInvalid(message, profileData, embedArray, [module.exports.name])) {

			return;
		}

		profileData = await startCooldown(message, profileData);
		const messageContent = remindOfAttack(message);

		if (message.mentions.users.size > 0 && message.mentions.users.first().id == message.author.id) {

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} believes that ${pronounAndPlural(profileData, 0, 'is', 'are')} so unmatched that only ${pronoun(profileData, 0)} could defeat ${pronoun(profileData, 4)}. But it doesn't take ${pronoun(profileData, 1)} long to realize that it is more fun to fight a partner after all.*`,
			});

			return await message
				.reply({
					content: messageContent,
					embeds: embedArray,
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		if (!message.mentions.users.size) {

			embedArray.push({
				color: config.error_color,
				author: { name: message.guild.name, icon_url: message.guild.iconURL() },
				title: 'Please mention a user that you want to playfight with!',
			});

			return await message
				.reply({
					content: messageContent,
					embeds: embedArray,
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		const partnerProfileData = await profileModel.findOne({
			userId: message.mentions.users.first().id,
			serverId: message.guild.id,
		});

		if (!partnerProfileData || partnerProfileData.name == '' || partnerProfileData.species == '' || partnerProfileData.energy <= 0 || partnerProfileData.health <= 0 || partnerProfileData.hunger <= 0 || partnerProfileData.thirst <= 0 || partnerProfileData.hasCooldown == true) {

			embedArray.push({
				color: config.error_color,
				author: { name: message.guild.name, icon_url: message.guild.iconURL() },
				title: 'The mentioned user has no account, is passed out or busy :(',
			});

			return await message
				.reply({
					content: messageContent,
					embeds: embedArray,
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus != 404) {
						throw new Error(error);
					}
				});
		}

		let gameType = generateRandomNumber(2, 0) === 0 ? 'Connect Four' : 'Tic Tac Toe';

		if (argumentsArray.includes('connectfour') || argumentsArray.includes('c4')) {

			gameType = 'Connect Four';
		}

		if (argumentsArray.includes('tictactoe') || argumentsArray.includes('ttt')) {

			gameType = 'Tic Tac Toe';
		}

		embedArray.push({
			color: profileData.color,
			author: { name: profileData.name, icon_url: profileData.avatarURL },
			description: `*${profileData.name} hangs around the prairie when ${partnerProfileData.name} comes by. The ${partnerProfileData.species} has things to do but ${profileData.name}'s smug expression implies ${pronoun(partnerProfileData, 0)} wouldn't be able to beat the ${profileData.species}.*`,
			footer: { text: `You are playing ${gameType}. After 30 seconds, the invitation expires.\n\nTip: To pick a game, include 'connectfour' / 'c4' or 'tictactoe' / 'ttt' somewhere in the original command.` },
		});

		const botReply = await message
			.reply({
				content: messageContent,
				embeds: embedArray,
				components: [{
					type: 'ACTION_ROW',
					components: [{
						type: 'BUTTON',
						customId: `playfight-confirm-${gameType.split(' ').join('-').toLowerCase()}`,
						label: 'Accept challenge',
						emoji: { name: '🎭' },
						style: 'SUCCESS',
					}],
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		const userInjuryObjectPlayer1 = { ...profileData.injuryObject };
		const userInjuryObjectPlayer2 = { ...partnerProfileData.injuryObject };

		if (gameType === 'Connect Four') {

			playConnectFour(serverData, profileData, partnerProfileData, message, botReply, embedArray, messageContent, userInjuryObjectPlayer1, userInjuryObjectPlayer2);
		}

		if (gameType === 'Tic Tac Toe') {

			playTicTacToe(serverData, profileData, partnerProfileData, message, botReply, embedArray, messageContent, userInjuryObjectPlayer1, userInjuryObjectPlayer2);
		}

	},
};

function playTicTacToe(serverData, profileData, partnerProfileData, message, botReply, embedArray, messageContent, userInjuryObjectPlayer1, userInjuryObjectPlayer2) {

	const emptyField = '◻️';
	const player1Field = '⭕';
	const player2Field = '❌';

	const componentArray = [
		{
			type: 'ACTION_ROW',
			components: [{
				type: 'BUTTON',
				customId: 'board-1-1',
				emoji: { name: emptyField },
				disabled: false,
				style: 'SECONDARY',
			}, {
				type: 'BUTTON',
				customId: 'board-1-2',
				emoji: { name: emptyField },
				disabled: false,
				style: 'SECONDARY',
			}, {
				type: 'BUTTON',
				customId: 'board-1-3',
				emoji: { name: emptyField },
				disabled: false,
				style: 'SECONDARY',
			}],
		},
		{
			type: 'ACTION_ROW',
			components: [{
				type: 'BUTTON',
				customId: 'board-2-1',
				emoji: { name: emptyField },
				disabled: false,
				style: 'SECONDARY',
			}, {
				type: 'BUTTON',
				customId: 'board-2-2',
				emoji: { name: emptyField },
				disabled: false,
				style: 'SECONDARY',
			}, {
				type: 'BUTTON',
				customId: 'board-2-3',
				emoji: { name: emptyField },
				disabled: false,
				style: 'SECONDARY',
			}],
		},
		{
			type: 'ACTION_ROW',
			components: [{
				type: 'BUTTON',
				customId: 'board-3-1',
				emoji: { name: emptyField },
				disabled: false,
				style: 'SECONDARY',
			}, {
				type: 'BUTTON',
				customId: 'board-3-2',
				emoji: { name: emptyField },
				disabled: false,
				style: 'SECONDARY',
			}, {
				type: 'BUTTON',
				customId: 'board-3-3',
				emoji: { name: emptyField },
				disabled: false,
				style: 'SECONDARY',
			}],
		},
	];

	let newTurnEmbedTextArrayIndex = -1;

	startNewRound((generateRandomNumber(2, 0) == 0) ? true : false);

	async function startNewRound(isPartner) {

		createCommandCollector(message.author.id, message.guild.id, botReply);
		createCommandCollector(message.mentions.users.first().id, message.guild.id, botReply);

		const currentProfileData = (isPartner == true) ? partnerProfileData : profileData;
		const otherProfileData = (isPartner == true) ? profileData : partnerProfileData;

		const filter = i => (i.customId === 'playfight-confirm-tic-tac-toe' && i.user.id == message.mentions.users.first().id) || (i.customId.includes('board') && i.user.id == currentProfileData.userId);

		const interaction = await botReply
			.awaitMessageComponent({ filter, time: 30000 })
			.catch(() => { return null; });

		let isEmptyBoard = true;
		forLoop: for (const columnArray of componentArray) {

			for (const rowArray of columnArray.components) {

				if (rowArray.emoji.name === player1Field || rowArray.emoji.name === player2Field) {

					isEmptyBoard = false;
					break forLoop;
				}
			}
		}

		embedArray.splice(-1, 1);

		if (interaction === null) {

			if (isEmptyBoard) {

				// text for when the match didnt start
				embedArray.push({
					color: config.default_color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `*${partnerProfileData.name} wouldn't give in so easily and simply passes the pleading looks of the ${profileData.species}.*`,
				});

				botReply = await botReply
					.edit({
						embeds: embedArray,
						components: [],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}
			else {

				const { embedFooterStatsTextPlayer1, embedFooterStatsTextPlayer2 } = await decreaseStats(message, profileData, partnerProfileData);

				// text for when the match was abandoned
				embedArray.push({
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `*${currentProfileData.name} takes so long with ${pronoun(currentProfileData, 2)} decision on how to attack that ${otherProfileData.name} gets impatient and leaves.*`,
					footer: { text: `${embedFooterStatsTextPlayer1}\n\n${embedFooterStatsTextPlayer2}` },
				});

				botReply = await botReply
					.edit({
						embeds: embedArray,
						components: [],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				await checkHealthAndLevel(message, botReply, profileData, serverData, partnerProfileData, userInjuryObjectPlayer1, userInjuryObjectPlayer2);
			}

			return;
		}

		await botReply
			.delete()
			.catch((error) => {
				throw new Error(error);
			});

		if (interaction.customId.includes('board')) {

			const column = interaction.customId.split('-', 2).pop() - 1;
			const row = interaction.customId.split('-').pop() - 1;

			componentArray[column].components[row].emoji.name = (isPartner == true) ? player1Field : player2Field;
			componentArray[column].components[row].disabled = true;

			if (isWin()) {

				for (const columnArray of componentArray) {

					for (const rowArray of columnArray.components) {

						rowArray.disabled = true;
					}
				}

				await executeWin(componentArray, message, profileData, serverData, partnerProfileData, otherProfileData, currentProfileData, userInjuryObjectPlayer1, userInjuryObjectPlayer2, embedArray, botReply, messageContent);

				return;
			}

			if (isDraw()) {

				for (const columnArray of componentArray) {

					for (const rowArray of columnArray.components) {

						rowArray.disabled = true;
					}
				}

				await executeDraw(componentArray, message, profileData, serverData, partnerProfileData, embedArray, botReply, messageContent, userInjuryObjectPlayer1, userInjuryObjectPlayer2);

				return;
			}
		}

		const newTurnEmbedTextArray = [
			`*${currentProfileData.name} bites into ${otherProfileData.name}, not very deep, but deep enough to hang onto the ${otherProfileData.species}. ${otherProfileData.name} needs to get the ${currentProfileData.species} off of ${pronoun(otherProfileData, 1)}.*`,
			`*${currentProfileData.name} slams into ${otherProfileData.name}, leaving the ${otherProfileData.species} disoriented. ${otherProfileData.name} needs to start an attack of ${pronoun(otherProfileData, 2)} own now.*`,
			`*${otherProfileData.name} has gotten hold of ${currentProfileData.name}, but the ${currentProfileData.species} manages to get ${pronoun(otherProfileData, 1)} off, sending the ${otherProfileData.species} slamming into the ground. ${otherProfileData.name} needs to get up and try a new strategy.*`,
		];

		newTurnEmbedTextArrayIndex = generateRandomNumberWithException(newTurnEmbedTextArray.length, 0, newTurnEmbedTextArrayIndex);

		embedArray.push({
			color: profileData.color,
			author: { name: profileData.name, icon_url: profileData.avatarURL },
			description: newTurnEmbedTextArray[newTurnEmbedTextArrayIndex],
		});

		botReply = await message
			.reply({
				content: `<@${otherProfileData.userId}>` + (messageContent == null ? '' : messageContent),
				embeds: embedArray,
				components: componentArray,
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		return await startNewRound(!isPartner);
	}

	function isWin() {

		const diagonal_1_1 = componentArray[1].components[1].emoji.name;

		const diagonal_0_0 = componentArray[0].components[0].emoji.name;
		const diagonal_2_2 = componentArray[2].components[2].emoji.name;

		const diagonal_0_2 = componentArray[0].components[2].emoji.name;
		const diagonal_2_0 = componentArray[2].components[0].emoji.name;

		if (diagonal_1_1 !== emptyField && ((diagonal_1_1 === diagonal_0_0 && diagonal_1_1 === diagonal_2_2) || (diagonal_1_1 === diagonal_0_2 && diagonal_1_1 === diagonal_2_0))) {

			return true;
		}

		for (const value of [0, 1, 2]) {

			const column_1 = componentArray[value].components[0].emoji.name;
			const column_2 = componentArray[value].components[1].emoji.name;
			const column_3 = componentArray[value].components[2].emoji.name;

			const row_1 = componentArray[0].components[value].emoji.name;
			const row_2 = componentArray[1].components[value].emoji.name;
			const row_3 = componentArray[2].components[value].emoji.name;

			if ((column_1 === column_2 && column_1 === column_3 && column_1 !== emptyField) || (row_1 === row_2 && row_1 === row_3 && row_1 !== emptyField)) {

				return true;
			}
		}

		return false;
	}

	function isDraw() {

		for (const columnArray of componentArray) {

			for (const rowArray of columnArray.components) {

				if (rowArray.emoji.name === emptyField) {

					return false;
				}
			}
		}

		return true;
	}

	return { profileData, partnerProfileData, botReply };
}

async function playConnectFour(serverData, profileData, partnerProfileData, message, botReply, embedArray, messageContent, userInjuryObjectPlayer1, userInjuryObjectPlayer2) {

	const emptyField = '⚫';
	const player1Field = '🟡';
	const player2Field = '🔴';

	const field = Array.from({ length: 6 }, () => Array.from({ length: 7 }, () => emptyField));


	const componentArray = [
		{
			type: 'ACTION_ROW',
			components: [{
				type: 'BUTTON',
				customId: 'field-1',
				emoji: { name: '1️⃣' },
				disabled: false,
				style: 'SECONDARY',
			}, {
				type: 'BUTTON',
				customId: 'field-2',
				emoji: { name: '2️⃣' },
				disabled: false,
				style: 'SECONDARY',
			}, {
				type: 'BUTTON',
				customId: 'field-3',
				emoji: { name: '3️⃣' },
				disabled: false,
				style: 'SECONDARY',
			}, {
				type: 'BUTTON',
				customId: 'field-4',
				emoji: { name: '4️⃣' },
				disabled: false,
				style: 'SECONDARY',
			}],
		},
		{
			type: 'ACTION_ROW',
			components: [{
				type: 'BUTTON',
				customId: 'field-5',
				emoji: { name: '5️⃣' },
				disabled: false,
				style: 'SECONDARY',
			}, {
				type: 'BUTTON',
				customId: 'field-6',
				emoji: { name: '6️⃣' },
				disabled: false,
				style: 'SECONDARY',
			}, {
				type: 'BUTTON',
				customId: 'field-7',
				emoji: { name: '7️⃣' },
				disabled: false,
				style: 'SECONDARY',
			}],
		},
	];

	let newTurnEmbedTextArrayIndex = -1;

	startNewRound((generateRandomNumber(2, 0) == 0) ? true : false);

	async function startNewRound(isPartner) {

		const currentProfileData = (isPartner == true) ? partnerProfileData : profileData;
		const otherProfileData = (isPartner == true) ? profileData : partnerProfileData;

		createCommandCollector(message.author.id, message.guild.id, botReply);
		createCommandCollector(message.mentions.users.first().id, message.guild.id, botReply);

		const filter = i => (i.customId === 'playfight-confirm-connect-four' && i.user.id == message.mentions.users.first().id) || (i.customId.includes('field') && i.user.id == currentProfileData.userId);

		const interaction = await botReply
			.awaitMessageComponent({ filter, time: 30000 })
			.catch(() => { return null; });

		let isEmptyBoard = true;
		forLoop: for (let column = 0; column < field.length; column++) {

			for (let row = 0; row < field[column].length; row++) {

				if (field[column][row] === player1Field || field[column][row] === player2Field) {

					isEmptyBoard = false;
					break forLoop;
				}
			}
		}

		embedArray.splice(-1, 1);

		if (interaction === null) {

			if (isEmptyBoard) {

				// text for when the match didnt start
				embedArray.push({
					color: config.default_color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `*${partnerProfileData.name} wouldn't give in so easily and simply passes the pleading looks of the ${profileData.species}.*`,
				});

				botReply = await botReply
					.edit({
						embeds: embedArray,
						components: [],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}
			else {

				const { embedFooterStatsTextPlayer1, embedFooterStatsTextPlayer2 } = await decreaseStats(message, profileData, partnerProfileData);

				// text for when the match was abandoned
				embedArray.push({
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `*${currentProfileData.name} takes so long with ${pronoun(currentProfileData, 2)} decision on how to attack that ${otherProfileData.name} gets impatient and leaves.*`,
					footer: { text: `${embedFooterStatsTextPlayer1}\n\n${embedFooterStatsTextPlayer2}` },
				});

				botReply = await botReply
					.edit({
						embeds: embedArray,
						components: [],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				await checkHealthAndLevel(message, botReply, profileData, serverData, partnerProfileData, userInjuryObjectPlayer1, userInjuryObjectPlayer2);
			}

			return;
		}


		await botReply
			.delete()
			.catch((error) => {
				throw new Error(error);
			});

		if (interaction.customId.includes('field')) {

			let row = null;
			const column = interaction.customId.split('-').pop() - 1;

			for (let r = 5; r >= 0; r--) {

				if (field[r][column] === emptyField) {

					row = r;
					field[r][column] = (isPartner === true) ? player1Field : player2Field;

					if (r === 0) {

						componentArray[column < 4 ? 0 : 1].components[column].disabled = true;
					}

					break;
				}
			}

			if (isWin(field, row, column, true) === true) {

				embedArray.push({
					color: profileData.color,
					description: field.map(r => r.join('')).join('\n'),
				});

				await executeWin(null, message, profileData, serverData, partnerProfileData, otherProfileData, currentProfileData, userInjuryObjectPlayer1, userInjuryObjectPlayer2, embedArray, botReply, messageContent);

				return;
			}

			if (isDraw(isPartner) === true) {

				embedArray.push({
					color: profileData.color,
					description: field.map(r => r.join('')).join('\n'),
				});

				await executeDraw(null, message, profileData, serverData, partnerProfileData, embedArray, botReply, messageContent, userInjuryObjectPlayer1, userInjuryObjectPlayer2);

				return;
			}
		}

		const newTurnEmbedTextArray = [
			`*${currentProfileData.name} bites into ${otherProfileData.name}, not very deep, but deep enough to hang onto the ${otherProfileData.species}. ${otherProfileData.name} needs to get the ${currentProfileData.species} off of ${pronoun(otherProfileData, 1)}.*`,
			`*${currentProfileData.name} slams into ${otherProfileData.name}, leaving the ${otherProfileData.species} disoriented. ${otherProfileData.name} needs to start an attack of ${pronoun(otherProfileData, 2)} own now.*`,
			`*${otherProfileData.name} has gotten hold of ${currentProfileData.name}, but the ${currentProfileData.species} manages to get ${pronoun(otherProfileData, 1)} off, sending the ${otherProfileData.species} slamming into the ground. ${otherProfileData.name} needs to get up and try a new strategy.*`,
		];

		newTurnEmbedTextArrayIndex = generateRandomNumberWithException(newTurnEmbedTextArray.length, 0, newTurnEmbedTextArrayIndex);

		embedArray.push({
			color: profileData.color,
			author: { name: profileData.name, icon_url: profileData.avatarURL },
			description: `${newTurnEmbedTextArray[newTurnEmbedTextArrayIndex]}\n${field.map(row => row.join('')).join('\n')}\n1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣`,
		});

		botReply = await message
			.reply({
				content: `<@${otherProfileData.userId}>` + (messageContent == null ? '' : messageContent),
				embeds: embedArray,
				components: componentArray,
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		return await startNewRound(!isPartner);
	}

	function isWin(actualField, row, column, isFinal) {

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
			return hasFourInARow(array);
		}

		if (hasFourInARow(coindropRow, rowCoords) === true || hasFourInARow(coindropColumn, columnCoords) === true || hasFourInARow(coindropDiagonal1, diagonal1Coords) === true || hasFourInARow(coindropDiagonal2, diagonal2Coords) === true) {

			return true;
		}

		return false;
	}

	function isDraw(isPartner) {

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

	return { profileData, partnerProfileData, botReply };
}

async function decreaseStats(message, profileData, partnerProfileData) {

	let embedFooterStatsTextPlayer1 = '';
	let embedFooterStatsTextPlayer2 = '';

	const thirstPointsPlayer1 = await decreaseThirst(profileData);
	const hungerPointsPlayer1 = await decreaseHunger(profileData);
	const extraLostEnergyPointsPlayer1 = await decreaseEnergy(profileData);
	let energyPointsPlayer1 = generateRandomNumber(5, 1) + extraLostEnergyPointsPlayer1;

	if (profileData.energy - energyPointsPlayer1 < 0) {

		energyPointsPlayer1 = profileData.energy;
	}

	profileData = await profileModel.findOneAndUpdate(
		{ userId: message.author.id, serverId: message.guild.id },
		{
			$inc: {
				energy: -energyPointsPlayer1,
				hunger: -hungerPointsPlayer1,
				thirst: -thirstPointsPlayer1,
			},
			$set: {
				currentRegion: 'prairie',
				hasCooldown: false,
			},
		},
		{ new: true },
	);

	embedFooterStatsTextPlayer1 = `-${energyPointsPlayer1} energy (${profileData.energy}/${profileData.maxEnergy}) for ${profileData.name}`;

	if (hungerPointsPlayer1 >= 1) {

		embedFooterStatsTextPlayer1 += `\n-${hungerPointsPlayer1} hunger (${profileData.hunger}/${profileData.maxHunger}) for ${profileData.name}`;
	}

	if (thirstPointsPlayer1 >= 1) {

		embedFooterStatsTextPlayer1 += `\n-${thirstPointsPlayer1} thirst (${profileData.thirst}/${profileData.maxThirst}) for ${profileData.name}`;
	}


	const thirstPointsPlayer2 = await decreaseThirst(partnerProfileData);
	const hungerPointsPlayer2 = await decreaseHunger(partnerProfileData);
	const extraLostEnergyPointsPlayer2 = await decreaseEnergy(partnerProfileData);
	let energyPointsPlayer2 = generateRandomNumber(5, 1) + extraLostEnergyPointsPlayer2;

	if (partnerProfileData.energy - energyPointsPlayer2 < 0) {

		energyPointsPlayer2 = partnerProfileData.energy;
	}

	partnerProfileData = await profileModel.findOneAndUpdate(
		{ userId: message.mentions.users.first().id, serverId: message.guild.id },
		{
			$inc: {
				energy: -energyPointsPlayer2,
				hunger: -hungerPointsPlayer2,
				thirst: -thirstPointsPlayer2,
			},
			$set: {
				currentRegion: 'prairie',
				hasCooldown: false,
			},
		},
		{ new: true },
	);

	embedFooterStatsTextPlayer2 = `-${energyPointsPlayer2} energy (${partnerProfileData.energy}/${partnerProfileData.maxEnergy}) for ${partnerProfileData.name}`;

	if (hungerPointsPlayer2 >= 1) {

		embedFooterStatsTextPlayer2 += `\n-${hungerPointsPlayer2} hunger (${partnerProfileData.hunger}/${partnerProfileData.maxHunger}) for ${partnerProfileData.name}`;
	}

	if (thirstPointsPlayer2 >= 1) {

		embedFooterStatsTextPlayer2 += `\n-${thirstPointsPlayer2} thirst (${partnerProfileData.thirst}/${partnerProfileData.maxThirst}) for ${partnerProfileData.name}`;
	}

	return { embedFooterStatsTextPlayer1, embedFooterStatsTextPlayer2 };
}

async function checkHealthAndLevel(message, botReply, profileData, serverData, partnerProfileData, userInjuryObjectPlayer1, userInjuryObjectPlayer2) {

	botReply = await decreaseHealth(message, profileData, botReply, userInjuryObjectPlayer1);
	botReply = await decreaseHealth(message, partnerProfileData, botReply, userInjuryObjectPlayer2);

	botReply = await checkLevelUp(message, botReply, profileData, serverData);
	botReply = await checkLevelUp(message, botReply, partnerProfileData, serverData);

	await isPassedOut(message, profileData, true);
	await isPassedOut(message, partnerProfileData, true);

	await restAdvice(message, profileData);
	await restAdvice(message, partnerProfileData);

	await drinkAdvice(message, profileData);
	await drinkAdvice(message, partnerProfileData);

	await eatAdvice(message, profileData);
	await eatAdvice(message, partnerProfileData);
}

async function executeWin(componentArray, message, profileData, serverData, partnerProfileData, otherProfileData, currentProfileData, userInjuryObjectPlayer1, userInjuryObjectPlayer2, embedArray, botReply, messageContent) {

	let { embedFooterStatsTextPlayer1, embedFooterStatsTextPlayer2 } = await decreaseStats(message, profileData, partnerProfileData);

	const x = (otherProfileData.levels - currentProfileData.levels < 0) ? 0 : otherProfileData.levels - currentProfileData.levels;
	const extraExperience = Math.round((80 / (1 + Math.pow(Math.E, -0.09375 * x))) - 40);
	const experiencePoints = generateRandomNumber(11, 10) + extraExperience;

	if (currentProfileData.userId === profileData.userId) {

		embedFooterStatsTextPlayer1 = `+${experiencePoints} XP (${currentProfileData.experience + experiencePoints}/${currentProfileData.levels * 50}) for ${currentProfileData.name}\n${embedFooterStatsTextPlayer1}`;
	}
	else {

		embedFooterStatsTextPlayer2 = `+${experiencePoints} XP (${currentProfileData.experience + experiencePoints}/${currentProfileData.levels * 50}) for ${currentProfileData.name}\n${embedFooterStatsTextPlayer2}`;
	}

	currentProfileData = await profileModel.findOneAndUpdate(
		{ userId: currentProfileData.userId, serverId: message.guild.id },
		{ $inc: { experience: experiencePoints } },
	);

	let getHurtText = '';
	const getHurtChance = pullFromWeightedTable({ 0: 10, 1: 90 + otherProfileData.saplingObject.waterCycles });
	if (getHurtChance == 0) {

		let healthPoints = generateRandomNumber(5, 3);
		const userInjuryObject = (otherProfileData.userId === profileData.userId) ? userInjuryObjectPlayer1 : userInjuryObjectPlayer2;

		if (otherProfileData.health - healthPoints < 0) {

			healthPoints = otherProfileData.health;
		}

		otherProfileData = await profileModel.findOneAndUpdate(
			{ userId: otherProfileData.userId, serverId: message.guild.id },
			{ $inc: { health: -healthPoints } },
		);

		switch (pullFromWeightedTable({ 0: 1, 1: 1 })) {

			case 0:

				userInjuryObject.infections += 1;

				getHurtText += `*${otherProfileData.name} has enjoyed the roughhousing, but ${pronounAndPlural(otherProfileData, 0, 'is', 'are')} struck by exhaustion. After taking a short nap, ${pronounAndPlural(otherProfileData, 0, 'notice')} the rash creeping along ${pronoun(otherProfileData, 2)} back. Oh no! The ${otherProfileData.species} has gotten an infection while playing!*`;

				if (otherProfileData.userId === profileData.userId) {

					embedFooterStatsTextPlayer1 = `-${healthPoints} HP (from infection)\n${embedFooterStatsTextPlayer1}`;
				}
				else {

					embedFooterStatsTextPlayer2 = `-${healthPoints} HP (from infection)\n${embedFooterStatsTextPlayer2}`;
				}

				break;

			default:

				userInjuryObject.sprains += 1;

				getHurtText += `*${otherProfileData.name} tries to get up with ${currentProfileData.name}'s help, but the ${otherProfileData.species} feels a horrible pain as ${pronoun(otherProfileData, 0)} get up. Ironically, ${otherProfileData.name} got a sprain from getting up after the fight.*`;

				if (otherProfileData.userId === profileData.userId) {

					embedFooterStatsTextPlayer1 = `-${healthPoints} HP (from sprain)\n${embedFooterStatsTextPlayer1}`;
				}
				else {

					embedFooterStatsTextPlayer2 = `-${healthPoints} HP (from sprain)\n${embedFooterStatsTextPlayer2}`;
				}
		}

		userInjuryObjectPlayer1 = (otherProfileData.userId === profileData.userId) ? userInjuryObject : userInjuryObjectPlayer1;
		userInjuryObjectPlayer2 = (otherProfileData.userId === profileData.userId) ? userInjuryObjectPlayer2 : userInjuryObject;
	}

	embedArray.push({
		color: profileData.color,
		author: { name: profileData.name, icon_url: profileData.avatarURL },
		description: `*The two animals are pressing against each other with all their might. It seems like the fight will never end this way, but ${currentProfileData.name} has one more trick up ${pronoun(currentProfileData, 2)} sleeve: ${pronoun(currentProfileData, 0)} simply moves out of the way, letting ${otherProfileData.name} crash into the ground. ${upperCasePronounAndPlural(otherProfileData, 0, 'has', 'have')} a wry grin on ${pronoun(otherProfileData, 2)} face as ${pronounAndPlural(otherProfileData, 0, 'look')} up at the ${currentProfileData.species}. ${currentProfileData.name} wins this fight, but who knows about the next one?*\n\n${getHurtText}`,
		footer: { text: `${embedFooterStatsTextPlayer1}\n\n${embedFooterStatsTextPlayer2}` },
	});

	botReply = await message
		.reply({
			content: messageContent,
			embeds: embedArray,
			components: componentArray,
			failIfNotExists: false,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) {
				throw new Error(error);
			}
		});

	await checkHealthAndLevel(message, botReply, profileData, serverData, partnerProfileData, userInjuryObjectPlayer1, userInjuryObjectPlayer2);
}

async function executeDraw(componentArray, message, profileData, serverData, partnerProfileData, embedArray, botReply, messageContent, userInjuryObjectPlayer1, userInjuryObjectPlayer2) {

	let { embedFooterStatsTextPlayer1, embedFooterStatsTextPlayer2 } = await decreaseStats(message, profileData, partnerProfileData);

	const experiencePoints = generateRandomNumber(11, 5);

	embedFooterStatsTextPlayer1 = `+${experiencePoints} XP (${profileData.experience + experiencePoints}/${profileData.levels * 50}) for ${profileData.name}\n${embedFooterStatsTextPlayer1}`;
	embedFooterStatsTextPlayer2 = `+${experiencePoints} XP (${partnerProfileData.experience + experiencePoints}/${partnerProfileData.levels * 50}) for ${partnerProfileData.name}\n${embedFooterStatsTextPlayer2}`;

	profileData = await profileModel.findOneAndUpdate(
		{ userId: message.author.id, serverId: message.guild.id },
		{ $inc: { experience: experiencePoints } },
	);

	partnerProfileData = await profileModel.findOneAndUpdate(
		{ userId: message.mentions.users.first().id, serverId: message.guild.id },
		{ $inc: { experience: experiencePoints } },
	);

	embedArray.push({
		color: profileData.color,
		author: { name: profileData.name, icon_url: profileData.avatarURL },
		description: `*The two animals wrestle with each other until ${profileData.name} falls over the ${partnerProfileData.species} and both of them land on the ground. They pant and glare at each other, but ${partnerProfileData.name} can't contain ${pronoun(partnerProfileData, 2)} laughter. The ${profileData.species} starts to giggle as well. The fight has been fun, even though no one won.*`,
		footer: { text: `${embedFooterStatsTextPlayer1}\n\n${embedFooterStatsTextPlayer2}` },
	});

	botReply = await message
		.reply({
			content: messageContent,
			embeds: embedArray,
			components: componentArray,
			failIfNotExists: false,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) {
				throw new Error(error);
			}
		});

	await checkHealthAndLevel(message, botReply, profileData, serverData, partnerProfileData, userInjuryObjectPlayer1, userInjuryObjectPlayer2);
}

function deepCopy(obj) {

	if (Array.isArray(obj)) {

		return obj.map(deepCopy);
	}

	return obj;
}