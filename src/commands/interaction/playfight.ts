import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ComponentType, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { hasCooldownMap } from '../../events/interactionCreate';
import userModel from '../../models/userModel';
import { CurrentRegionType, Profile, Quid, ServerSchema, SlashCommand, UserSchema } from '../../typedef';
import { drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { changeCondition } from '../../utils/changeCondition';
import { hasCompletedAccount, isInGuild } from '../../utils/checkUserState';
import { isInteractable, isInvalid, isPassedOut } from '../../utils/checkValidity';
import { createCommandComponentDisabler, disableAllComponents, disableCommandComponent } from '../../utils/componentDisabling';
import { addFriendshipPoints } from '../../utils/friendshipHandling';
import { pronoun, pronounAndPlural, upperCasePronounAndPlural } from '../../utils/getPronouns';
import { deepCopyObject, getBiggerNumber, getMapData, getSmallerNumber, respond, sendErrorMessage } from '../../utils/helperFunctions';
import { checkLevelUp } from '../../utils/levelHandling';
import { generateRandomNumber, generateRandomNumberWithException } from '../../utils/randomizers';
import { remindOfAttack } from '../gameplay_primary/attack';

const name: SlashCommand['name'] = 'playfight';
const description: SlashCommand['description'] = 'You can play Connect Four or Tic Tac Toe.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.setDMPermission(false)
		.addUserOption(option =>
			option.setName('user')
				.setDescription('The user that you want to playfight with.')
				.setRequired(true))
		.addStringOption(option =>
			option.setName('gametype')
				.setDescription('Whether you want to play tic tac toe or connect four')
				.setChoices(
					{ name: 'Connect four', value: 'Connect four' },
					{ name: 'Tic Tac Toe', value: 'Tic Tac Toe' },
				))
		.toJSON(),
	disablePreviousCommand: true,
	sendCommand: async (client, interaction, userData1, serverData, embedArray) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (!isInGuild(interaction)) { return; }
		if (!hasCompletedAccount(interaction, userData1)) { return; }

		/* Gets the current active quid and the server profile from the account */
		const quidData1 = getMapData(userData1.quids, getMapData(userData1.currentQuid, interaction.guildId));
		const profileData1 = getMapData(quidData1.profiles, interaction.guildId);

		/* Checks if the profile is on a cooldown, passed out, or resting. */
		if (await isInvalid(interaction, userData1, quidData1, profileData1, embedArray, name)) { return; }

		/* Define messageContent as the return of remindOfAttack */
		const messageContent = remindOfAttack(interaction.guildId);

		/* Gets the mentioned user. */
		const mentionedUser = interaction.options.getUser('user');
		if (!mentionedUser) { throw new TypeError('mentionedUser is null'); }

		/* Checks whether the mentioned user is associated with the account. */
		if (userData1.userId.includes(mentionedUser.id)) {

			await respond(interaction, {
				content: messageContent,
				embeds: [...embedArray, new EmbedBuilder()
					.setColor(quidData1.color)
					.setAuthor({ name: quidData1.name, iconURL: quidData1.avatarURL })
					.setDescription(`*${quidData1.name} believes that ${pronounAndPlural(quidData1, 0, 'is', 'are')} so unmatched that only ${pronoun(quidData1, 0)} could defeat ${pronoun(quidData1, 4)}. But it doesn't take ${pronoun(quidData1, 1)} long to realize that it is more fun to fight a partner after all.*`)],
			}, false)
				.catch(error => { throw new Error(error); });
			return;
		}

		/* Define the partners user data, check if the user is interactable, and if they are, define quid data and profile data. */
		const userData2 = await userModel.findOne(u => u.userId.includes(mentionedUser.id)).catch(() => { return null; });
		if (!isInteractable(interaction, userData2, messageContent, embedArray)) { return; }
		const quidData2 = getMapData(userData2.quids, getMapData(userData2.currentQuid, interaction.guildId));

		/* Gets the selected game type. */
		const gameType = interaction.options.getString('gametype');
		if (!gameType) { throw new TypeError('gameType is null'); }

		/* Sending a message asking the other player if they want to play, with a button to start the adventure. */
		const botReply = await respond(interaction, {
			content: messageContent,
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(quidData1.color)
				.setAuthor({ name: quidData1.name, iconURL: quidData1.avatarURL })
				.setDescription(`*${quidData1.name} hangs around the prairie when ${quidData2.name} comes by. The ${quidData2.displayedSpecies || quidData2.species} has things to do but ${quidData1.name}'s smug expression implies ${pronoun(quidData2, 0)} wouldn't be able to beat the ${quidData1.displayedSpecies || quidData1.species}.*`)
				.setFooter({ text: `The game that is being played is ${gameType}.` })],
			components: [new ActionRowBuilder<ButtonBuilder>()
				.setComponents(new ButtonBuilder()
					.setCustomId(`playfight_confirm_${gameType.replace(/\s+/g, '').toLowerCase()}_${mentionedUser.id}_${interaction.user.id}`)
					.setLabel('Accept challenge')
					.setEmoji('🎭')
					.setStyle(ButtonStyle.Success))],
		}, true);

		/* Register the command to be disabled when another command is executed, for both players */
		createCommandComponentDisabler(userData1.uuid, interaction.guildId, botReply);
		createCommandComponentDisabler(userData2.uuid, interaction.guildId, botReply);
	},
};

