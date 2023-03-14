import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ComponentType, EmbedBuilder, SlashCommandBuilder, Snowflake } from 'discord.js';
import { deepCopy, delay, getArrayElement, respond, sendErrorMessage, setCooldown } from '../../utils/helperFunctions';
import { drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { changeCondition } from '../../utils/changeCondition';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { hasFullInventory, isInteractable, isInvalid, isPassedOut } from '../../utils/checkValidity';
import { disableAllComponents } from '../../utils/componentDisabling';
import { addFriendshipPoints, checkOldMentions, getFriendshipHearts, getFriendshipPoints } from '../../utils/friendshipHandling';
import { checkLevelUp } from '../../utils/levelHandling';
import { getRandomNumber, pullFromWeightedTable } from '../../utils/randomizers';
import { remindOfAttack } from '../gameplay_primary/attack';
import { pickPlant } from '../../utils/simulateItemUse';
import { missingPermissions } from '../../utils/permissionHandler';
import { SlashCommand } from '../../typings/handle';
import { RankType } from '../../typings/data/user';
import { CommonPlantNames, RarePlantNames, SpecialPlantNames, UncommonPlantNames } from '../../typings/data/general';
import { AsyncQueue } from '@sapphire/async-queue';
import Quid from '../../models/quid';
import DiscordUser from '../../models/discordUser';
import QuidToServer from '../../models/quidToServer';
import UserToServer from '../../models/userToServer';
import { getDisplayname, getDisplayspecies, pronoun, pronounAndPlural } from '../../utils/getQuidInfo';
import User from '../../models/user';
import Friendship from '../../models/friendship';
import { Op } from 'sequelize';
import { updateAndGetMembers } from '../../utils/checkRoleRequirements';
import { specialPlantsInfo } from '../..';
const { error_color } = require('../../../config.json');

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('adventure')
		.setDescription('Go adventuring with a friend. Requires 6 friendship hearts.')
		.setDMPermission(false)
		.addUserOption(option =>
			option.setName('user')
				.setDescription('The user that you want to adventure with.')
				.setRequired(true))
		.toJSON(),
	category: 'page4',
	position: 0,
	disablePreviousCommand: true,
	modifiesServerProfile: true,
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer, server }) => {

		if (await missingPermissions(interaction, [
			'ViewChannel', interaction.channel?.isThread() ? 'SendMessagesInThreads' : 'SendMessages', 'EmbedLinks', // Needed for channel.send call in addFriendshipPoints
		]) === true) { return; }

		/* This ensures that the user is in a guild and has a completed account. */
		if (server === undefined) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (user !== undefined && (await Quid.count({ where: { userId: user.id } })) > 0) })) { return; } // This is always a reply
		if (!user) { throw new TypeError('user is undefined'); }
		if (!userToServer) { throw new TypeError('userToServer is undefined'); }
		if (!quidToServer) { throw new TypeError('quidToServer is undefined'); }

		/* Checks if the profile is resting, on a cooldown or passed out. */
		const restEmbed = await isInvalid(interaction, user, userToServer, quid, quidToServer); // This is always a reply
		if (restEmbed === false) { return; }

		/* Define messageContent as the return of remindOfAttack */
		const messageContent = remindOfAttack(interaction.guildId);

		/* Checks whether the user's inventory is full and returns if it is. */
		if (await hasFullInventory(interaction, user, userToServer, quid, quidToServer, restEmbed, messageContent)) { return; } // This is always a reply

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
					.setDescription(`*${quid.name} is looking to go on an adventure, but going alone is very dangerous. The ${getDisplayspecies(quid)} should find someone to take with ${pronoun(quid, 1)}.*`)],
			});
			return;
		}

		const user2 = discordUser2 ? await User.findByPk(discordUser2.userId) ?? undefined : undefined;
		const userToServer2 = user2 ? await UserToServer.findOne({ where: { userId: user2.id, serverId: server.id } }) ?? undefined : undefined;
		const quid2 = userToServer2?.activeQuidId ? await Quid.findByPk(userToServer2.activeQuidId) ?? undefined : undefined;
		const quidToServer2 = quid2 ? await QuidToServer.findOne({ where: { quidId: quid2.id, serverId: server.id } }) ?? undefined : undefined;
		if (!isInteractable(interaction, quid2, quidToServer2, user2, userToServer2, messageContent, restEmbed)) { return; } // This is always a reply
		if (!userToServer2) { throw new TypeError('userToServer2 is undefined'); }

		const friendship = await Friendship.findOne({
			where: {
				quidId1: { [Op.in]: [quid.id, quid2.id] },
				quidId2: { [Op.in]: [quid.id, quid2.id] },
			},
		});

		/* Check how many friendship hearts the players have and if it is less than the required amount, send an error message. */
		if (friendship) { await checkOldMentions(friendship); }
		const friendshipPoints = getFriendshipPoints(friendship?.quid1_mentions ?? [], friendship?.quid2_mentions ?? []);
		const friendshipHearts = getFriendshipHearts(friendshipPoints);
		const requiredFriendshipHearts = 6;
		if (friendshipHearts < requiredFriendshipHearts) {

			// This is always a reply
			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(error_color)
					.setTitle(`You and ${quid2.name} need at least ${requiredFriendshipHearts} ❤️ to be able to adventure together!`)
					.setDescription('You gain ❤️ by mentioning and interacting with each other. To check your friendships, type `/friendships`.'),
				],
			});
			return;
		}

		// This is always a reply
		await respond(interaction, {
			content: `${mentionedUser.toString()}\n${messageContent}`,
			embeds: [...restEmbed, new EmbedBuilder()
				.setColor(quid.color)
				.setAuthor({
					name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
					iconURL: quid.avatarURL,
				})
				.setDescription(`*${quid.name} impatiently paces at the pack borders, hoping for ${quid2.name} to come and adventure with ${pronoun(quid, 1)}.*`)
				.setFooter({ text: 'The game that is being played is memory, meaning that a player has to uncover two cards, If the emojis match, the cards are left uncovered.' })],
			components: [new ActionRowBuilder<ButtonBuilder>()
				.setComponents(new ButtonBuilder()
					.setCustomId(`adventure_confirm_@${mentionedUser.id}_@${interaction.user.id}`)
					.setLabel('Start adventure')
					.setEmoji('🧭')
					.setStyle(ButtonStyle.Success))],
		});
	},
	async sendMessageComponentResponse(interaction, { server }) {

		if (!interaction.isButton()) { return; }
		if (await missingPermissions(interaction, [
			'ViewChannel', interaction.channel?.isThread() ? 'SendMessagesInThreads' : 'SendMessages', 'EmbedLinks', // Needed for channel.send call in addFriendshipPoints
		]) === true) { return; }

		if (!interaction.customId.includes('confirm')) { return; }
		if (server === undefined) { throw new Error('server is undefined'); }
		if (!isInGuild(interaction)) { return; }
		if (interaction.channel === null) { throw new Error('Interaction channel is null'); }

		/* Gets the current active quid and the server profile from the account */
		const userId1 = getArrayElement(interaction.customId.split('_'), 3).replace('@', '');
		const discordUser = await DiscordUser.findByPk(userId1);
		const user = discordUser ? await User.findByPk(discordUser.userId) ?? undefined : undefined;
		const discordUsers = user ? (await DiscordUser.findAll({ where: { userId: user.id } })).map(du => du.id) : undefined;
		const userToServer = user ? await UserToServer.findOne({ where: { userId: user.id, serverId: server.id } }) ?? undefined : undefined;
		const quid = userToServer?.activeQuidId ? await Quid.findByPk(userToServer.activeQuidId) ?? undefined : undefined;
		const quidToServer = quid ? await QuidToServer.findOne({ where: { quidId: quid.id, serverId: server.id } }) ?? undefined : undefined;

		if (!hasNameAndSpecies(quid) || !user || !quidToServer || !userToServer || !discordUsers) { throw new Error('data of user 1 is missing'); }
		if (!userToServer || userToServer.hasCooldown === true) { return; }

		/* Gets the current active quid and the server profile from the partners account */
		const userId2 = getArrayElement(interaction.customId.split('_'), 2).replace('@', '');
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

		/* Checks if the profile is resting, on a cooldown or passed out. */
		const restEmbed1 = await isInvalid(interaction, user, userToServer, quid, quidToServer);
		const restEmbed2 = await isInvalid(interaction, user2, userToServer2, quid2, quidToServer2);
		if (restEmbed1 === false || restEmbed2 === false) { return; }

		/* For both users, set cooldowns to true, but unregister the command from being disabled, and get the condition change */
		await setCooldown(userToServer, true);
		await setCooldown(userToServer2, true);
		const decreasedStatsData1 = await changeCondition(quidToServer, quid, quidToServer.rank === RankType.Youngling ? 0 : getRandomNumber(5, quidToServer.levels + 8), undefined, true);
		const decreasedStatsData2 = await changeCondition(quidToServer2, quid2, quidToServer2.rank === RankType.Youngling ? 0 : getRandomNumber(5, quidToServer2.levels + 8), undefined, true);

		let user1IsPlaying = getRandomNumber(2) === 0 ? true : false;
		let currentData = user1IsPlaying
			? { user, quid, userToServer, quidToServer, discordUsers }
			: { user: user2, quid: quid2, userToServer: userToServer2, quidToServer: quidToServer2, discordUsers: discordUsers2 };

		/* Define the empty field emoji and the emoji options for the cards */
		const coveredField = '⬛';
		const allMemoryCardOptions = ['🌱', '🌿', '☘️', '🍀', '🍃', '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🍇', '🍊', '🫒', '🌰', '🏕️', '🌲', '🌳', '🍂', '🍁', '🍄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐁', '🦔', '🌵', '🦂', '🏜️', '🎍', '🪴', '🎋', '🪨', '🌾', '🐍', '🦎', '🐫', '🐙', '🦑', '🦀', '🐡', '🐠', '🐟', '🌊', '🐚', '🪵', '🌴'];

		/* Get an array of 10 emojis from the memory card options, each emoji added twice. */
		const chosenMemoryCardOptions: string[] = [];
		for (let i = 0; i < 10; i++) {

			const randomMemoryCardOption = getArrayElement(allMemoryCardOptions.splice(getRandomNumber(allMemoryCardOptions.length), 1), 0);
			chosenMemoryCardOptions.push(randomMemoryCardOption, randomMemoryCardOption);
		}

		/* Get an array of the clickable components, as well as an array of the emojis that would be in their places if they were revealed. */
		const componentArray: ActionRowBuilder<ButtonBuilder>[] = [];
		const emojisInComponentArray: string[][] = [];
		for (let column = 0; column < 4; column++) {

			componentArray.push(new ActionRowBuilder<ButtonBuilder>().addComponents([]));
			emojisInComponentArray.push([]);
			for (let row = 0; row < 5; row++) {

				componentArray[column]?.addComponents(new ButtonBuilder()
					.setCustomId(`board_${column}_${row}`)
					.setEmoji(coveredField)
					.setDisabled(false)
					.setStyle(ButtonStyle.Secondary),
				);

				const randomMemoryCardOption = getArrayElement(chosenMemoryCardOptions.splice(getRandomNumber(chosenMemoryCardOptions.length), 1), 0);
				emojisInComponentArray[column]?.push(randomMemoryCardOption);
			}
		}

		// This is always a reply
		let lastMessageId = await sendNextRoundMessage(interaction, user1IsPlaying ? userId1 : userId2, quid, quid2, { serverId: interaction.guildId, userToServer, quidToServer, user }, componentArray, interaction.replied);
		let lastInteraction = interaction;

		/* Define number of rounds, and the uncovered card amount for both users. */
		let finishedRounds = 0;
		type CardPositions = { column: number | null, row: number | null; };
		let chosenCardPositions: { first: CardPositions, second: CardPositions, current: 'first' | 'second'; } = { first: { column: null, row: null }, second: { column: null, row: null }, current: 'first' };
		let uncoveredCardsUser1 = 0;
		let uncoveredCardsUser2 = 0;

		const collector = interaction.channel.createMessageComponentCollector({
			componentType: ComponentType.Button,
			// This returns `reason` as 'idle' on end event
			idle: 120_000,
			filter: (i => i.customId.includes('board') && currentData.discordUsers.includes(i.user.id)),
		});
		const queue = new AsyncQueue();

		collector.on('collect', async (i) => {
			await queue.wait();
			try {

				if (!i.inCachedGuild()) { throw new Error('Interaction is not in cached guild'); }
				lastInteraction = i;
				if (!currentData.discordUsers.includes(i.user.id)) { return; }

				/* The column and row of the current card are updated with their position */
				const column = Number(i.customId.split('_')[1]);
				if (isNaN(column)) { return collector.stop('error_Error: column is Not a Number'); }
				const row = Number(i.customId.split('_')[2]);
				if (isNaN(row)) { return collector.stop('error_Error: column is Not a Number'); }
				/* This ensures that if the user clicks the same position twice, the second one isn't counted */
				if (chosenCardPositions.current === 'second' && column === chosenCardPositions.first.column && row === chosenCardPositions.first.row) { return; }
				chosenCardPositions[chosenCardPositions.current].column = column;
				chosenCardPositions[chosenCardPositions.current].row = row;

				/* Getting the uncovered emoji from the current position, and erroring if there is no emoji */
				const uncoveredEmoji = getArrayElement(getArrayElement(emojisInComponentArray, column), row);

				/* Changing the button's emoji to be the uncovered card and disabling it */
				componentArray[column]?.components[row]?.setEmoji(uncoveredEmoji);
				componentArray[column]?.components[row]?.setDisabled(true);

				// This is always an update to the message with the button
				const updatedInteraction = await respond(i, { components: chosenCardPositions.current === 'first' ? componentArray : disableAllComponents(componentArray) }, 'update', i.message.id)
					.catch((error) => {
						collector.stop(`error_${error}`);
						return undefined;
					});
				if (!updatedInteraction) { return; }

				if (chosenCardPositions.current === 'first') {

					chosenCardPositions.current = 'second';
				}
				else {

					finishedRounds += 1;
					chosenCardPositions.current = 'first';

					await delay(3_000);

					/* Getting the column and row from the first selected button */
					const firstPickColumn = chosenCardPositions.first.column;
					if (firstPickColumn === null) { return collector.stop('error_Error: firstPickColumn is null'); }
					const firstPickRow = chosenCardPositions.first.row;
					if (firstPickRow === null) { return collector.stop('error_Error: firstPickRow is null'); }

					/* Getting the column and row from the second selected button */
					const secondPickColumn = chosenCardPositions.second.column;
					if (secondPickColumn === null) { return collector.stop('error_Error: secondPickColumn is null'); }
					const secondPickRow = chosenCardPositions.second.row;
					if (secondPickRow === null) { return collector.stop('error_Error: secondPickRow is null'); }

					/* If there are no emojis or the emojis don't match, set both buttons emojis to covered fields and enable them */
					const firstPickEmoji = componentArray[firstPickColumn]?.components[firstPickRow]?.toJSON().emoji?.name;
					const secondPickEmoji = componentArray[secondPickColumn]?.components[secondPickRow]?.toJSON().emoji?.name;
					if (firstPickEmoji === undefined || secondPickEmoji === undefined || firstPickEmoji !== secondPickEmoji) {

						componentArray[firstPickColumn]?.components[firstPickRow]?.setEmoji(coveredField);
						componentArray[firstPickColumn]?.components[firstPickRow]?.setDisabled(false);

						componentArray[secondPickColumn]?.components[secondPickRow]?.setEmoji(coveredField);
						componentArray[secondPickColumn]?.components[secondPickRow]?.setDisabled(false);
					}
					else {

						user1IsPlaying ? uncoveredCardsUser1 += 1 : uncoveredCardsUser2 += 1;
					}

					chosenCardPositions = { first: { column: null, row: null }, second: { column: null, row: null }, current: 'first' }; // This is updated here because above, we are using chosenCardPositions to decide whether the buttons are going to be reset or not

					user1IsPlaying = !user1IsPlaying; // This is changed here because above, we are using user1IsPlaying to decide whether user1 should get +1 for uncovered cards or user2
					currentData = user1IsPlaying
						? { user, quid, userToServer, quidToServer, discordUsers }
						: { user: user2, quid: quid2, userToServer: userToServer2, quidToServer: quidToServer2, discordUsers: discordUsers2 };

					if (componentArray.every(actionRow => actionRow.components.every(button => button.toJSON().disabled === true))) { collector.stop('success'); }
					else if (finishedRounds >= 20) { collector.stop('roundLimit'); }
					else {

						// This is always a followUp
						lastMessageId = await sendNextRoundMessage(i, user1IsPlaying ? userId1 : userId2, quid, quid2, { serverId: interaction.guildId, userToServer, quidToServer, user }, componentArray, i.replied);
					}
				}
			}
			catch (error) {

				await sendErrorMessage(i, error)
					.catch(e => { console.error(e); });
			}
			finally {
				queue.shift();
			}
		});

		collector.on('end', async (collected, reason) => {
			queue.abortAll();
			try {

				/* Set both user's cooldown to false */
				await setCooldown(userToServer, false);
				await setCooldown(userToServer2, false);

				if (reason.startsWith('error')) {

					const errorReason = reason.split('_').slice(1).join('_') || 'An unexpected error occurred.';
					await sendErrorMessage(lastInteraction, errorReason)
						.catch((error) => { console.error(error); });
					return;
				}

				// reason idle: someone waited too long
				if (reason.includes('idle') || reason.includes('time')) {

					const levelUpEmbeds = await checkLevelUps(lastInteraction, user, quid, quidToServer, user2, quid2, quidToServer2)
						.catch((error) => { sendErrorMessage(lastInteraction, error); return null; });

					// If the collector never got triggered, a reply gets edited, and if this is triggered after the collector has been triggered at least once, it edits a followUp
					await respond(lastInteraction, {
						embeds: [
							new EmbedBuilder()
								.setColor(quid.color)
								.setAuthor({
									name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
									iconURL: quid.avatarURL,
								})
								.setDescription(`*${currentData.quid.name} decides that ${pronounAndPlural(currentData.quid, 0, 'has', 'have')} adventured enough and goes back to the pack.*`)
								.setFooter({ text: `${decreasedStatsData1.statsUpdateText}\n${decreasedStatsData2.statsUpdateText}` }),
							...decreasedStatsData1.injuryUpdateEmbed,
							...decreasedStatsData2.injuryUpdateEmbed,
							...(levelUpEmbeds?.levelUpEmbed1 ?? []),
							...(levelUpEmbeds?.levelUpEmbed2 ?? []),
						],
						components: disableAllComponents(componentArray),
					}, 'update', lastMessageId)
						.catch((error) => { sendErrorMessage(lastInteraction, error); });

					await checkAfterGameChanges(interaction, user, quid, userToServer, quidToServer, user2, quid2, userToServer2, quidToServer2)
						.catch((error) => { sendErrorMessage(lastInteraction, error); return null; });
					return;
				}

				// reason roundLimit: too many rounds went past
				if (reason.includes('roundLimit')) {

					const maxHP = getRandomNumber(5, 3);

					const pickLoss = async function(
						losingQuid: Quid,
						losingQuidToServer: QuidToServer,
					): Promise<{ extraFooter: string, outcome: string | 1 | 2; }> {

						let extraFooter = '';
						let outcome: string | 1 | 2;
						const losingHealthPoints = Math.min(maxHP, losingQuidToServer.health);

						const arr = [...losingQuidToServer.inventory];
						const obj: Record<string, number> = {};
						let maxItem: string | undefined = arr[0];
						let maxVal = 1;
						for (const v of arr) {

							obj[v] = ++obj[v] || 1;

							if (obj[v]! > maxVal) {

								maxItem = v;
								maxVal = obj[v]!;
							}
						}

						if (maxItem !== undefined && pullFromWeightedTable({ 0: 1, 1: 1 }) === 0) {

							const itemIndex = losingQuidToServer.inventory.findIndex(i => i === maxItem);
							if (itemIndex < 0) { throw new Error('item does not exist in server.inventory'); }
							await losingQuidToServer.update({ inventory: losingQuidToServer.inventory.filter((_, idx) => idx !== itemIndex) });

							extraFooter = `\n-1 ${maxItem} for ${losingQuid.name}`;
							outcome = maxItem;
						}
						else if (losingQuidToServer.injuries_cold === false && pullFromWeightedTable({ 0: 1, 1: 1 }) === 0) {

							await losingQuidToServer.update({
								injuries_cold: true,
								health: losingQuidToServer.health - losingHealthPoints,
							});

							extraFooter = `-${losingHealthPoints} HP (from cold) for ${losingQuid.name}`;
							outcome = 1;
						}
						else {

							await losingQuidToServer.update({
								injuries_wounds: losingQuidToServer.injuries_wounds + 1,
								health: losingQuidToServer.health - losingHealthPoints,
							});

							extraFooter = `-${losingHealthPoints} HP (from wound) for ${losingQuid.name}`;
							outcome = 2;
						}

						return { extraFooter, outcome };
					};

					const losingItemText = (
						{ name, item }: { name: string, item: string; },
						x: { type: 0, name2: string, item2: string; } | { type: 1, pronoun0: string, pronoun1: string; },
					): string => `${name} drops a ${item}${x.type === 0 ? ` and ${x.name2} a ${x.item2}` : ''} that ${x.type === 1 ? x.pronoun0 : 'the two animals'} had with ${x.type === 1 ? x.pronoun1 : 'them'}.`;

					const coldText = (
						x?: { name: string, pronoun0: string, pronoun1: string; },
					): string => `${x === undefined ? 'The two animals' : x.name} notice${x === undefined ? '' : 's'} that ${x === undefined ? 'they are' : x.pronoun0} feeling weak and can't stop coughing. The long jouney must've given ${x === undefined ? 'them' : x.pronoun1} a cold.`;

					const woundText = (
						x?: { name: string, pronoun0: string, pronoun1: string; },
					): string => `${x === undefined ? 'The two animals' : x.name} feel${x === undefined ? '' : 's'} blood running down ${x === undefined ? 'their' : x.pronoun0} side. The humans must've wounded ${x === undefined ? 'them' : x.pronoun1}.`;

					const { extraFooter: extraFooter1, outcome: outcome1 } = await pickLoss(quid, quidToServer);
					const { extraFooter: extraFooter2, outcome: outcome2 } = await pickLoss(quid2, quidToServer2);

					let extraDescription: string;
					if (typeof outcome1 === 'string' && typeof outcome2 === 'string') {
						extraDescription = losingItemText({ name: quid.name, item: outcome1 }, { type: 0, name2: quid.name, item2: outcome2 });
					}
					else if (outcome1 === 1 && outcome2 === 1) {
						extraDescription = coldText();
					}
					else if (outcome1 === 2 && outcome2 === 2) {
						extraDescription = woundText();
					}
					else {
						let desc1: string;
						if (outcome1 === 1) {
							desc1 = coldText({ name: quid.name, pronoun0: pronounAndPlural(quid, 0, 'is', 'are'), pronoun1: pronoun(quid, 1) });
						}
						else if (outcome1 === 2) {
							desc1 = woundText({ name: quid.name, pronoun0: pronoun(quid, 2), pronoun1: pronoun(quid, 0) });
						}
						else {
							desc1 = losingItemText({ name: quid.name, item: outcome1 }, { type: 1, pronoun0: pronoun(quid, 0), pronoun1: pronoun(quid, 1) });
						}

						let desc2: string;
						if (outcome2 === 1) {
							desc2 = coldText({ name: quid.name, pronoun0: pronounAndPlural(quid2, 0, 'is', 'are'), pronoun1: pronoun(quid2, 1) });
						}
						else if (outcome2 === 2) {
							desc2 = woundText({ name: quid.name, pronoun0: pronoun(quid2, 2), pronoun1: pronoun(quid2, 0) });
						}
						else {
							desc2 = losingItemText({ name: quid.name, item: outcome2 }, { type: 1, pronoun0: pronoun(quid2, 0), pronoun1: pronoun(quid2, 1) });
						}

						extraDescription = `${desc1} Also, ${desc2}`;
					}

					const levelUpEmbeds = await checkLevelUps(lastInteraction, user, quid, quidToServer, user2, quid2, quidToServer2)
						.catch((error) => { sendErrorMessage(lastInteraction, error); return null; });

					// This is always an editReply on the updated message with the button
					await respond(lastInteraction, {
						embeds: [
							new EmbedBuilder()
								.setColor(quid.color)
								.setAuthor({
									name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
									iconURL: quid.avatarURL,
								})
								.setDescription(`*The adventure didn't go as planned. Not only did the two animals get lost, they also had to run from humans. While running, ${quid.name} ${extraDescription} What a shame!*`)
								.setFooter({ text: `${decreasedStatsData1.statsUpdateText}\n${decreasedStatsData2.statsUpdateText}\n\n${extraFooter1}\n${extraFooter2}` }),
							...decreasedStatsData1.injuryUpdateEmbed,
							...decreasedStatsData2.injuryUpdateEmbed,
							...(levelUpEmbeds?.levelUpEmbed1 ?? []),
							...(levelUpEmbeds?.levelUpEmbed2 ?? []),
						],
						components: disableAllComponents(componentArray),
					}, 'update', lastMessageId)
						.catch((error) => { sendErrorMessage(lastInteraction, error); });


					await checkAfterGameChanges(interaction, user, quid, userToServer, quidToServer, user2, quid2, userToServer2, quidToServer2)
						.catch((error) => { sendErrorMessage(lastInteraction, error); return null; });
					return;
				}

				// reason success: every card has been uncovered
				if (reason.includes('success')) {

					const maxHP = getRandomNumber(5, 8);

					const pickGain = async function(
						winningQuidToServer: QuidToServer,
					): Promise<{ foundItem: SpecialPlantNames | RarePlantNames | UncommonPlantNames | CommonPlantNames | null, extraHealthPoints: number; }> {

						let foundItem: SpecialPlantNames | RarePlantNames | UncommonPlantNames | CommonPlantNames | null = null;
						let extraHealthPoints = 0;

						if (pullFromWeightedTable({ 0: 20 - finishedRounds, 1: finishedRounds - 10 }) === 0) {

							const specialPlants = Object.keys(specialPlantsInfo) as SpecialPlantNames[];
							foundItem = specialPlants[getRandomNumber(specialPlants.length)]!;

							const newInv = deepCopy(winningQuidToServer.inventory);
							newInv.push(foundItem);
							await winningQuidToServer.update({ inventory: newInv });
						}
						else if (winningQuidToServer.health < winningQuidToServer.maxHealth) {

							extraHealthPoints = Math.min(maxHP, winningQuidToServer.maxHealth - winningQuidToServer.health);
							await winningQuidToServer.update({ health: winningQuidToServer.health + extraHealthPoints });
						}
						else {

							foundItem = await pickPlant(pullFromWeightedTable({ 0: finishedRounds + 10, 1: (2 * finishedRounds) - 10, 2: (20 - finishedRounds) * 3 }) as 0 | 1 | 2, server);

							const newInv = deepCopy(winningQuidToServer.inventory);
							newInv.push(foundItem);
							await winningQuidToServer.update({ inventory: newInv });
						}

						return { foundItem, extraHealthPoints };
					};

					const healthText = function(
						{ type, name }: {type: 0 | 1, name: string},
					) {
						return `${name} feel${type === 0 ? 's' : ''} especially refreshed from this trip`;
					};

					const itemText = function(
						{ name, item }: { name: string, item: string; },
						x?: {name: string, item: string},
					) {
						return `${name} even found a ${item} on the way${x === undefined ? '' : `, and ${x.name} a ${x.item}`}`;
					};

					const { foundItem: foundItem1, extraHealthPoints: extraHealthPoints1 } = await pickGain(quidToServer);
					const { foundItem: foundItem2, extraHealthPoints: extraHealthPoints2 } = await pickGain(quidToServer2);

					let extraDescription: string;
					if (foundItem1 === null && foundItem2 === null) {
						extraDescription = healthText({ type: 1, name: 'They' });
					}
					else if (foundItem1 !== null && foundItem2 !== null) {
						extraDescription = itemText({ name: quid.name, item: foundItem1 }, { name: quid.name, item: foundItem2 });
					}
					else {
						let desc1: string;
						if (foundItem1 === null) {
							desc1 = healthText({ type: 0, name: quid.name });
						}
						else {
							desc1 = itemText({ name: quid.name, item: foundItem1 });
						}

						let desc2: string;
						if (foundItem2 === null) {
							desc2 = healthText({ type: 0, name: quid.name });
						}
						else {
							desc2 = itemText({ name: quid.name, item: foundItem2 });
						}

						extraDescription = `${desc1}, and ${desc2}`;
					}


					const levelUpEmbeds = await checkLevelUps(lastInteraction, user, quid, quidToServer, user2, quid2, quidToServer2)
						.catch((error) => { sendErrorMessage(lastInteraction, error); });

					// This is always an editReply on the updated message with the button
					await respond(lastInteraction, {
						embeds: [
							new EmbedBuilder()
								.setColor(quid.color)
								.setAuthor({
									name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
									iconURL: quid.avatarURL,
								})
								.setDescription(`*The two animals laugh as they return from a successful adventure. ${extraDescription}. What a success!*`)
								.setFooter({ text: `${decreasedStatsData1.statsUpdateText}\n${decreasedStatsData2.statsUpdateText}\n\n${extraHealthPoints1 > 0 ? `+${extraHealthPoints1} HP for ${quid.name} (${quidToServer.health}/${quidToServer.maxHealth})` : `+1 ${foundItem1} for ${quid.name}`}\n${extraHealthPoints2 > 0 ? `+${extraHealthPoints2} HP for ${quid2.name} (${quidToServer2.health}/${quidToServer2.maxHealth})` : `+1 ${foundItem2} for ${quid2.name}`}` }),
							...decreasedStatsData1.injuryUpdateEmbed,
							...decreasedStatsData2.injuryUpdateEmbed,
							...(levelUpEmbeds?.levelUpEmbed1 ?? []),
							...(levelUpEmbeds?.levelUpEmbed2 ?? []),
						],
						components: disableAllComponents(componentArray),
					}, 'update', lastMessageId)
						.catch((error) => { sendErrorMessage(lastInteraction, error); });

					await checkAfterGameChanges(interaction, user, quid, userToServer, quidToServer, user2, quid2, userToServer2, quidToServer2)
						.catch((error) => { sendErrorMessage(lastInteraction, error); return null; });
					return;
				}
			}
			catch (error) {

				await sendErrorMessage(lastInteraction, error)
					.catch(e => { console.error(e); });
			}
		});

	},
};

