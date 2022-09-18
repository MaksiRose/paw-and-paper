import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ComponentType, EmbedBuilder, Message, SlashCommandBuilder } from 'discord.js';
import { cooldownMap } from '../../events/interactionCreate';
import userModel from '../../models/userModel';
import { CurrentRegionType, Profile, Quid, ServerSchema, SlashCommand, UserSchema } from '../../typedef';
import { drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { changeCondition } from '../../utils/changeCondition';
import { hasCompletedAccount, isInGuild } from '../../utils/checkUserState';
import { isInteractable, isInvalid, isPassedOut } from '../../utils/checkValidity';
import { createCommandComponentDisabler, disableAllComponents, disableCommandComponent } from '../../utils/componentDisabling';
import { addFriendshipPoints } from '../../utils/friendshipHandling';
import { pronoun, pronounAndPlural, upperCasePronounAndPlural } from '../../utils/getPronouns';
import { getBiggerNumber, getMapData, getQuidDisplayname, getSmallerNumber, respond, sendErrorMessage, update } from '../../utils/helperFunctions';
import { checkLevelUp } from '../../utils/levelHandling';
import { getRandomNumber } from '../../utils/randomizers';
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
				)
				.setRequired(true))
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
		if (await isInvalid(interaction, userData1, quidData1, profileData1, embedArray)) { return; }

		/* Define messageContent as the return of remindOfAttack */
		const messageContent = remindOfAttack(interaction.guildId);

		/* Gets the mentioned user. */
		const mentionedUser = interaction.options.getUser('user');
		if (mentionedUser === null) { throw new TypeError('mentionedUser is null'); }

		/* Checks whether the mentioned user is associated with the account. */
		if (userData1.userId.includes(mentionedUser.id)) {

			await respond(interaction, {
				content: messageContent,
				embeds: [...embedArray, new EmbedBuilder()
					.setColor(quidData1.color)
					.setAuthor({ name: getQuidDisplayname(userData1, quidData1, interaction.guildId), iconURL: quidData1.avatarURL })
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
		if (gameType === null) { throw new TypeError('gameType is null'); }

		/* Sending a message asking the other player if they want to play, with a button to start the adventure. */
		const botReply = await respond(interaction, {
			content: `${(messageContent ?? '')}\n\n${mentionedUser.toString()}`,
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(quidData1.color)
				.setAuthor({ name: getQuidDisplayname(userData1, quidData1, interaction.guildId), iconURL: quidData1.avatarURL })
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

export async function playfightInteractionCollector(
	interaction: ButtonInteraction,
	serverData: ServerSchema | null,
): Promise<void> {

	if (!interaction.customId.includes('confirm')) { return; }
	if (!interaction.inCachedGuild()) { throw new Error('Interaction is not in cached guild.'); }
	if (interaction.channel === null) { throw new Error('Interaction channel is null'); }
	if (serverData === null) { throw new TypeError('serverData is null'); }

	/* Gets the current active quid and the server profile from the account */
	const userId1 = interaction.customId.split('_')[4];
	if (userId1 === undefined) { throw new TypeError('userId1 is undefined'); }
	let userData1 = await userModel.findOne(u => u.userId.includes(userId1));
	let quidData1 = getMapData(userData1.quids, getMapData(userData1.currentQuid, interaction.guildId));
	let profileData1 = getMapData(quidData1.profiles, interaction.guildId);

	/* Gets the current active quid and the server profile from the partners account */
	const userId2 = interaction.customId.split('_')[3];
	if (userId2 === undefined) { throw new TypeError('userId2 is undefined'); }
	let userData2 = await userModel.findOne(u => u.userId.includes(userId2));
	let quidData2 = getMapData(userData2.quids, getMapData(userData2.currentQuid, interaction.guildId));
	let profileData2 = getMapData(quidData2.profiles, interaction.guildId);

	/* For both users, set cooldowns to true, but unregister the command from being disabled, and get the condition change */
	cooldownMap.set(userData1.uuid + interaction.guildId, true);
	cooldownMap.set(userData2.uuid + interaction.guildId, true);
	delete disableCommandComponent[userData1.uuid + interaction.guildId];
	delete disableCommandComponent[userData2.uuid + interaction.guildId];
	const decreasedStatsData1 = await changeCondition(userData1, quidData1, profileData1, 0, CurrentRegionType.Prairie, true);
	profileData1 = decreasedStatsData1.profileData;
	const decreasedStatsData2 = await changeCondition(userData2, quidData2, profileData2, 0, CurrentRegionType.Prairie, true);
	profileData2 = decreasedStatsData2.profileData;

	/* Gets the chosen game type errors if it doesn't exist */
	const gameType = interaction.customId.split('_')[2]; // connectfour or tictactoe
	if (gameType === undefined) { throw new TypeError('gameType is undefined'); }

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

	await startNewRound(getRandomNumber(2) === 0 ? true : false, interaction, userId1, userId2, serverData, interaction.message);

	async function startNewRound(
		user1IsPlaying: boolean,
		interaction: ButtonInteraction<'cached'>,
		userId1: string,
		userId2: string,
		serverData: ServerSchema,
		botReply: Message<true>,
	) {

		let userDataCurrent = user1IsPlaying ? userData1 : userData2;
		let userDataOther = user1IsPlaying ? userData2 : userData1;
		let quidDataCurrent = user1IsPlaying ? quidData1 : quidData2;
		const quidDataOther = user1IsPlaying ? quidData2 : quidData1;
		let profileDataCurrent = user1IsPlaying ? profileData1 : profileData2;
		const profileDataOther = user1IsPlaying ? profileData2 : profileData1;

		async function sendNextRoundMessage(
			userId: string,
			int: ButtonInteraction,
			oldMessage: Message,
			extraDescription?: string,
		): Promise<Message<true>> {

			const newTurnEmbedTextArray = [
				`*${quidDataCurrent.name} bites into ${quidDataOther.name}, not very deep, but deep enough to hang onto the ${quidDataOther.displayedSpecies || quidDataOther.species}. ${quidDataOther.name} needs to get the ${quidDataCurrent.displayedSpecies || quidDataCurrent.species} off of ${pronoun(quidDataOther, 1)}.*`,
				`*${quidDataCurrent.name} slams into ${quidDataOther.name}, leaving the ${quidDataOther.displayedSpecies || quidDataOther.species} disoriented. ${quidDataOther.name} needs to start an attack of ${pronoun(quidDataOther, 2)} own now.*`,
				`*${quidDataOther.name} has gotten hold of ${quidDataCurrent.name}, but the ${quidDataCurrent.displayedSpecies || quidDataCurrent.displayedSpecies} manages to get ${pronoun(quidDataOther, 1)} off, sending the ${quidDataOther.displayedSpecies || quidDataOther.species} slamming into the ground. ${quidDataOther.name} needs to get up and try a new strategy.*`,
			] as const;

			newTurnEmbedTextArrayIndex = getRandomNumber(newTurnEmbedTextArray.length, 0, newTurnEmbedTextArrayIndex === -1 ? undefined : newTurnEmbedTextArrayIndex);

			await oldMessage.delete();

			const message = await respond(int, {
				content: `<@${userId}>`,
				embeds: [new EmbedBuilder()
					.setColor(quidData1.color)
					.setAuthor({ name: getQuidDisplayname(userData1, quidData1, interaction.guildId), iconURL: quidData1.avatarURL })
					.setDescription(newTurnEmbedTextArray[newTurnEmbedTextArrayIndex as 0 | 1 | 2] + (extraDescription ? `\n${extraDescription}` : ''))],
				components: componentArray,
			}, false);

			return message as Message<true>;
		}

		botReply = await sendNextRoundMessage(
			user1IsPlaying ? userId1 : userId2,
			interaction,
			botReply,
			gameType === 'connectfour' ? playingField.map(
				row => row.join('').replaceAll('0', emptyField).replaceAll('1', player1Field).replaceAll('2', player2Field),
			).join('\n') + '\n1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣' : undefined,
		)
			.catch((error) => { throw new Error(error); });

		await botReply
			.awaitMessageComponent({
				componentType: ComponentType.Button,
				idle: 120_000,
				filter: (i => i.customId.startsWith('playfight_') && userDataCurrent.userId.includes(i.user.id)),
			})
			.then(async i => {
				try {

					let column: number | undefined = undefined;
					let row: number | undefined = undefined;
					if (gameType === 'tictactoe') {

						/* The column and row of the current card are updated with their position */
						row = Number(i.customId.split('_')[2]);
						if (isNaN(row)) { throw new Error('row is Not a Number'); }
						column = Number(i.customId.split('_')[3]);
						if (isNaN(column)) { throw new Error('column is Not a Number'); }

						componentArray[row]?.components[column]?.setEmoji(user1IsPlaying ? player1Field : player2Field);
						componentArray[row]?.components[column]?.setDisabled(true);
						playingField[row]![column] = user1IsPlaying ? 1 : 2;
					}
					else if (gameType === 'connectfour') {

						/* The column and row of the current card are updated with their position */
						column = Number(i.customId.split('_')[2]);

						for (let r = 5; r >= 0; r--) {

							if (playingField[r]?.[column] === 0) {

								row = r;
								playingField[r]![column] = (user1IsPlaying === true) ? 1 : 2;

								if (r === 0) { componentArray[column <= 3 ? 0 : 1]?.components[column <= 3 ? column : column - 4]?.setDisabled(true); }

								break;
							}
						}
						if (row === undefined) { throw new Error('row is undefined'); }
					}
					else { throw new Error(`gameType "${gameType}" is invalid`); }

					const winningRow = getWinningRow(playingField, { row, column }, gameType === 'tictactoe' ? 3 : 4);
					if (winningRow !== null) {

						if (gameType === 'connectfour') { winningRow.forEach(position => playingField[position.row]![position.column] = user1IsPlaying ? 3 : 4); }
						return await executeGameEnd(i, 'win');
					}
					else if (playingField.every(row => row.every(column => column !== 0))) {

						return await executeGameEnd(i, 'tie');
					}
					else {

						await startNewRound(!user1IsPlaying, i, userId1, userId2, serverData, botReply);
					}
				}
				catch (error) {

					return await sendErrorMessage(interaction, error)
						.catch(e => { console.error(e); });
				}
			})
			.catch(async () => {

				userData1 = user1IsPlaying ? userDataCurrent : userDataOther;
				quidData1 = getMapData(userData1.quids, getMapData(userData1.currentQuid, interaction.guildId));
				profileData1 = getMapData(quidData1.profiles, interaction.guildId);

				userData2 = user1IsPlaying ? userDataOther : userDataCurrent;
				quidData2 = getMapData(userData2.quids, getMapData(userData2.currentQuid, interaction.guildId));
				profileData2 = getMapData(quidData2.profiles, interaction.guildId);

				const afterGameChangesData = await checkAfterGameChanges(interaction, userData1, quidData1, profileData1, userData2, quidData2, profileData2, serverData)
					.catch(async (error) => {

						return await sendErrorMessage(interaction, error)
							.catch(e => { console.error(e); });
					});

				await botReply
					.edit({
						content: null,
						embeds: [
							new EmbedBuilder()
								.setColor(quidData1.color)
								.setAuthor({ name: getQuidDisplayname(userData1, quidData1, interaction.guildId), iconURL: quidData1.avatarURL })
								.setDescription(`*${quidDataCurrent.name} takes so long with ${pronoun(quidDataCurrent, 2)} decision on how to attack that ${quidDataOther.name} gets impatient and leaves.*`)
								.setFooter({ text: `${decreasedStatsData1.statsUpdateText}\n\n${decreasedStatsData2.statsUpdateText}` }),
							...(decreasedStatsData1.injuryUpdateEmbed ? [decreasedStatsData1.injuryUpdateEmbed] : []),
							...(decreasedStatsData2.injuryUpdateEmbed ? [decreasedStatsData2.injuryUpdateEmbed] : []),
							...(afterGameChangesData?.user1CheckLevelData.levelUpEmbed ? [afterGameChangesData.user1CheckLevelData.levelUpEmbed] : []),
							...(afterGameChangesData?.user2CheckLevelData.levelUpEmbed ? [afterGameChangesData.user2CheckLevelData.levelUpEmbed] : []),
						],
						components: disableAllComponents(componentArray),
					})
					.catch(async (error) => {

						return await sendErrorMessage(interaction, error)
							.catch(e => { console.error(e); });
					});
				return;
			});

		async function executeGameEnd(
			i: ButtonInteraction<'cached'>,
			reason: string,
		) {

			componentArray = disableAllComponents(componentArray);

			if (reason.includes('win')) {

				const x = getBiggerNumber(profileDataOther.levels - profileDataCurrent.levels, 0);
				const extraExperience = Math.round((80 / (1 + Math.pow(Math.E, -0.09375 * x))) - 40);
				const experiencePoints = getRandomNumber(11, 10) + extraExperience;

				(user1IsPlaying ? decreasedStatsData1 : decreasedStatsData2).statsUpdateText = `\n+${experiencePoints} XP (${profileDataCurrent.experience + experiencePoints}/${profileDataCurrent.levels * 50}) for ${quidDataCurrent.name}${(user1IsPlaying ? decreasedStatsData1 : decreasedStatsData2).statsUpdateText}`;

				userDataCurrent = await userModel.findOneAndUpdate(
					u => u.uuid === userDataCurrent.uuid,
					(u) => {
						const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, i.guildId)).profiles, i.guildId);
						p.experience += experiencePoints;
					},
				);
				quidDataCurrent = getMapData(userDataCurrent.quids, getMapData(userDataCurrent.currentQuid, interaction.guildId));
				profileDataCurrent = getMapData(quidDataCurrent.profiles, interaction.guildId);
			}
			else {

				const experiencePoints = getRandomNumber(11, 5);

				decreasedStatsData1.statsUpdateText = `\n+${experiencePoints} XP (${profileDataCurrent.experience + experiencePoints}/${profileDataCurrent.levels * 50}) for ${quidDataCurrent.name}${decreasedStatsData1.statsUpdateText}`;
				decreasedStatsData2.statsUpdateText = `\n+${experiencePoints} XP (${profileDataOther.experience + experiencePoints}/${profileDataOther.levels * 50}) for ${quidDataOther.name}${decreasedStatsData2.statsUpdateText}`;

				userDataCurrent = await userModel.findOneAndUpdate(
					u => u.uuid === userDataCurrent.uuid,
					(u) => {
						const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, i.guildId)).profiles, i.guildId);
						p.experience += experiencePoints;
					},
				);

				userDataOther = await userModel.findOneAndUpdate(
					u => u.uuid === userDataOther.uuid,
					(u) => {
						const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, i.guildId)).profiles, i.guildId);
						p.experience += experiencePoints;
					},
				);
			}

			userData1 = user1IsPlaying ? userDataCurrent : userDataOther;
			quidData1 = getMapData(userData1.quids, getMapData(userData1.currentQuid, interaction.guildId));
			profileData1 = getMapData(quidData1.profiles, interaction.guildId);

			userData2 = user1IsPlaying ? userDataOther : userDataCurrent;
			quidData2 = getMapData(userData2.quids, getMapData(userData2.currentQuid, interaction.guildId));
			profileData2 = getMapData(quidData2.profiles, interaction.guildId);

			const afterGameChangesData = await checkAfterGameChanges(i, userData1, quidData1, profileData1, userData2, quidData2, profileData2, serverData)
				.catch((error) => { sendErrorMessage(i, error); });

			await update(i, {
				content: null,
				embeds: [
					...(gameType === 'connectfour' ? [new EmbedBuilder()
						.setColor(quidData1.color)
						.setDescription(playingField.map(
							row => row.join('').replaceAll('0', emptyField).replaceAll('1', player1Field).replaceAll('2', player2Field).replaceAll('3', '🟨').replaceAll('4', '🟥'),
						).join('\n'))] : []),
					new EmbedBuilder()
						.setColor(quidData1.color)
						.setAuthor({ name: getQuidDisplayname(userData1, quidData1, interaction.guildId), iconURL: quidData1.avatarURL })
						.setDescription(reason.includes('win') ? `*The two animals are pressing against each other with all their might. It seems like the fight will never end this way, but ${quidDataCurrent.name} has one more trick up ${pronoun(quidDataCurrent, 2)} sleeve: ${pronoun(quidDataCurrent, 0)} simply moves out of the way, letting ${quidDataOther.name} crash into the ground. ${upperCasePronounAndPlural(quidDataOther, 0, 'has', 'have')} a wry grin on ${pronoun(quidDataOther, 2)} face as ${pronounAndPlural(quidDataOther, 0, 'look')} up at the ${quidDataCurrent.displayedSpecies || quidDataCurrent.species}. ${quidDataCurrent.name} wins this fight, but who knows about the next one?*` : `*The two animals wrestle with each other until ${quidDataCurrent.name} falls over the ${quidDataOther.displayedSpecies || quidDataOther.species} and both of them land on the ground. They pant and glare at each other, but ${quidDataOther.name} can't contain ${pronoun(quidDataOther, 2)} laughter. The ${quidDataCurrent.displayedSpecies || quidDataCurrent.species} starts to giggle as well. The fight has been fun, even though no one won.*`)
						.setFooter({ text: `${decreasedStatsData1.statsUpdateText}\n${decreasedStatsData2.statsUpdateText}` }),
					...(decreasedStatsData1.injuryUpdateEmbed ? [decreasedStatsData1.injuryUpdateEmbed] : []),
					...(decreasedStatsData2.injuryUpdateEmbed ? [decreasedStatsData2.injuryUpdateEmbed] : []),
					...(afterGameChangesData?.user1CheckLevelData.levelUpEmbed ? [afterGameChangesData.user1CheckLevelData.levelUpEmbed] : []),
					...(afterGameChangesData?.user2CheckLevelData.levelUpEmbed ? [afterGameChangesData.user2CheckLevelData.levelUpEmbed] : []),
				],
				components: disableAllComponents(componentArray),
			})
				.catch((error) => { sendErrorMessage(i, error); });
			return;
		}

		/* Set both user's cooldown to false */
		cooldownMap.set(userData1.uuid + interaction.guildId, false);
		cooldownMap.set(userData2.uuid + interaction.guildId, false);
	}
}