export const playfightInteractionCollector = async (
	interaction: ButtonInteraction,
	serverData: ServerSchema | null,
): Promise<void> => {

	if (!interaction.customId.includes('confirm')) { return; }
	if (!interaction.inCachedGuild()) { throw new Error('Interaction is not in cached guild.'); }
	if (!interaction.channel) { throw new Error('Interaction channel is missing.'); }
	if (!serverData) { throw new TypeError('serverData is null'); }

	/* Gets the current active quid and the server profile from the account */
	const userId1 = interaction.customId.split('_')[4];
	if (!userId1) { throw new TypeError('userId1 is undefined'); }
	const userData1 = await userModel.findOne(u => u.userId.includes(userId1));
	const quidData1 = getMapData(userData1.quids, getMapData(userData1.currentQuid, interaction.guildId));
	let profileData1 = getMapData(quidData1.profiles, interaction.guildId);

	/* Gets the current active quid and the server profile from the partners account */
	const userId2 = interaction.customId.split('_')[3];
	if (!userId2) { throw new TypeError('userId2 is undefined'); }
	const userData2 = await userModel.findOne(u => u.userId.includes(userId2));
	const quidData2 = getMapData(userData2.quids, getMapData(userData2.currentQuid, interaction.guildId));
	let profileData2 = getMapData(quidData2.profiles, interaction.guildId);

	/* For both users, set cooldowns to true, but unregister the command from being disabled, and get the condition change */
	hasCooldownMap.set(userData1.uuid + interaction.guildId, true);
	hasCooldownMap.set(userData2.uuid + interaction.guildId, true);
	delete disableCommandComponent[userData1.uuid + interaction.guildId];
	delete disableCommandComponent[userData2.uuid + interaction.guildId];
	const decreasedStatsData1 = await changeCondition(userData1, quidData1, profileData1, 0, CurrentRegionType.Prairie);
	profileData1 = decreasedStatsData1.profileData;
	const decreasedStatsData2 = await changeCondition(userData2, quidData2, profileData2, 0, CurrentRegionType.Prairie);
	profileData2 = decreasedStatsData2.profileData;

	/* Gets the chosen game type errors if it doesn't exist */
	const gameType = interaction.customId.split('_')[2]; // connectfour or tictactoe
	if (!gameType) { throw new TypeError('gameType is undefined'); }

	const emptyField = gameType === 'tictactoe' ? '◻️' : '⚫';
	const player1Field = gameType === 'tictactoe' ? '⭕' : '🟡';
	const player2Field = gameType === 'tictactoe' ? '❌' : '🔴';

	let componentArray: ActionRowBuilder<ButtonBuilder>[] = [];
	const playingField: number[][] = [];
	for (let row = 0; row < (gameType === 'tictactoe' ? 3 : 6); row++) {

		playingField.push([]);
		if (gameType === 'tictactoe') { componentArray.push(new ActionRowBuilder<ButtonBuilder>().addComponents([])); }

		for (let column = 0; column < (gameType === 'tictactoe' ? 3 : 7); column++) {

			playingField[row]?.push(0);
			if (gameType === 'tictactoe') {

				componentArray[row]?.addComponents(new ButtonBuilder()
					.setCustomId(`playfight_board_${row}_${column}`)
					.setEmoji(emptyField)
					.setDisabled(false)
					.setStyle(ButtonStyle.Secondary),
				);
			}
		}
	}

	if (gameType === 'connectfour') {

		componentArray.push(
			new ActionRowBuilder<ButtonBuilder>().setComponents(
				new ButtonBuilder()
					.setCustomId('playfight_board_0')
					.setEmoji('1️⃣')
					.setDisabled(false)
					.setStyle(ButtonStyle.Secondary),
				new ButtonBuilder()
					.setCustomId('playfight_board_1')
					.setEmoji('2️⃣')
					.setDisabled(false)
					.setStyle(ButtonStyle.Secondary),
				new ButtonBuilder()
					.setCustomId('playfight_board_2')
					.setEmoji('3️⃣')
					.setDisabled(false)
					.setStyle(ButtonStyle.Secondary),
				new ButtonBuilder()
					.setCustomId('playfight_board_3')
					.setEmoji('4️⃣')
					.setDisabled(false)
					.setStyle(ButtonStyle.Secondary),
			),
			new ActionRowBuilder<ButtonBuilder>().setComponents(
				new ButtonBuilder()
					.setCustomId('playfight_board_4')
					.setEmoji('5️⃣')
					.setDisabled(false)
					.setStyle(ButtonStyle.Secondary),
				new ButtonBuilder()
					.setCustomId('playfight_board_5')
					.setEmoji('6️⃣')
					.setDisabled(false)
					.setStyle(ButtonStyle.Secondary),
				new ButtonBuilder()
					.setCustomId('playfight_board_6')
					.setEmoji('7️⃣')
					.setDisabled(false)
					.setStyle(ButtonStyle.Secondary),
			),
		);
	}

	let newTurnEmbedTextArrayIndex = -1;

	const user1IsPlaying = generateRandomNumber(2, 0) === 0 ? true : false;
	const userDataCurrent = user1IsPlaying ? userData1 : userData2;
	const userDataOther = user1IsPlaying ? userData2 : userData1;
	const quidDataCurrent = user1IsPlaying ? quidData1 : quidData2;
	const quidDataOther = user1IsPlaying ? quidData2 : quidData1;
	const profileDataCurrent = user1IsPlaying ? profileData1 : profileData2;
	const profileDataOther = user1IsPlaying ? profileData2 : profileData1;

	const sendNextRoundMessage = async (
		userId: string,
		extraDescription?: string,
	) => {

		const newTurnEmbedTextArray = [
			`*${quidDataCurrent.name} bites into ${quidDataOther.name}, not very deep, but deep enough to hang onto the ${quidDataOther.displayedSpecies || quidDataOther.species}. ${quidDataOther.name} needs to get the ${quidDataCurrent.displayedSpecies || quidDataCurrent.species} off of ${pronoun(quidDataOther, 1)}.*`,
			`*${quidDataCurrent.name} slams into ${quidDataOther.name}, leaving the ${quidDataOther.displayedSpecies || quidDataOther.species} disoriented. ${quidDataOther.name} needs to start an attack of ${pronoun(quidDataOther, 2)} own now.*`,
			`*${quidDataOther.name} has gotten hold of ${quidDataCurrent.name}, but the ${quidDataCurrent.displayedSpecies || quidDataCurrent.displayedSpecies} manages to get ${pronoun(quidDataOther, 1)} off, sending the ${quidDataOther.displayedSpecies || quidDataOther.species} slamming into the ground. ${quidDataOther.name} needs to get up and try a new strategy.*`,
		] as const;

		newTurnEmbedTextArrayIndex = generateRandomNumberWithException(newTurnEmbedTextArray.length, 0, newTurnEmbedTextArrayIndex);

		const message = await respond(interaction, {
			content: `<@${userId}>`,
			embeds: [new EmbedBuilder()
				.setColor(quidData1.color)
				.setAuthor({ name: quidData1.name, iconURL: quidData1.avatarURL })
				.setDescription(newTurnEmbedTextArray[newTurnEmbedTextArrayIndex as 0 | 1 | 2] + extraDescription ? `\n${extraDescription}` : '')],
			components: componentArray,
		}, false);

		await interaction.message.delete();

		return message;
	};

	let botReply = await sendNextRoundMessage(
		user1IsPlaying ? userId1 : userId2,
		gameType === 'connectfour' ? playingField.map(
			row => row.join('').replace('0', emptyField).replace('1', player1Field).replace('2', player2Field),
		).join('\n') + '\n1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣' : undefined,
	)
		.catch((error) => { throw new Error(error); });

	const collector = interaction.channel!.createMessageComponentCollector({
		componentType: ComponentType.Button,
		// This returns `reason` as 'idle' on end event
		idle: 120_000,
		filter: (i => i.customId.startsWith('playfight_') && userDataCurrent.userId.includes(i.user.id)),
	});

	collector.on('collect', async (i) => {

		let column: number | undefined = undefined;
		let row: number | undefined = undefined;
		if (gameType === 'tictactoe') {

			/* The column and row of the current card are updated with their position */
			row = Number(i.customId.split('_')[2]);
			if (isNaN(row)) { return collector.stop('error_Error: row is Not a Number'); }
			column = Number(i.customId.split('_')[3]);
			if (isNaN(column)) { return collector.stop('error_Error: column is Not a Number'); }

			componentArray[row]?.components[column]?.setEmoji(user1IsPlaying ? player1Field : player2Field);
			componentArray[row]?.components[column]?.setDisabled(true);
			playingField[row]![column] = user1IsPlaying ? 1 : 2;
		}
		else if (gameType === 'connectfour') {

			/* The column and row of the current card are updated with their position */
			column = Number(i.customId.split('_')[2]);

			for (let r = 5; r >= 0; r--) {

				let pos = playingField[r]?.[column];
				if (pos === 0) {

					row = r;
					pos = (user1IsPlaying === true) ? 1 : 2;

					if (r === 0) { componentArray[column <= 3 ? 0 : 1]?.components[column <= 3 ? column : column - 4]?.setDisabled(true); }

					break;
				}
			}
			if (!row) { return collector.stop('error_Error: row is Not a Number'); }
		}
		else { return collector.stop(`error_Error: gameType "${gameType}" is invalid`); }

		// getWinningRow can crash, therefore we need to catch this way
		try {

			const winningRow = getWinningRow(playingField, { row, column }, gameType === 'tictactoe' ? 3 : 4);
			if (winningRow) {

				if (gameType === 'connectfour') { winningRow.forEach(position => playingField[position.row]![position.column] = user1IsPlaying ? 3 : 4); }
				return collector.stop('success_win');
			}
			else if (
				(gameType === 'tictactoe' && componentArray.every(columnArray => columnArray.components.every(rowArray => rowArray.data.disabled === true))) ||
				(gameType === 'connectfour' && !getWinningRow(deepCopyObject(playingField).map(row => row.map(column => column === 0 ? user1IsPlaying ? 1 : 2 : column)), { row, column }, 4))
			) { return collector.stop('success_tie'); }
			else {

				const newBotReply = await sendNextRoundMessage(
					user1IsPlaying ? userId1 : userId2,
					gameType === 'connectfour' ? playingField.map(
						row => row.join('').replace('0', emptyField).replace('1', player1Field).replace('2', player2Field),
					).join('\n') + '\n1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣' : undefined,
				)
					.catch((error) => {
						collector.stop(`error_${error}`);
						return undefined;
					});
				if (!newBotReply) { return; }
				else { botReply = newBotReply; }
			}
		}
		catch (error) { collector.stop(`error_${error}`); }
	});

	collector.on('end', async (collected, reason) => {

		/* Set both user's cooldown to false */
		hasCooldownMap.set(userData1.uuid + interaction.guildId, false);
		hasCooldownMap.set(userData2.uuid + interaction.guildId, false);

		if (reason.startsWith('error')) {

			const errorReason = reason.split('_').slice(1).join('_') || 'An unexpected error occurred.';
			await sendErrorMessage(interaction, errorReason)
				.catch((error) => { console.error(error); });
			return;
		}

		// reason idle: someone waited too long
		if (reason.includes('idle') || reason.includes('time')) {

			const afterGameChangesData = await checkAfterGameChanges(interaction, userData1, quidData1, profileData1, userData2, quidData2, profileData2, serverData)
				.catch((error) => { sendErrorMessage(interaction, error); });

			await botReply
				.edit({
					content: null,
					embeds: [
						new EmbedBuilder()
							.setColor(quidData1.color)
							.setAuthor({ name: quidData1.name, iconURL: quidData1.avatarURL })
							.setDescription(`*${quidDataCurrent.name} takes so long with ${pronoun(quidDataCurrent, 2)} decision on how to attack that ${quidDataOther.name} gets impatient and leaves.*`)
							.setFooter({ text: `${decreasedStatsData1.statsUpdateText}\n\n${decreasedStatsData2.statsUpdateText}` }),
						...(decreasedStatsData1.injuryUpdateEmbed ? [decreasedStatsData1.injuryUpdateEmbed] : []),
						...(decreasedStatsData2.injuryUpdateEmbed ? [decreasedStatsData2.injuryUpdateEmbed] : []),
						...(afterGameChangesData?.user1CheckLevelData.levelUpEmbed ? [afterGameChangesData.user1CheckLevelData.levelUpEmbed] : []),
						...(afterGameChangesData?.user2CheckLevelData.levelUpEmbed ? [afterGameChangesData.user2CheckLevelData.levelUpEmbed] : []),
					],
					components: disableAllComponents(interaction.message.components.map(component => component.toJSON())),
				})
				.catch((error) => { sendErrorMessage(interaction, error); });
			return;
		}

		// reason success: there's a tie or one person got 3 in a row
		if (reason.includes('success')) {

			componentArray = disableAllComponents(componentArray.map(component => component.toJSON())).map(component => new ActionRowBuilder<ButtonBuilder>(component));

			if (reason.includes('win')) {

				const x = getBiggerNumber(profileDataOther.levels - profileDataCurrent.levels, 0);
				const extraExperience = Math.round((80 / (1 + Math.pow(Math.E, -0.09375 * x))) - 40);
				const experiencePoints = generateRandomNumber(11, 10) + extraExperience;

				(user1IsPlaying ? decreasedStatsData1 : decreasedStatsData2).statsUpdateText = `+${experiencePoints} XP (${profileDataCurrent.experience + experiencePoints}/${profileDataCurrent.levels * 50}) for ${quidDataCurrent.name}\n${(user1IsPlaying ? decreasedStatsData1 : decreasedStatsData2).statsUpdateText}`;

				await userModel.findOneAndUpdate(
					u => u.uuid === userDataCurrent.uuid,
					(u) => {
						const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
						p.experience += experiencePoints;
					},
				);
			}
			else {

				const experiencePoints = generateRandomNumber(11, 5);

				decreasedStatsData1.statsUpdateText = `+${experiencePoints} XP (${profileDataCurrent.experience + experiencePoints}/${profileDataCurrent.levels * 50}) for ${quidDataCurrent.name}\n${decreasedStatsData1.statsUpdateText}`;
				decreasedStatsData2.statsUpdateText = `+${experiencePoints} XP (${profileDataOther.experience + experiencePoints}/${profileDataOther.levels * 50}) for ${quidDataOther.name}\n${decreasedStatsData2.statsUpdateText}`;

				await userModel.findOneAndUpdate(
					u => u.uuid === userDataCurrent.uuid,
					(u) => {
						const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
						p.experience += experiencePoints;
					},
				);

				await userModel.findOneAndUpdate(
					u => u.uuid === userDataOther.uuid,
					(u) => {
						const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
						p.experience += experiencePoints;
					},
				);
			}

			const afterGameChangesData = await checkAfterGameChanges(interaction, userData1, quidData1, profileData1, userData2, quidData2, profileData2, serverData)
				.catch((error) => { sendErrorMessage(interaction, error); });

			await botReply
				.edit({
					content: null,
					embeds: [
						...(gameType === 'connectfour' ? [new EmbedBuilder()
							.setColor(quidData1.color)
							.setDescription(playingField.map(
								row => row.join('').replace('0', emptyField).replace('1', player1Field).replace('2', player2Field).replace('3', '🟨').replace('4', '🟥'),
							).join('\n'))] : []),
						new EmbedBuilder()
							.setColor(quidData1.color)
							.setAuthor({ name: quidData1.name, iconURL: quidData1.avatarURL })
							.setDescription(reason.includes('win') ? `*The two animals are pressing against each other with all their might. It seems like the fight will never end this way, but ${quidDataCurrent.name} has one more trick up ${pronoun(quidDataCurrent, 2)} sleeve: ${pronoun(quidDataCurrent, 0)} simply moves out of the way, letting ${quidDataOther.name} crash into the ground. ${upperCasePronounAndPlural(quidDataOther, 0, 'has', 'have')} a wry grin on ${pronoun(quidDataOther, 2)} face as ${pronounAndPlural(quidDataOther, 0, 'look')} up at the ${quidDataCurrent.displayedSpecies || quidDataCurrent.species}. ${quidDataCurrent.name} wins this fight, but who knows about the next one?*` : `*The two animals wrestle with each other until ${quidDataCurrent.name} falls over the ${quidDataOther.displayedSpecies || quidDataOther.species} and both of them land on the ground. They pant and glare at each other, but ${quidDataOther.name} can't contain ${pronoun(quidDataOther, 2)} laughter. The ${quidDataCurrent.displayedSpecies || quidDataCurrent.species} starts to giggle as well. The fight has been fun, even though no one won.*`)
							.setFooter({ text: `${decreasedStatsData1.statsUpdateText}\n\n${decreasedStatsData2.statsUpdateText}` }),
						...(decreasedStatsData1.injuryUpdateEmbed ? [decreasedStatsData1.injuryUpdateEmbed] : []),
						...(decreasedStatsData2.injuryUpdateEmbed ? [decreasedStatsData2.injuryUpdateEmbed] : []),
						...(afterGameChangesData?.user1CheckLevelData.levelUpEmbed ? [afterGameChangesData.user1CheckLevelData.levelUpEmbed] : []),
						...(afterGameChangesData?.user2CheckLevelData.levelUpEmbed ? [afterGameChangesData.user2CheckLevelData.levelUpEmbed] : []),
					],
					components: disableAllComponents(interaction.message.components.map(component => component.toJSON())),
				})
				.catch((error) => { sendErrorMessage(interaction, error); });
			return;
		}
	});
};