/**
 * It sends a message to the channel that the interaction was sent in
 * @param interaction - The interaction object that was passed to the command.
 * @param userId - The user ID of the user who will play the next round
 * @param quid - The first quid's data.
 * @param quid2 - The other quid's data.
 * @param componentArray - This is an array of ActionRowBuilder<ButtonBuilder> objects.
 */
async function sendNextRoundMessage(
	interaction: ButtonInteraction<'cached'>,
	userId: string,
	quid: Quid,
	quid2: Quid,
	displaynameOptions: Parameters<typeof getDisplayname>[1],
	componentArray: ActionRowBuilder<ButtonBuilder>[],
	isReplied: boolean,
): Promise<Snowflake> {

	// This is a reply the first time, and a followUp every other time
	const { id } = await respond(interaction, {
		content: `<@${userId}>`,
		embeds: [new EmbedBuilder()
			.setColor(quid.color)
			.setAuthor({
				name: await getDisplayname(quid, displaynameOptions),
				iconURL: quid.avatarURL,
			})
			.setDescription(`*The two animals are strolling around. ${quid2.name} notices something behind a plant and goes to take a closer look.*`)],
		components: componentArray,
	});

	if (isReplied) { await interaction.webhook.deleteMessage('@original'); }
	else { await interaction.message.delete(); }

	return id;
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