type PlayingFieldPosition = { row: number, column: number; };
function getWinningRow(
	playingField: number[][],
	lastPopulatedPosition: PlayingFieldPosition,
	winCount: number,
): PlayingFieldPosition[] | null {

	// To determine whether someone has won, the following is needed:
	// First, we need an array of arrays (playing field) with numbers 0, 1, 2. 0 is unpopulated, 1 and 2 are the players.
	// Secondly, we need the row and column of the last populated position (lpp).
	// Thirdly, we need the amount of consecutive positions populated by one player for that player to win (winCount).

	/* When we have all this information, we would make four arrays: */
	const highestVertical = playingField.length - 1;
	const highestHorizontal = (playingField[0]?.length || 1) - 1;

	/* Array 1 would contain the row that the lpp is in. It starts at the bigger number between LPP's row - (winCount - 1) and 0. It ends at the smaller number between LPP's row + (winCount - 1) and the highest row. This ensures that no positions are checked that don't include the lpp itself. */
	const verticalPositions: PlayingFieldPosition[] = [];
	for (
		let i = getBiggerNumber(lastPopulatedPosition.row - (winCount - 1), 0);
		i <= getSmallerNumber(lastPopulatedPosition.row + (winCount - 1), highestVertical);
		i++
	) {
		verticalPositions.push({ row: i, column: lastPopulatedPosition.column });
	}

	/* Array 2 would contain the row that the lpp is in. It starts at the bigger number between LPP's row - (winCount - 1) and 0. It ends at the smaller number between LPP's row + (winCount - 1) and the highest row. This ensures that no positions are checked that don't include the lpp itself. */
	const horizontalPositions: PlayingFieldPosition[] = [];
	for (
		let i = getBiggerNumber(lastPopulatedPosition.column - (winCount - 1), 0);
		i <= getSmallerNumber(lastPopulatedPosition.column + (winCount - 1), highestHorizontal);
		i++
	) {
		horizontalPositions.push({ row: lastPopulatedPosition.row, column: i });
	}

	/* Array 3 would be a 135° angled line from the positions at top left to the bottom right and through the lpp. We get X which is the smaller number between LPP's row and LPP's column. It starts at column: bigger number between LPP's column - (winCount - 1) and LPP's column - X and row: bigger number between LPP's row - (winCount - 1) and LPP's row - X. We get Y which is the smaller number between (highest row - LPP's row) and (highest column - LPP's column). It ends when either column: smaller number between LPP's column + (winCount - 1) and LPP's column + Y or row: smaller number between LPP's row + (winCount - 1) and LPP's row + Y is reached. This ensures that no positions are checked that don't include the lpp itself. */
	const diagonal135Positions: PlayingFieldPosition[] = [];
	const diagonal135Start = getSmallerNumber(lastPopulatedPosition.row, lastPopulatedPosition.column);
	const diagonal135End = getSmallerNumber(highestVertical - lastPopulatedPosition.row, highestHorizontal - lastPopulatedPosition.column);
	for (
		let c = getBiggerNumber(lastPopulatedPosition.column - (winCount - 1), lastPopulatedPosition.column - diagonal135Start), r = getBiggerNumber(lastPopulatedPosition.row - (winCount - 1), lastPopulatedPosition.row - diagonal135Start);
		c <= getSmallerNumber(lastPopulatedPosition.column + (winCount - 1), lastPopulatedPosition.column + diagonal135End) && r <= getSmallerNumber(lastPopulatedPosition.row + (winCount - 1), lastPopulatedPosition.row + diagonal135End);
		c++, r++
	) {
		diagonal135Positions.push({ row: r, column: c });
	}

	/* Array 4 would be a 45° angled line from the positions at bottom left to the top right and through the lpp. We get X which is the smaller number between LPP's row and (highest column - LPP's column). It starts at column: smaller number between LPP's column + (winCount - 1) and LPP's column + X and row: bigger number between LPP's row - (winCount - 1) and LPP's row - X. We get Y which is the smaller number between (highest row - LPP's row) and LPP's column. It ends when either column: bigger number between LPP's column - (winCount - 1) and LPP's column - Y or row: smaller number between LPP's row + (winCount - 1) and LPP's row + Y is reached. This ensures that no positions are checked that don't include the lpp itself. */
	const diagonal45Positions: PlayingFieldPosition[] = [];
	const diagonal45Start = getSmallerNumber(lastPopulatedPosition.row, highestVertical - lastPopulatedPosition.column);
	const diagonal45End = getSmallerNumber(highestHorizontal - lastPopulatedPosition.row, lastPopulatedPosition.column);
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
	function checkArrayWin(
		array: PlayingFieldPosition[],
	): PlayingFieldPosition[] | null {

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
	}

	return checkArrayWin(verticalPositions) ?? checkArrayWin(horizontalPositions) ?? checkArrayWin(diagonal135Positions) ?? checkArrayWin(diagonal45Positions);
}

/**
 * Checks for both players whether to level them up, if they are passed out, whether to add friendship points, and if they need to be given any advice.
 */
async function checkAfterGameChanges(
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
}> {

	const user1CheckLevelData = await checkLevelUp(interaction, userData1, quidData1, profileData1, serverData);
	const user2CheckLevelData = await checkLevelUp(interaction, userData2, quidData2, profileData2, serverData);

	await isPassedOut(interaction, userData1, quidData1, profileData1, true);
	await isPassedOut(interaction, userData2, quidData2, profileData2, true);

	await addFriendshipPoints(interaction.message, userData1, quidData1._id, userData2, quidData2._id);

	await restAdvice(interaction, userData1, profileData1);
	await restAdvice(interaction, userData2, profileData2);

	await drinkAdvice(interaction, userData1, profileData1);
	await drinkAdvice(interaction, userData2, profileData2);

	await eatAdvice(interaction, userData1, profileData1);
	await eatAdvice(interaction, userData2, profileData2);

	return { user1CheckLevelData, user2CheckLevelData };
}