type PlayingFieldPosition = { row: number, column: number; };
const getWinningRow = (
	playingField: number[][],
	lastPopulatedPosition: PlayingFieldPosition,
	winCount: number,
): PlayingFieldPosition[] | null => {

	// To determine whether someone has won, the following is needed:
	// First, we need an array of arrays (playing field) with numbers 0, 1, 2. 0 is unpopulated, 1 and 2 are the players.
	// Secondly, we need the row and column of the last populated position (lpp).
	// Thirdly, we need the amount of consecutive positions populated by one player for that player to win (winCount).

	/* When we have all this information, we would make four arrays: */
	const highestColumn = playingField.length - 1;
	const highestRow = (playingField[0]?.length || 1) - 1;

	/* Array 1 would contain the column that the lpp is in. It starts at the bigger number between LPP's column - (winCount - 1) and 0. It ends at the smaller number between LPP's column + (winCount - 1) and the highest column. This ensures that no positions are checked that don't include the lpp itself. */
	const verticalPositions: PlayingFieldPosition[] = [];
	for (
		let i = getBiggerNumber(lastPopulatedPosition.column - (winCount - 1), 0);
		i <= getSmallerNumber(lastPopulatedPosition.column + (winCount - 1), highestColumn);
		i++
	) {
		verticalPositions.push({ row: lastPopulatedPosition.row, column: i });
	}

	/* Array 2 would contain the row that the lpp is in. It starts at the bigger number between LPP's row - (winCount - 1) and 0. It ends at the smaller number between LPP's row + (winCount - 1) and the highest row. This ensures that no positions are checked that don't include the lpp itself. */
	const horizontalPositions: PlayingFieldPosition[] = [];
	for (
		let i = getBiggerNumber(lastPopulatedPosition.row - (winCount - 1), 0);
		i <= getSmallerNumber(lastPopulatedPosition.row + (winCount - 1), highestRow);
		i++
	) {
		horizontalPositions.push({ row: i, column: lastPopulatedPosition.column });
	}

	/* Array 3 would be a 135° angled line from the positions at top left to the bottom right and through the lpp. We get X which is the smaller number between LPP's row and LPP's column. It starts at column: bigger number between LPP's column - (winCount - 1) and LPP's column - X and row: bigger number between LPP's row - (winCount - 1) and LPP's row - X. We get Y which is the smaller number between (highest row - LPP's row) and (highest column - LPP's column). It ends when either column: smaller number between LPP's column + (winCount - 1) and LPP's column + Y or row: smaller number between LPP's row + (winCount - 1) and LPP's row + Y is reached. This ensures that no positions are checked that don't include the lpp itself. */
	const diagonal135Positions: PlayingFieldPosition[] = [];
	const diagonal135Start = getSmallerNumber(lastPopulatedPosition.row, lastPopulatedPosition.column);
	const diagonal135End = getSmallerNumber(highestRow - lastPopulatedPosition.row, highestColumn - lastPopulatedPosition.column);
	for (
		let c = getBiggerNumber(lastPopulatedPosition.column - (winCount - 1), lastPopulatedPosition.column - diagonal135Start), r = getBiggerNumber(lastPopulatedPosition.row - (winCount - 1), lastPopulatedPosition.row - diagonal135Start);
		c <= getSmallerNumber(lastPopulatedPosition.column + (winCount - 1), lastPopulatedPosition.column + diagonal135End) && r <= getSmallerNumber(lastPopulatedPosition.row + (winCount - 1), lastPopulatedPosition.row + diagonal135End);
		c++, r++
	) {
		diagonal135Positions.push({ row: r, column: c });
	}

	/* Array 4 would be a 45° angled line from the positions at bottom left to the top right and through the lpp. We get X which is the smaller number between LPP's row and (highest column - LPP's column). It starts at column: smaller number between LPP's column + (winCount - 1) and LPP's column + X and row: bigger number between LPP's row - (winCount - 1) and LPP's row - X. We get Y which is the smaller number between (highest row - LPP's row) and LPP's column. It ends when either column: bigger number between LPP's column - (winCount - 1) and LPP's column - Y or row: smaller number between LPP's row + (winCount - 1) and LPP's row + Y is reached. This ensures that no positions are checked that don't include the lpp itself. */
	const diagonal45Positions: PlayingFieldPosition[] = [];
	const diagonal45Start = getSmallerNumber(lastPopulatedPosition.row, highestColumn - lastPopulatedPosition.column);
	const diagonal45End = getSmallerNumber(highestRow - lastPopulatedPosition.row, lastPopulatedPosition.column);
	for (
		let c = getSmallerNumber(lastPopulatedPosition.column + (winCount - 1), lastPopulatedPosition.column + diagonal45Start), r = getBiggerNumber(lastPopulatedPosition.row - (winCount - 1), lastPopulatedPosition.row - diagonal45Start);
		c >= getBiggerNumber(lastPopulatedPosition.column - (winCount - 1), lastPopulatedPosition.column - diagonal45End) && r <= getSmallerNumber(lastPopulatedPosition.row + (winCount - 1), lastPopulatedPosition.row + diagonal45End);
		c--, r++
	) {
		diagonal45Positions.push({ row: r, column: c });
	}

	/* We now have four arrays that form lines of consecutive positions through the lpp, kind of like a star.
	Set up a function that is called for each of these.
	The function could now loop through the chosen array, and compare for each value if it is the same as in the lpp.
	Each time such a comparison is made, increment a counter by one if the result is true and set it to zero if not.
	After that, check if the counter is bigger or equal to winCount. If so, return the function with true.
	After the loop, return the function with false, as the counter never reached winCount.
	If one of the four arrays returns true, we can be sure that the game has been won.
	Alternatively, the function can also return an array of the positions, so that those places can be modified. */
	const checkArrayWin = (
		array: PlayingFieldPosition[],
	): PlayingFieldPosition[] | null => {

		const neededNumber = playingField[lastPopulatedPosition.row]?.[lastPopulatedPosition.column];
		if (neededNumber === undefined) { throw new Error('last populated position does not exist in playing field'); }
		let counter = 0;
		for (let i = 0; i < array.length; i++) {

			const currentNumber = playingField[array[i]!.row]?.[array[i]!.column];
			if (neededNumber === undefined) { throw new Error('position in winning positions array does not exist in playing field'); }
			if (currentNumber === neededNumber) { counter += 1; }
			else { counter = 0; }
			if (counter >= winCount) { return array.splice(i - (winCount - 1), i + 1); }
		}

		return null;
	};

	return checkArrayWin(verticalPositions) || checkArrayWin(horizontalPositions) || checkArrayWin(diagonal135Positions) || checkArrayWin(diagonal45Positions);
};

