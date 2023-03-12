import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ComponentType, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import DiscordUser from '../../models/discordUser';
import Quid from '../../models/quid';
import QuidToServer from '../../models/quidToServer';
import Server from '../../models/server';
import User from '../../models/user';
import UserToServer from '../../models/userToServer';
import { CurrentRegionType, RankType } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { changeCondition } from '../../utils/changeCondition';
import { updateAndGetMembers } from '../../utils/checkRoleRequirements';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInteractable, isInvalid, isPassedOut } from '../../utils/checkValidity';
import { saveCommandDisablingInfo, disableAllComponents, deleteCommandDisablingInfo } from '../../utils/componentDisabling';
import { addFriendshipPoints } from '../../utils/friendshipHandling';
import { getDisplayname, getDisplayspecies, pronoun, pronounAndPlural } from '../../utils/getQuidInfo';
import { capitalize, getArrayElement, getMessageId, respond, sendErrorMessage, setCooldown } from '../../utils/helperFunctions';
import { checkLevelUp } from '../../utils/levelHandling';
import { missingPermissions } from '../../utils/permissionHandler';
import { getRandomNumber } from '../../utils/randomizers';
import { remindOfAttack } from '../gameplay_primary/attack';

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('playfight')
		.setDescription('Play Connect Four or Tic Tac Toe with someone.')
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
	category: 'page4',
	position: 2,
	disablePreviousCommand: true,
	modifiesServerProfile: false, // This is technically true, but set to false because it does not reflect activity
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer, server }) => {

		if (await missingPermissions(interaction, [
			'ViewChannel', // Needed because of createCommandComponentDisabler
			/* 'ViewChannel',*/ interaction.channel?.isThread() ? 'SendMessagesInThreads' : 'SendMessages', 'EmbedLinks', // Needed for channel.send call in addFriendshipPoints
		]) === true) { return; }

		/* This ensures that the user is in a guild and has a completed account. */
		if (server === undefined) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (user !== undefined && (await Quid.count({ where: { userId: user.id } })) > 0) })) { return; } // This is always a reply
		if (!user) { throw new TypeError('user is undefined'); }
		if (!userToServer) { throw new TypeError('userToServer is undefined'); }
		if (!quidToServer) { throw new TypeError('quidToServer is undefined'); }

		/* Checks if the profile is resting, on a cooldown or passed out. */
		const restEmbed = await isInvalid(interaction, user, userToServer, quid, quidToServer);
		if (restEmbed === false) { return; }

		/* Define messageContent as the return of remindOfAttack */
		const messageContent = remindOfAttack(interaction.guildId);

		/* Gets the mentioned user. */
		const mentionedUser = interaction.options.getUser('user');
		if (mentionedUser === null) { throw new TypeError('mentionedUser is null'); }

		const discordUser2 = await DiscordUser.findByPk(mentionedUser.id);
		/* Checks whether the mentioned user is associated with the account. */
		if (discordUser2?.userId === user.id) {

			// This is always a reply
			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setDescription(`*${quid.name} believes that ${pronounAndPlural(quid, 0, 'is', 'are')} so unmatched that only ${pronoun(quid, 0)} could defeat ${pronoun(quid, 4)}. But it doesn't take ${pronoun(quid, 1)} long to realize that it is more fun to fight a partner after all.*`)],
			});
			return;
		}

		/* Define the partners user data, check if the user is interactable, and if they are, define quid data and profile data. */
		const user2 = discordUser2 ? await User.findByPk(discordUser2.userId) ?? undefined : undefined;
		const userToServer2 = user2 ? await UserToServer.findOne({ where: { userId: user2.id, serverId: server.id } }) ?? undefined : undefined;
		const quid2 = userToServer2?.activeQuidId ? await Quid.findByPk(userToServer2.activeQuidId) ?? undefined : undefined;
		const quidToServer2 = quid2 ? await QuidToServer.findOne({ where: { quidId: quid2.id, serverId: server.id } }) ?? undefined : undefined;
		if (!isInteractable(interaction, quid2, quidToServer2, user2, userToServer2, messageContent, restEmbed)) { return; } // This is always a reply
		if (!userToServer2) { throw new TypeError('userToServer2 is undefined'); }

		/* Gets the selected game type. */
		const gameType = interaction.options.getString('gametype');
		if (gameType === null) { throw new TypeError('gameType is null'); }

		/* Sending a message asking the other player if they want to play, with a button to start the adventure. */
		// This is always a reply
		const botReply = await respond(interaction, {
			content: `${mentionedUser.toString()}\n${messageContent}`,
			embeds: [...restEmbed, new EmbedBuilder()
				.setColor(quid.color)
				.setAuthor({
					name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
					iconURL: quid.avatarURL,
				})
				.setDescription(`*${quid.name} hangs around the prairie when ${quid2.name} comes by. The ${getDisplayspecies(quid2)} has things to do but ${quid.name}'s smug expression implies ${pronoun(quid2, 0)} wouldn't be able to beat the ${getDisplayspecies(quid)}.*`)
				.setFooter({ text: `The game that is being played is ${gameType}.` })],
			components: [new ActionRowBuilder<ButtonBuilder>()
				.setComponents(new ButtonBuilder()
					.setCustomId(`playfight_confirm_${gameType.replace(/\s+/g, '').toLowerCase()}_@${mentionedUser.id}_@${interaction.user.id}`)
					.setLabel('Accept challenge')
					.setEmoji('🎭')
					.setStyle(ButtonStyle.Success))],
			fetchReply: true,
		});

		/* Register the command to be disabled when another command is executed, for both players */
		saveCommandDisablingInfo(userToServer, interaction, interaction.channelId, botReply.id);
		saveCommandDisablingInfo(userToServer2, interaction, interaction.channelId, botReply.id);
	},
	async sendMessageComponentResponse(interaction, { server }) {

		if (!interaction.isButton()) { return; }

		if (!interaction.customId.includes('confirm')) { return; }
		if (server === undefined) { throw new Error('server is undefined'); }
		if (!isInGuild(interaction)) { return; }
		if (interaction.channel === null) { throw new Error('Interaction channel is null'); }

		/* Gets the current active quid and the server profile from the account */
		const userId1 = getArrayElement(interaction.customId.split('_'), 4).replace('@', '');
		const discordUser = await DiscordUser.findByPk(userId1);
		const user = discordUser ? await User.findByPk(discordUser.userId) ?? undefined : undefined;
		const discordUsers = user ? (await DiscordUser.findAll({ where: { userId: user.id } })).map(du => du.id) : undefined;
		const userToServer = user ? await UserToServer.findOne({ where: { userId: user.id, serverId: server.id } }) ?? undefined : undefined;
		const quid = userToServer?.activeQuidId ? await Quid.findByPk(userToServer.activeQuidId) ?? undefined : undefined;
		const quidToServer = quid ? await QuidToServer.findOne({ where: { quidId: quid.id, serverId: server.id } }) ?? undefined : undefined;

		if (!hasNameAndSpecies(quid) || !user || !quidToServer || !userToServer || !discordUsers) { throw new Error('data of user 1 is missing'); }
		if (!userToServer || userToServer.hasCooldown === true) { return; }

		/* Gets the current active quid and the server profile from the partners account */
		const userId2 = getArrayElement(interaction.customId.split('_'), 3).replace('@', '');
		const discordUser2 = await DiscordUser.findByPk(userId2);
		const user2 = discordUser2 ? await User.findByPk(discordUser2.userId) ?? undefined : undefined;
		const discordUsers2 = user2 ? (await DiscordUser.findAll({ where: { userId: user2.id } })).map(du => du.id) : undefined;
		const userToServer2 = user2 ? await UserToServer.findOne({ where: { userId: user2.id, serverId: server.id } }) ?? undefined : undefined;
		const quid2 = userToServer2?.activeQuidId ? await Quid.findByPk(userToServer2.activeQuidId) ?? undefined : undefined;
		const quidToServer2 = quid2 ? await QuidToServer.findOne({ where: { quidId: quid2.id, serverId: server.id } }) ?? undefined : undefined;

		if (!hasNameAndSpecies(quid2) || !user2 || !quidToServer2 || !userToServer2 || !discordUsers2) { throw new Error('data of user 2 is missing'); }
		if (!userToServer2 || userToServer2.hasCooldown === true) { return; }

		if (discordUsers.includes(interaction.user.id)) {

			// This is always a reply
			await respond(interaction, {
				content: 'You can\'t accept your own invitation!',
				ephemeral: true,
			});
			return;
		}

		/* For both users, set cooldowns to true, but unregister the command from being disabled, and get the condition change */
		await setCooldown(userToServer, true);
		await setCooldown(userToServer2, true);
		deleteCommandDisablingInfo(userToServer);
		deleteCommandDisablingInfo(userToServer2);
		const decreasedStatsData1 = await changeCondition(quidToServer, quid, 0, CurrentRegionType.Prairie, true);
		const decreasedStatsData2 = await changeCondition(quidToServer2, quid2, 0, CurrentRegionType.Prairie, true);

		/* Gets the chosen game type errors if it doesn't exist */
		const gameType = getArrayElement(interaction.customId.split('_'), 2); // connectfour or tictactoe

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
						.setCustomId(`board_${row}_${column}`)
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
						.setCustomId('board_0')
						.setEmoji('1️⃣')
						.setDisabled(false)
						.setStyle(ButtonStyle.Secondary),
					new ButtonBuilder()
						.setCustomId('board_1')
						.setEmoji('2️⃣')
						.setDisabled(false)
						.setStyle(ButtonStyle.Secondary),
					new ButtonBuilder()
						.setCustomId('board_2')
						.setEmoji('3️⃣')
						.setDisabled(false)
						.setStyle(ButtonStyle.Secondary),
					new ButtonBuilder()
						.setCustomId('board_3')
						.setEmoji('4️⃣')
						.setDisabled(false)
						.setStyle(ButtonStyle.Secondary),
				),
				new ActionRowBuilder<ButtonBuilder>().setComponents(
					new ButtonBuilder()
						.setCustomId('board_4')
						.setEmoji('5️⃣')
						.setDisabled(false)
						.setStyle(ButtonStyle.Secondary),
					new ButtonBuilder()
						.setCustomId('board_5')
						.setEmoji('6️⃣')
						.setDisabled(false)
						.setStyle(ButtonStyle.Secondary),
					new ButtonBuilder()
						.setCustomId('board_6')
						.setEmoji('7️⃣')
						.setDisabled(false)
						.setStyle(ButtonStyle.Secondary),
				),
			);
		}

		let newTurnEmbedTextArrayIndex = -1;

		await startNewRound(getRandomNumber(2) === 0 ? true : false, interaction, userId1, user, quid, userToServer, quidToServer, discordUsers, userId2, user2, quid2, userToServer2, quidToServer2, discordUsers2, server);

		async function startNewRound(
			user1IsPlaying: boolean,
			interaction: ButtonInteraction<'cached'>,
			userId1: string,
			user: User,
			quid: Quid,
			userToServer: UserToServer,
			quidToServer: QuidToServer,
			discordUsers: string[],
			userId2: string,
			user2: User,
			quid2: Quid,
			userToServer2: UserToServer,
			quidToServer2: QuidToServer,
			discordUsers2: string[],
			server: Server,
			previousInteraction?: ButtonInteraction<'cached'>,
		) {

			const currentData = user1IsPlaying
				? { user, quid, userToServer, quidToServer, discordUsers }
				: { user: user2, quid: quid2, userToServer: userToServer2, quidToServer: quidToServer2, discordUsers: discordUsers2 };
			const otherData = user1IsPlaying
				? { user: user2, quid: quid2, userToServer: userToServer2, quidToServer: quidToServer2, discordUsers: discordUsers2 }
				: { user, quid, userToServer, quidToServer, discordUsers };

			const newTurnEmbedTextArray = [
				`*${currentData.quid.name} bites into ${otherData.quid.name}, not very deep, but deep enough to hang onto the ${getDisplayspecies(otherData.quid)}. ${otherData.quid.name} needs to get the ${getDisplayspecies(currentData.quid)} off of ${pronoun(otherData.quid, 1)}.*`,
				`*${currentData.quid.name} slams into ${otherData.quid.name}, leaving the ${getDisplayspecies(otherData.quid)} disoriented. ${otherData.quid.name} needs to start an attack of ${pronoun(otherData.quid, 2)} own now.*`,
				`*${otherData.quid.name} has gotten hold of ${currentData.quid.name}, but the ${getDisplayspecies(currentData.quid)} manages to get ${pronoun(otherData.quid, 1)} off, sending the ${getDisplayspecies(otherData.quid)} slamming into the ground. ${otherData.quid.name} needs to get up and try a new strategy.*`,
			] as const;

			newTurnEmbedTextArrayIndex = getRandomNumber(newTurnEmbedTextArray.length, 0, newTurnEmbedTextArrayIndex === -1 ? undefined : newTurnEmbedTextArrayIndex);

			// This is always a reply
			const botReply = await respond(interaction, {
				content: `<@${user1IsPlaying ? userId1 : userId2}>`,
				embeds: [new EmbedBuilder()
					.setColor(quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setDescription(newTurnEmbedTextArray[newTurnEmbedTextArrayIndex as 0 | 1 | 2] + `\n${gameType === 'connectfour' ? playingField.map(
						row => row.join('').replaceAll('0', emptyField).replaceAll('1', player1Field).replaceAll('2', player2Field),
					).join('\n') + '\n1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣' : ''}`)],
				components: componentArray,
			});

			if (previousInteraction !== undefined) { await previousInteraction.webhook.deleteMessage('@original'); }
			else { await interaction.message.delete(); }

			await botReply
				.awaitMessageComponent({
					componentType: ComponentType.Button,
					idle: 120_000,
					filter: (i => i.customId.includes('board') && currentData.discordUsers.includes(i.user.id)),
				})
				.then(async i => {
					try {

						if (!i.inCachedGuild()) { throw new Error('Interaction is not in cached guild'); }

						let column: number | undefined = undefined;
						let row: number | undefined = undefined;
						if (gameType === 'tictactoe') {

							/* The column and row of the current card are updated with their position */
							row = Number(i.customId.split('_')[1]);
							if (isNaN(row)) { throw new Error('row is Not a Number'); }
							column = Number(i.customId.split('_')[2]);
							if (isNaN(column)) { throw new Error('column is Not a Number'); }

							componentArray[row]?.components[column]?.setEmoji(user1IsPlaying ? player1Field : player2Field);
							componentArray[row]?.components[column]?.setDisabled(true);
							playingField[row]![column] = user1IsPlaying ? 1 : 2;
						}
						else if (gameType === 'connectfour') {

							/* The column and row of the current card are updated with their position */
							column = Number(i.customId.split('_')[1]);

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

							await startNewRound(!user1IsPlaying, i, userId1, user, quid, userToServer, quidToServer, discordUsers, userId2, user2, quid2, userToServer2, quidToServer2, discordUsers2, server, interaction);
						}
					}
					catch (error) {

						return await sendErrorMessage(interaction, error)
							.catch(e => { console.error(e); });
					}
				})
				.catch(async () => {

					const levelUpEmbeds = await checkLevelUps(interaction, user, quid, quidToServer, user2, quid2, quidToServer2)
						.catch((error) => { sendErrorMessage(interaction, error); });

					// This should always be an editReply to the original reply
					await respond(interaction, {
						content: '', // This is converted to null in the function
						embeds: [
							new EmbedBuilder()
								.setColor(quid.color)
								.setAuthor({
									name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
									iconURL: quid.avatarURL,
								})
								.setDescription(`*${currentData.quid.name} takes so long with ${pronoun(currentData.quid, 2)} decision on how to attack that ${otherData.quid.name} gets impatient and leaves.*`)
								.setFooter({ text: `${decreasedStatsData1.statsUpdateText}\n\n${decreasedStatsData2.statsUpdateText}` }),
							...decreasedStatsData1.injuryUpdateEmbed,
							...decreasedStatsData2.injuryUpdateEmbed,
							...(levelUpEmbeds?.levelUpEmbed1 ?? []),
							...(levelUpEmbeds?.levelUpEmbed2 ?? []),
						],
						components: disableAllComponents(componentArray),
					}, 'reply', getMessageId(botReply))
						.catch(async (error) => {

							return await sendErrorMessage(interaction, error)
								.catch(e => { console.error(e); });
						});

					await checkAfterGameChanges(interaction, user, quid, userToServer, quidToServer, user2, quid2, userToServer2, quidToServer2)
						.catch((error) => { sendErrorMessage(interaction, error); return null; });
					return;
				});

			async function executeGameEnd(
				i: ButtonInteraction<'cached'>,
				reason: string,
			) {

				componentArray = disableAllComponents(componentArray);

				if (reason.includes('win')) {

					const x = Math.max(otherData.quidToServer.levels - currentData.quidToServer.levels, 0);
					const extraExperience = Math.round((80 / (1 + Math.pow(Math.E, -0.09375 * x))) - 40);
					const experiencePoints = currentData.quidToServer.rank === RankType.Youngling ? 0 : (getRandomNumber(11, 10) + extraExperience);

					(user1IsPlaying ? decreasedStatsData1 : decreasedStatsData2).statsUpdateText = `\n+${experiencePoints} XP (${currentData.quidToServer.experience + experiencePoints}/${currentData.quidToServer.levels * 50}) for ${currentData.quid.name}${(user1IsPlaying ? decreasedStatsData1 : decreasedStatsData2).statsUpdateText}`;

					await currentData.quidToServer.update({ experience: currentData.quidToServer.experience + experiencePoints });
				}
				else {

					const experiencePointsCurrent = currentData.quidToServer.rank === RankType.Youngling ? 0 : getRandomNumber(5, currentData.quidToServer.levels + 8);
					const experiencePointsOther = otherData.quidToServer.rank === RankType.Youngling ? 0 : getRandomNumber(5, otherData.quidToServer.levels + 8);

					decreasedStatsData1.statsUpdateText = `\n+${experiencePointsCurrent} XP (${currentData.quidToServer.experience + experiencePointsCurrent}/${currentData.quidToServer.levels * 50}) for ${currentData.quid.name}${decreasedStatsData1.statsUpdateText}`;
					decreasedStatsData2.statsUpdateText = `\n+${experiencePointsOther} XP (${otherData.quidToServer.experience + experiencePointsOther}/${otherData.quidToServer.levels * 50}) for ${otherData.quid.name}${decreasedStatsData2.statsUpdateText}`;

					await currentData.quidToServer.update({ experience: currentData.quidToServer.experience + experiencePointsCurrent });
					await otherData.quidToServer.update({ experience: otherData.quidToServer.experience + experiencePointsOther });
				}

				const levelUpEmbeds = await checkLevelUps(i, user, quid, quidToServer, user2, quid2, quidToServer2)
					.catch((error) => { sendErrorMessage(i, error); });

				// This is an update to the message with the button
				await respond(i, {
					content: '', // This is converted to null within the function
					embeds: [
						...(gameType === 'connectfour' ? [new EmbedBuilder()
							.setColor(quid.color)
							.setDescription(playingField.map(
								row => row.join('').replaceAll('0', emptyField).replaceAll('1', player1Field).replaceAll('2', player2Field).replaceAll('3', '🟨').replaceAll('4', '🟥'),
							).join('\n'))] : []),
						new EmbedBuilder()
							.setColor(quid.color)
							.setAuthor({
								name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
								iconURL: quid.avatarURL,
							})
							.setDescription(reason.includes('win') ? `*The two animals are pressing against each other with all their might. It seems like the fight will never end this way, but ${currentData.quid.name} has one more trick up ${pronoun(currentData.quid, 2)} sleeve: ${pronounAndPlural(currentData.quid, 0, 'simply move')} out of the way, letting ${otherData.quid.name} crash into the ground. ${capitalize(pronounAndPlural(otherData.quid, 0, 'has', 'have'))} a wry grin on ${pronoun(otherData.quid, 2)} face as ${pronounAndPlural(otherData.quid, 0, 'look')} up at the ${getDisplayspecies(currentData.quid)}. ${currentData.quid.name} wins this fight, but who knows about the next one?*` : `*The two animals wrestle with each other until ${currentData.quid.name} falls over the ${getDisplayspecies(otherData.quid)} and both of them land on the ground. They pant and glare at each other, but ${otherData.quid.name} can't contain ${pronoun(otherData.quid, 2)} laughter. The ${getDisplayspecies(currentData.quid)} starts to giggle as well. The fight has been fun, even though no one won.*`)
							.setFooter({ text: `${decreasedStatsData1.statsUpdateText}\n${decreasedStatsData2.statsUpdateText}` }),
						...decreasedStatsData1.injuryUpdateEmbed,
						...decreasedStatsData2.injuryUpdateEmbed,
						...(levelUpEmbeds?.levelUpEmbed1 ?? []),
						...(levelUpEmbeds?.levelUpEmbed2 ?? []),
					],
					components: disableAllComponents(componentArray),
				}, 'update', i.message.id)
					.catch((error) => { sendErrorMessage(i, error); });

				await checkAfterGameChanges(interaction, user, quid, userToServer, quidToServer, user2, quid2, userToServer2, quidToServer2)
					.catch((error) => { sendErrorMessage(i, error); return null; });
				return;
			}

			/* Set both user's cooldown to false */
			await setCooldown(userToServer, false);
			await setCooldown(userToServer2, false);
		}
	},
};

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
		let i = Math.max(lastPopulatedPosition.row - (winCount - 1), 0);
		i <= Math.min(lastPopulatedPosition.row + (winCount - 1), highestVertical);
		i++
	) {
		verticalPositions.push({ row: i, column: lastPopulatedPosition.column });
	}

	/* Array 2 would contain the row that the lpp is in. It starts at the bigger number between LPP's row - (winCount - 1) and 0. It ends at the smaller number between LPP's row + (winCount - 1) and the highest row. This ensures that no positions are checked that don't include the lpp itself. */
	const horizontalPositions: PlayingFieldPosition[] = [];
	for (
		let i = Math.max(lastPopulatedPosition.column - (winCount - 1), 0);
		i <= Math.min(lastPopulatedPosition.column + (winCount - 1), highestHorizontal);
		i++
	) {
		horizontalPositions.push({ row: lastPopulatedPosition.row, column: i });
	}

	/* Array 3 would be a 135° angled line from the positions at top left to the bottom right and through the lpp. We get X which is the smaller number between LPP's row and LPP's column. It starts at column: bigger number between LPP's column - (winCount - 1) and LPP's column - X and row: bigger number between LPP's row - (winCount - 1) and LPP's row - X. We get Y which is the smaller number between (highest row - LPP's row) and (highest column - LPP's column). It ends when either column: smaller number between LPP's column + (winCount - 1) and LPP's column + Y or row: smaller number between LPP's row + (winCount - 1) and LPP's row + Y is reached. This ensures that no positions are checked that don't include the lpp itself. */
	const diagonal135Positions: PlayingFieldPosition[] = [];
	const diagonal135Start = Math.min(lastPopulatedPosition.row, lastPopulatedPosition.column);
	const diagonal135End = Math.min(highestVertical - lastPopulatedPosition.row, highestHorizontal - lastPopulatedPosition.column);
	for (
		let c = Math.max(lastPopulatedPosition.column - (winCount - 1), lastPopulatedPosition.column - diagonal135Start), r = Math.max(lastPopulatedPosition.row - (winCount - 1), lastPopulatedPosition.row - diagonal135Start);
		c <= Math.min(lastPopulatedPosition.column + (winCount - 1), lastPopulatedPosition.column + diagonal135End) && r <= Math.min(lastPopulatedPosition.row + (winCount - 1), lastPopulatedPosition.row + diagonal135End);
		c++, r++
	) {
		diagonal135Positions.push({ row: r, column: c });
	}

	/* Array 4 would be a 45° angled line from the positions at bottom left to the top right and through the lpp. We get X which is the smaller number between LPP's row and (highest column - LPP's column). It starts at column: smaller number between LPP's column + (winCount - 1) and LPP's column + X and row: bigger number between LPP's row - (winCount - 1) and LPP's row - X. We get Y which is the smaller number between (highest row - LPP's row) and LPP's column. It ends when either column: bigger number between LPP's column - (winCount - 1) and LPP's column - Y or row: smaller number between LPP's row + (winCount - 1) and LPP's row + Y is reached. This ensures that no positions are checked that don't include the lpp itself. */
	const diagonal45Positions: PlayingFieldPosition[] = [];
	const diagonal45Start = Math.min(lastPopulatedPosition.row, highestVertical - lastPopulatedPosition.column);
	const diagonal45End = Math.min(highestHorizontal - lastPopulatedPosition.row, lastPopulatedPosition.column);
	for (
		let c = Math.min(lastPopulatedPosition.column + (winCount - 1), lastPopulatedPosition.column + diagonal45Start), r = Math.max(lastPopulatedPosition.row - (winCount - 1), lastPopulatedPosition.row - diagonal45Start);
		c >= Math.max(lastPopulatedPosition.column - (winCount - 1), lastPopulatedPosition.column - diagonal45End) && r <= Math.min(lastPopulatedPosition.row + (winCount - 1), lastPopulatedPosition.row + diagonal45End);
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
 * It checks if the user has leveled up, and if so, it returns an embed
 * @param interaction - ButtonInteraction<'cached'>
 * @param userData1 - The user data of the user who pressed the button.
 * @param userData2 - UserData<never, never>
 * @param {ServerSchema} serverData - ServerSchema
 * @returns An object with two properties, levelUpEmbed1 and levelUpEmbed2.
 */
async function checkLevelUps(
	interaction: ButtonInteraction<'cached'>,
	user: User,
	quid: Quid,
	quidToServer: QuidToServer,
	user2: User,
	quid2: Quid,
	quidToServer2: QuidToServer,
): Promise<{
	levelUpEmbed1: EmbedBuilder[],
	levelUpEmbed2: EmbedBuilder[];
}> {

	const members = await updateAndGetMembers(user.id, interaction.guild);
	const levelUpEmbed1 = await checkLevelUp(interaction, quid, quidToServer, members);

	const members2 = await updateAndGetMembers(user2.id, interaction.guild);
	const levelUpEmbed2 = await checkLevelUp(interaction, quid2, quidToServer2, members2);
	return { levelUpEmbed1, levelUpEmbed2 };
}

/**
 * Checks for both players whether to level them up, if they are passed out, whether to add friendship points, and if they need to be given any advice.
 */
async function checkAfterGameChanges(
	interaction: ButtonInteraction<'cached'>,
	user: User,
	quid: Quid,
	userToServer: UserToServer,
	quidToServer: QuidToServer,
	user2: User,
	quid2: Quid,
	userToServer2: UserToServer,
	quidToServer2: QuidToServer,
): Promise<void> {

	await isPassedOut(interaction, user, userToServer, quid, quidToServer, true);
	await isPassedOut(interaction, user2, userToServer2, quid2, quidToServer2, true);

	await restAdvice(interaction, user, quidToServer);
	await restAdvice(interaction, user2, quidToServer2);

	await drinkAdvice(interaction, user, quidToServer);
	await drinkAdvice(interaction, user2, quidToServer2);

	await eatAdvice(interaction, user, quidToServer);
	await eatAdvice(interaction, user2, quidToServer2);

	await addFriendshipPoints(interaction.message, quid, quid2, { serverId: interaction.guildId, userToServer, quidToServer, user });
}