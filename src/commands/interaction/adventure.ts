import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ComponentType, EmbedBuilder, SlashCommandBuilder, Snowflake } from 'discord.js';
import { delay, getArrayElement, getSmallerNumber, keyInObject, KeyOfUnion, respond, sendErrorMessage, setCooldown, widenValues } from '../../utils/helperFunctions';
import { drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { changeCondition } from '../../utils/changeCondition';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { hasFullInventory, isInteractable, isInvalid, isPassedOut } from '../../utils/checkValidity';
import { saveCommandDisablingInfo, disableAllComponents, deleteCommandDisablingInfo } from '../../utils/componentDisabling';
import { addFriendshipPoints, checkOldMentions, getFriendshipHearts, getFriendshipPoints } from '../../utils/friendshipHandling';
import { getMapData } from '../../utils/helperFunctions';
import { checkLevelUp } from '../../utils/levelHandling';
import { getRandomNumber, pullFromWeightedTable } from '../../utils/randomizers';
import { getHighestItem, remindOfAttack } from '../gameplay_primary/attack';
import { pickPlant } from '../../utils/simulateItemUse';
import { missingPermissions } from '../../utils/permissionHandler';
import { SlashCommand } from '../../typings/handle';
import { userModel, getUserData } from '../../models/userModel';
import { ServerSchema } from '../../typings/data/server';
import { CurrentRegionType, RankType, UserData } from '../../typings/data/user';
import { Inventory, SpecialPlantNames } from '../../typings/data/general';
import { AsyncQueue } from '@sapphire/async-queue';
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
	sendCommand: async (interaction, userData1) => {

		if (await missingPermissions(interaction, [
			'ViewChannel', // Needed because of createCommandComponentDisabler
			/* 'ViewChannel',*/ interaction.channel?.isThread() ? 'SendMessagesInThreads' : 'SendMessages', 'EmbedLinks', // Needed for channel.send call in addFriendshipPoints
		]) === true) { return; }

		/* This ensures that the user is in a guild and has a completed account. */
		if (!isInGuild(interaction) || !hasNameAndSpecies(userData1, interaction)) { return; } // This is always a reply

		/* Checks if the profile is resting, on a cooldown or passed out. */
		const restEmbed = await isInvalid(interaction, userData1); // This is always a reply
		if (restEmbed === false) { return; }

		/* Define messageContent as the return of remindOfAttack */
		const messageContent = remindOfAttack(interaction.guildId);

		/* Checks whether the user's inventory is full and returns if it is. */
		if (await hasFullInventory(interaction, userData1, restEmbed, messageContent)) { return; } // This is always a reply

		/* Gets the mentioned user. */
		const mentionedUser = interaction.options.getUser('user');
		if (mentionedUser === null) { throw new TypeError('mentionedUser is null1'); }

		/* Checks whether the mentioned user is associated with the account. */
		if (Object.keys(userData1.userIds).includes(mentionedUser.id)) {

			// This is always a reply
			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(userData1.quid.color)
					.setAuthor({ name: userData1.quid.getDisplayname(), iconURL: userData1.quid.avatarURL })
					.setDescription(`*${userData1.quid.name} is looking to go on an adventure, but going alone is very dangerous. The ${userData1.quid.getDisplayspecies()} should find someone to take with ${userData1.quid.pronoun(1)}.*`)],
			});
			return;
		}

		/* Define the partners user data, check if the user is interactable, and if they are, define quid data and profile data. */
		const _userData2 = await userModel.findOne(u => Object.keys(u.userIds).includes(mentionedUser.id));
		const userData2 = getUserData(_userData2, interaction.guildId, getMapData(_userData2.quids, getMapData(_userData2.servers, interaction.guildId).currentQuid ?? ''));
		if (!isInteractable(interaction, userData2, messageContent, restEmbed)) { return; } // This is always a reply

		/* Check how many friendship hearts the players have and if it is less than the required amount, send an error message. */
		await checkOldMentions(userData1, userData2);
		const friendshipPoints = getFriendshipPoints(userData1.quid.mentions[userData2.quid._id] || [], userData2.quid.mentions[userData1.quid._id] || []);
		const friendshipHearts = getFriendshipHearts(friendshipPoints);
		const requiredFriendshipHearts = 6;
		if (friendshipHearts < requiredFriendshipHearts) {

			// This is always a reply
			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(error_color)
					.setTitle(`You and ${userData2.quid.name} need at least ${requiredFriendshipHearts} ❤️ to be able to adventure together!`)
					.setDescription('You gain ❤️ by mentioning and interacting with each other. To check your friendships, type `/friendships`.'),
				],
			});
			return;
		}

		// This is always a reply
		const botReply = await respond(interaction, {
			content: `${mentionedUser.toString()}\n${messageContent}`,
			embeds: [...restEmbed, new EmbedBuilder()
				.setColor(userData1.quid.color)
				.setAuthor({ name: userData1.quid.getDisplayname(), iconURL: userData1.quid.avatarURL })
				.setDescription(`*${userData1.quid.name} impatiently paces at the pack borders, hoping for ${userData2.quid.name} to come and adventure with ${userData1.quid.pronoun(1)}.*`)
				.setFooter({ text: 'The game that is being played is memory, meaning that a player has to uncover two cards, If the emojis match, the cards are left uncovered.' })],
			components: [new ActionRowBuilder<ButtonBuilder>()
				.setComponents(new ButtonBuilder()
					.setCustomId(`adventure_confirm_@${mentionedUser.id}_@${interaction.user.id}`)
					.setLabel('Start adventure')
					.setEmoji('🧭')
					.setStyle(ButtonStyle.Success))],
			fetchReply: true,
		});

		/* Register the command to be disabled when another command is executed, for both players */
		saveCommandDisablingInfo(userData1, interaction.guildId, interaction.channelId, botReply.id, interaction);
		saveCommandDisablingInfo(userData2, interaction.guildId, interaction.channelId, botReply.id, interaction);
	},
	async sendMessageComponentResponse(interaction, userData, serverData) {

		if (!interaction.isButton()) { return; }
		if (await missingPermissions(interaction, [
			'ViewChannel', interaction.channel?.isThread() ? 'SendMessagesInThreads' : 'SendMessages', 'EmbedLinks', // Needed for channel.send call in addFriendshipPoints
		]) === true) { return; }

		if (!interaction.customId.includes('confirm')) { return; }
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction)) { return; }
		if (interaction.channel === null) { throw new Error('Interaction channel is null'); }

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


		/* Gets the current active quid and the server profile from the account */
		const userId1 = getArrayElement(interaction.customId.split('_'), 3).replace('@', '');
		const _userData1 = await userModel.findOne(u => Object.keys(u.userIds).includes(userId1));
		const userData1 = getUserData(_userData1, interaction.guildId, getMapData(_userData1.quids, getMapData(_userData1.servers, interaction.guildId).currentQuid ?? ''));
		if (!hasNameAndSpecies(userData1)) { throw new Error('userData1.quid.species is empty string'); }
		if (userData1.serverInfo?.hasCooldown === true) { return; }

		/* Gets the current active quid and the server profile from the partners account */
		const userId2 = getArrayElement(interaction.customId.split('_'), 2).replace('@', '');
		const _userData2 = await userModel.findOne(u => Object.keys(u.userIds).includes(userId2));
		const userData2 = getUserData(_userData2, interaction.guildId, getMapData(_userData2.quids, getMapData(_userData2.servers, interaction.guildId).currentQuid ?? ''));
		if (!hasNameAndSpecies(userData2)) { throw new Error('userData2.quid.species is empty string'); }
		if (userData2.serverInfo?.hasCooldown === true) { return; }

		if (Object.keys(userData1.userIds).includes(interaction.user.id)) {

			// This is always a reply
			await respond(interaction, {
				content: 'You can\'t accept your own invitation!',
				ephemeral: true,
			});
			return;
		}

		/* For both users, set cooldowns to true, but unregister the command from being disabled, and get the condition change */
		await setCooldown(userData1, interaction.guildId, true);
		await setCooldown(userData2, interaction.guildId, true);
		deleteCommandDisablingInfo(userData1, interaction.guildId);
		deleteCommandDisablingInfo(userData2, interaction.guildId);
		const decreasedStatsData1 = await changeCondition(userData1, userData1.quid.profile.rank === RankType.Youngling ? 0 : getRandomNumber(5, userData1.quid.profile.levels + 8), CurrentRegionType.Prairie, true);
		const decreasedStatsData2 = await changeCondition(userData2, userData2.quid.profile.rank === RankType.Youngling ? 0 : getRandomNumber(5, userData2.quid.profile.levels + 8), CurrentRegionType.Prairie, true);

		/* Define number of rounds, and the uncovered card amount for both users. */
		let finishedRounds = 0;
		type CardPositions = { column: number | null, row: number | null; };
		let chosenCardPositions: { first: CardPositions, second: CardPositions, current: 'first' | 'second'; } = { first: { column: null, row: null }, second: { column: null, row: null }, current: 'first' };
		let uncoveredCardsUser1 = 0;
		let uncoveredCardsUser2 = 0;

		let user1IsPlaying = getRandomNumber(2) === 0 ? true : false;
		let userDataCurrent = user1IsPlaying ? userData1 : userData2;

		// This is always a reply
		let lastMessageId = await sendNextRoundMessage(interaction, user1IsPlaying ? userId1 : userId2, userData1, userData2, componentArray, interaction.replied);
		let lastInteraction = interaction;

		const collector = interaction.channel.createMessageComponentCollector({
			componentType: ComponentType.Button,
			// This returns `reason` as 'idle' on end event
			idle: 120_000,
			filter: (i => i.customId.includes('board') && Object.keys(userDataCurrent.userIds).includes(i.user.id)),
		});
		const queue = new AsyncQueue();

		collector.on('collect', async (i) => {
			await queue.wait();
			try {

				if (!i.inCachedGuild()) { throw new Error('Interaction is not in cached guild'); }
				lastInteraction = i;
				if (!Object.keys(userDataCurrent.userIds).includes(i.user.id)) { return; }

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
				const updatedInteraction = await respond(i, { components: chosenCardPositions.current === 'first' ? componentArray : disableAllComponents(componentArray) }, 'update', '@original')
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
					userDataCurrent = user1IsPlaying ? userData1 : userData2;

					if (componentArray.every(actionRow => actionRow.components.every(button => button.toJSON().disabled === true))) { collector.stop('success'); }
					else if (finishedRounds >= 20) { collector.stop('roundLimit'); }
					else {

						// This is always a followUp
						lastMessageId = await sendNextRoundMessage(i, user1IsPlaying ? userId1 : userId2, userData1, userData2, componentArray, i.replied);
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
				await setCooldown(userData1, interaction.guildId, false);
				await setCooldown(userData2, interaction.guildId, false);

				if (reason.startsWith('error')) {

					const errorReason = reason.split('_').slice(1).join('_') || 'An unexpected error occurred.';
					await sendErrorMessage(lastInteraction, errorReason)
						.catch((error) => { console.error(error); });
					return;
				}

				// reason idle: someone waited too long
				if (reason.includes('idle') || reason.includes('time')) {

					const levelUpEmbeds = await checkLevelUps(lastInteraction, userData1, userData2, serverData)
						.catch((error) => { sendErrorMessage(lastInteraction, error); return null; });

					// If the collector never got triggered, a reply gets edited, and if this is triggered after the collector has been triggered at least once, it edits a followUp
					await respond(lastInteraction, {
						embeds: [
							new EmbedBuilder()
								.setColor(userData1.quid.color)
								.setAuthor({ name: userData1.quid.getDisplayname(), iconURL: userData1.quid.avatarURL })
								.setDescription(`*${userDataCurrent.quid.name} decides that ${userDataCurrent.quid.pronounAndPlural(0, 'has', 'have')} adventured enough and goes back to the pack.*`)
								.setFooter({ text: `${decreasedStatsData1.statsUpdateText}\n${decreasedStatsData2.statsUpdateText}` }),
							...decreasedStatsData1.injuryUpdateEmbed,
							...decreasedStatsData2.injuryUpdateEmbed,
							...(levelUpEmbeds?.levelUpEmbed1 ?? []),
							...(levelUpEmbeds?.levelUpEmbed2 ?? []),
						],
						components: disableAllComponents(componentArray),
					}, 'update', lastMessageId)
						.catch((error) => { sendErrorMessage(lastInteraction, error); });

					await checkAfterGameChanges(interaction, userData1, userData2)
						.catch((error) => { sendErrorMessage(lastInteraction, error); return null; });
					return;
				}

				// reason roundLimit: too many rounds went past
				if (reason.includes('roundLimit')) {

					const maxHP = getRandomNumber(5, 3);

					const pickLoss = function(
						losingUserData: UserData<never, never>,
					): { extraFooter: string, outcome: string | 1 | 2; } {

						let extraFooter = '';
						let outcome: string | 1 | 2;
						const losingHealthPoints = getSmallerNumber(maxHP, losingUserData.quid.profile.health);

						const { itemType, itemName } = getHighestItem(losingUserData.quid.profile.inventory);
						const inventory_ = widenValues(losingUserData.quid.profile.inventory);
						if (itemType && itemName && pullFromWeightedTable({ 0: 1, 1: 1 }) === 0) {

							inventory_[itemType][itemName] -= 1;
							extraFooter = `-1 ${itemName} for ${losingUserData.quid.name}`;
							outcome = itemName;
						}
						else if (losingUserData.quid.profile.injuries.cold === false && pullFromWeightedTable({ 0: 1, 1: 1 }) === 0) {

							losingUserData.quid.profile.injuries.cold = true;
							extraFooter = `-${losingHealthPoints} HP (from cold) for ${losingUserData.quid.name}`;
							outcome = 1;
						}
						else {

							losingUserData.quid.profile.injuries.wounds += 1;
							extraFooter = `-${losingHealthPoints} HP (from wound) for ${losingUserData.quid.name}`;
							outcome = 2;
						}

						losingUserData.update(
							(u => {
								const p = getMapData(getMapData(u.quids, getMapData(u.servers, lastInteraction.guildId).currentQuid ?? '').profiles, lastInteraction.guildId);
								p.inventory = inventory_;
								p.health -= losingHealthPoints;
								p.injuries = losingUserData.quid.profile.injuries;
							}),
						);

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

					const { extraFooter: extraFooter1, outcome: outcome1 } = pickLoss(userData1);
					const { extraFooter: extraFooter2, outcome: outcome2 } = pickLoss(userData2);

					let extraDescription: string;
					if (typeof outcome1 === 'string' && typeof outcome2 === 'string') {
						extraDescription = losingItemText({ name: userData1.quid.name, item: outcome1 }, { type: 0, name2: userData2.quid.name, item2: outcome2 });
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
							desc1 = coldText({ name: userData1.quid.name, pronoun0: userData1.quid.pronounAndPlural(0, 'is', 'are'), pronoun1: userData1.quid.pronoun(1) });
						}
						else if (outcome1 === 2) {
							desc1 = woundText({ name: userData1.quid.name, pronoun0: userData1.quid.pronoun(2), pronoun1: userData1.quid.pronoun(0) });
						}
						else {
							desc1 = losingItemText({ name: userData1.quid.name, item: outcome1 }, { type: 1, pronoun0: userData1.quid.pronoun(0), pronoun1: userData1.quid.pronoun(1) });
						}

						let desc2: string;
						if (outcome2 === 1) {
							desc2 = coldText({ name: userData2.quid.name, pronoun0: userData2.quid.pronounAndPlural(0, 'is', 'are'), pronoun1: userData2.quid.pronoun(1) });
						}
						else if (outcome2 === 2) {
							desc2 = woundText({ name: userData2.quid.name, pronoun0: userData2.quid.pronoun(2), pronoun1: userData2.quid.pronoun(0) });
						}
						else {
							desc2 = losingItemText({ name: userData2.quid.name, item: outcome2 }, { type: 1, pronoun0: userData2.quid.pronoun(0), pronoun1: userData2.quid.pronoun(1) });
						}

						extraDescription = `${desc1} Also, ${desc2}`;
					}

					const levelUpEmbeds = await checkLevelUps(lastInteraction, userData1, userData2, serverData)
						.catch((error) => { sendErrorMessage(lastInteraction, error); return null; });

					// This is always an editReply on the updated message with the button
					await respond(lastInteraction, {
						embeds: [
							new EmbedBuilder()
								.setColor(userData1.quid.color)
								.setAuthor({ name: userData1.quid.getDisplayname(), iconURL: userData1.quid.avatarURL })
								.setDescription(`*The adventure didn't go as planned. Not only did the two animals get lost, they also had to run from humans. While running, ${userData1.quid.name} ${extraDescription} What a shame!*`)
								.setFooter({ text: `${decreasedStatsData1.statsUpdateText}\n${decreasedStatsData2.statsUpdateText}\n\n${extraFooter1}\n${extraFooter2}` }),
							...decreasedStatsData1.injuryUpdateEmbed,
							...decreasedStatsData2.injuryUpdateEmbed,
							...(levelUpEmbeds?.levelUpEmbed1 ?? []),
							...(levelUpEmbeds?.levelUpEmbed2 ?? []),
						],
						components: disableAllComponents(componentArray),
					}, 'update', lastMessageId)
						.catch((error) => { sendErrorMessage(lastInteraction, error); });


					await checkAfterGameChanges(interaction, userData1, userData2)
						.catch((error) => { sendErrorMessage(lastInteraction, error); return null; });
					return;
				}

				// reason success: every card has been uncovered
				if (reason.includes('success')) {

					const maxHP = getRandomNumber(5, 8);

					const pickGain = async function(
						winningUserData: UserData<never, never>,
					): Promise<{ foundItem: KeyOfUnion<Inventory[keyof Inventory]> | null, extraHealthPoints: number; }> {

						let foundItem: KeyOfUnion<Inventory[keyof Inventory]> | null = null;
						let extraHealthPoints = 0;

						if (winningUserData.quid.profile.health < winningUserData.quid.profile.maxHealth) {

							extraHealthPoints = getSmallerNumber(maxHP, winningUserData.quid.profile.maxHealth - winningUserData.quid.profile.health);
						}
						else if (pullFromWeightedTable({ 0: 20 - finishedRounds, 1: finishedRounds - 10 }) === 0) {

							const specialPlants = Object.keys(serverData.inventory.specialPlants) as SpecialPlantNames[];
							foundItem = specialPlants[getRandomNumber(specialPlants.length)]!;
							winningUserData.quid.profile.inventory.specialPlants[foundItem] += 1;
						}
						else {

							foundItem = await pickPlant(pullFromWeightedTable({ 0: finishedRounds + 10, 1: (2 * finishedRounds) - 10, 2: (20 - finishedRounds) * 3 }) as 0 | 1 | 2, serverData);
							if (keyInObject(winningUserData.quid.profile.inventory.commonPlants, foundItem)) { winningUserData.quid.profile.inventory.commonPlants[foundItem] += 1; }
							else if (keyInObject(winningUserData.quid.profile.inventory.uncommonPlants, foundItem)) { winningUserData.quid.profile.inventory.uncommonPlants[foundItem] += 1; }
							else { winningUserData.quid.profile.inventory.rarePlants[foundItem] += 1; }
						}

						winningUserData.update(
							(u => {
								const p = getMapData(getMapData(u.quids, getMapData(u.servers, lastInteraction.guildId).currentQuid ?? '').profiles, lastInteraction.guildId);
								p.inventory = winningUserData.quid.profile.inventory;
								p.health += extraHealthPoints;
							}),
						);

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

					const { foundItem: foundItem1, extraHealthPoints: extraHealthPoints1 } = await pickGain(userData1);
					const { foundItem: foundItem2, extraHealthPoints: extraHealthPoints2 } = await pickGain(userData2);

					let extraDescription: string;
					if (foundItem1 === null && foundItem2 === null) {
						extraDescription = healthText({ type: 1, name: 'They' });
					}
					else if (foundItem1 !== null && foundItem2 !== null) {
						extraDescription = itemText({ name: userData1.quid.name, item: foundItem1 }, { name: userData2.quid.name, item: foundItem2 });
					}
					else {
						let desc1: string;
						if (foundItem1 === null) {
							desc1 = healthText({ type: 0, name: userData1.quid.name });
						}
						else {
							desc1 = itemText({ name: userData1.quid.name, item: foundItem1 });
						}

						let desc2: string;
						if (foundItem2 === null) {
							desc2 = healthText({ type: 0, name: userData2.quid.name });
						}
						else {
							desc2 = itemText({ name: userData2.quid.name, item: foundItem2 });
						}

						extraDescription = `${desc1}, and ${desc2}`;
					}


					const levelUpEmbeds = await checkLevelUps(lastInteraction, userData1, userData2, serverData)
						.catch((error) => { sendErrorMessage(lastInteraction, error); });

					// This is always an editReply on the updated message with the button
					await respond(lastInteraction, {
						embeds: [
							new EmbedBuilder()
								.setColor(userData1.quid.color)
								.setAuthor({ name: userData1.quid.getDisplayname(), iconURL: userData1.quid.avatarURL })
								.setDescription(`*The two animals laugh as they return from a successful adventure. ${extraDescription}. What a success!*`)
								.setFooter({ text: `${decreasedStatsData1.statsUpdateText}\n${decreasedStatsData2.statsUpdateText}\n\n${extraHealthPoints1 > 0 ? `+${extraHealthPoints1} HP for ${userData1.quid.name} (${userData1.quid.profile.health}/${userData1.quid.profile.maxHealth})` : `+1 ${foundItem1} for ${userData1.quid.name}`}\n${extraHealthPoints2 > 0 ? `+${extraHealthPoints2} HP for ${userData2.quid.name} (${userData2.quid.profile.health}/${userData2.quid.profile.maxHealth})` : `+1 ${foundItem2} for ${userData2.quid.name}`}` }),
							...decreasedStatsData1.injuryUpdateEmbed,
							...decreasedStatsData2.injuryUpdateEmbed,
							...(levelUpEmbeds?.levelUpEmbed1 ?? []),
							...(levelUpEmbeds?.levelUpEmbed2 ?? []),
						],
						components: disableAllComponents(componentArray),
					}, 'update', lastMessageId)
						.catch((error) => { sendErrorMessage(lastInteraction, error); });

					await checkAfterGameChanges(interaction, userData1, userData2)
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
 * @param userData1.quid - The first quid's data.
 * @param userData2.quid - The other quid's data.
 * @param componentArray - This is an array of ActionRowBuilder<ButtonBuilder> objects.
 */
async function sendNextRoundMessage(
	interaction: ButtonInteraction<'cached'>,
	userId: string,
	userData1: UserData<never, never>,
	userData2: UserData<never, never>,
	componentArray: ActionRowBuilder<ButtonBuilder>[],
	isReplied: boolean,
): Promise<Snowflake> {

	// This is a reply the first time, and a followUp every other time
	const { id } = await respond(interaction, {
		content: `<@${userId}>`,
		embeds: [new EmbedBuilder()
			.setColor(userData1.quid.color)
			.setAuthor({ name: userData1.quid.getDisplayname(), iconURL: userData1.quid.avatarURL })
			.setDescription(`*The two animals are strolling around. ${userData2.quid.name} notices something behind a plant and goes to take a closer look.*`)],
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
	userData1: UserData<never, never>,
	userData2: UserData<never, never>,
	serverData: ServerSchema,
): Promise<{
	levelUpEmbed1: EmbedBuilder[],
	levelUpEmbed2: EmbedBuilder[];
}> {

	const levelUpEmbed1 = await checkLevelUp(interaction, userData1, serverData);
	const levelUpEmbed2 = await checkLevelUp(interaction, userData2, serverData);
	return { levelUpEmbed1, levelUpEmbed2 };
}

/**
 * Checks for both players whether to level them up, if they are passed out, whether to add friendship points, and if they need to be given any advice.
 */
async function checkAfterGameChanges(
	interaction: ButtonInteraction<'cached'>,
	userData1: UserData<never, never>,
	userData2: UserData<never, never>,
): Promise<void> {

	await isPassedOut(interaction, userData1, true);
	await isPassedOut(interaction, userData2, true);

	await restAdvice(interaction, userData1);
	await restAdvice(interaction, userData2);

	await drinkAdvice(interaction, userData1);
	await drinkAdvice(interaction, userData2);

	await eatAdvice(interaction, userData1);
	await eatAdvice(interaction, userData2);

	await addFriendshipPoints(interaction.message, userData1, userData2);
}