/**
 * Checks for both players whether to level them up, if they are passed out, whether to add friendship points, and if they need to be given any advice.
 */
const checkAfterGameChanges = async (
	interaction: ButtonInteraction<'cached'>,
	userData1: UserSchema,
	quidData1: Quid,
	profileData1: Profile,
	userData2: UserSchema,
	quidData2: Quid,
	profileData2: Profile,
	serverData: ServerSchema,
): Promise<{
	user1CheckLevelData: {
		levelUpEmbed: EmbedBuilder | null;
		profileData: Profile;
	};
	user2CheckLevelData: {
		levelUpEmbed: EmbedBuilder | null;
		profileData: Profile;
	};
}> => {

	const user1CheckLevelData = await checkLevelUp(interaction, userData1, quidData1, profileData1, serverData);
	const user2CheckLevelData = await checkLevelUp(interaction, userData2, quidData2, profileData2, serverData);

	await isPassedOut(interaction, userData1, quidData1, profileData1, true);
	await isPassedOut(interaction, userData2, quidData2, profileData2, true);

	await addFriendshipPoints(interaction.message, userData1, quidData1._id, userData2, quidData2._id);

	await restAdvice(interaction.message, userData1);
	await restAdvice(interaction.message, userData2);

	await drinkAdvice(interaction.message, userData1);
	await drinkAdvice(interaction.message, userData2);

	await eatAdvice(interaction.message, userData1);
	await eatAdvice(interaction.message, userData2);

	return { user1CheckLevelData, user2CheckLevelData };
};