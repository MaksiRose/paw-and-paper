import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ComponentType, EmbedBuilder, Message, SlashCommandBuilder } from 'discord.js';
import { getArrayElement, getSmallerNumber, keyInObject, KeyOfUnion, sendErrorMessage, setCooldown, update, widenValues } from '../../utils/helperFunctions';
import { respond } from '../../utils/helperFunctions';
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
import userModel, { getUserData } from '../../models/userModel';
import { ServerSchema } from '../../typings/data/server';
import { CurrentRegionType, UserData } from '../../typings/data/user';
import { Inventory, SpecialPlantNames } from '../../typings/data/general';
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
		if (!isInGuild(interaction) || !hasNameAndSpecies(userData1, interaction)) { return; }

		/* Checks if the profile is resting, on a cooldown or passed out. */
		const restEmbed = await isInvalid(interaction, userData1);
		if (restEmbed === false) { return; }

		/* Define messageContent as the return of remindOfAttack */
		const messageContent = remindOfAttack(interaction.guildId);

		/* Checks whether the user's inventory is full and returns if it is. */
		if (await hasFullInventory(interaction, userData1, restEmbed, messageContent)) { return; }

		/* Gets the mentioned user. */
		const mentionedUser = interaction.options.getUser('user');
		if (mentionedUser === null) { throw new TypeError('mentionedUser is null1'); }

		/* Checks whether the mentioned user is associated with the account. */
		if (userData1.userId.includes(mentionedUser.id)) {

			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(userData1.quid.color)
					.setAuthor({ name: userData1.quid.getDisplayname(), iconURL: userData1.quid.avatarURL })
					.setDescription(`*${userData1.quid.name} is looking to go on an adventure, but going alone is very dangerous. The ${userData1.quid.getDisplayspecies()} should find someone to take with ${userData1.quid.pronoun(1)}.*`)],
			}, false);
			return;
		}

		/* Define the partners user data, check if the user is interactable, and if they are, define quid data and profile data. */
		const _userData2 = await userModel.findOne(u => u.userId.includes(mentionedUser.id));
		const userData2 = getUserData(_userData2, interaction.guildId, getMapData(_userData2.quids, getMapData(_userData2.currentQuid, interaction.guildId)));
		if (!isInteractable(interaction, userData2, messageContent, restEmbed)) { return; }

		/* Check how many friendship hearts the players have and if it is less than the required amount, send an error message. */
		await checkOldMentions(userData1, userData2);
		const friendshipPoints = getFriendshipPoints(userData1.quid.mentions[userData2.quid._id] || [], userData2.quid.mentions[userData1.quid._id] || []);
		const friendshipHearts = getFriendshipHearts(friendshipPoints);
		const requiredFriendshipHearts = 6;
		if (friendshipHearts < requiredFriendshipHearts) {

			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(error_color)
					.setTitle(`You and ${userData2.quid.name} need at least ${requiredFriendshipHearts} ❤️ to be able to adventure together!`)
					.setDescription('You gain ❤️ by mentioning and interacting with each other. To check your friendships, type `/friendships`.'),
				],
			}, false);
			return;
		}

		/* Sending a message asking the other player if they want to play, with a button to start the adventure. */
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
		}, true);

		/* Register the command to be disabled when another command is executed, for both players */
		saveCommandDisablingInfo(userData1, interaction.guildId, interaction.channelId, botReply.id);
		saveCommandDisablingInfo(userData2, interaction.guildId, interaction.channelId, botReply.id);
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
					.setCustomId(`adventure_board_${column}_${row}`)
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
		const _userData1 = await userModel.findOne(u => u.userId.includes(userId1));
		const userData1 = getUserData(_userData1, interaction.guildId, getMapData(_userData1.quids, getMapData(_userData1.currentQuid, interaction.guildId)));
		if (!hasNameAndSpecies(userData1)) { throw new Error('userData1.quid.species is empty string'); }

		/* Gets the current active quid and the server profile from the partners account */
		const userId2 = getArrayElement(interaction.customId.split('_'), 2).replace('@', '');
		const _userData2 = await userModel.findOne(u => u.userId.includes(userId2));
		const userData2 = getUserData(_userData2, interaction.guildId, getMapData(_userData2.quids, getMapData(_userData1.currentQuid, interaction.guildId)));
		if (!hasNameAndSpecies(userData2)) { throw new Error('userData2.quid.species is empty string'); }

		if (interaction.user.id === userId1) {

			await respond(interaction, {
				content: 'You can\'t accept your own invitation!',
				ephemeral: true,
			}, false);
			return;
		}

		/* For both users, set cooldowns to true, but unregister the command from being disabled, and get the condition change */
		setCooldown(userData1, interaction.guildId, true);
		setCooldown(userData2, interaction.guildId, true);
		deleteCommandDisablingInfo(userData1, interaction.guildId);
		deleteCommandDisablingInfo(userData2, interaction.guildId);
		const experiencePoints = getRandomNumber(11, 5);
		const decreasedStatsData1 = await changeCondition(userData1, experiencePoints, CurrentRegionType.Prairie, true);
		const decreasedStatsData2 = await changeCondition(userData2, experiencePoints, CurrentRegionType.Prairie, true);

		/* Define number of rounds, and the uncovered card amount for both users. */
		let finishedRounds = 0;
	type CardPositions = { column: number | null, row: number | null; };
	let chosenCardPositions: { first: CardPositions, second: CardPositions, current: 'first' | 'second'; } = { first: { column: null, row: null }, second: { column: null, row: null }, current: 'first' };
	let uncoveredCardsUser1 = 0;
	let uncoveredCardsUser2 = 0;

	let user1IsPlaying = getRandomNumber(2) === 0 ? true : false;
	let userDataCurrent = user1IsPlaying ? userData1 : userData2;

	await sendNextRoundMessage(interaction, user1IsPlaying ? userId1 : userId2, userData1, userData2, componentArray);
	let lastInteraction = interaction;

	const collector = interaction.channel.createMessageComponentCollector({
		componentType: ComponentType.Button,
		// This returns `reason` as 'idle' on end event
		idle: 120_000,
		filter: (i => i.customId.startsWith('adventure_') && userDataCurrent.userId.includes(i.user.id)),
	});

	collector.on('collect', async (i) => {
		try {

			if (!i.inCachedGuild()) { throw new Error('Interaction is not in cached guild'); }
			lastInteraction = i;

			/* The column and row of the current card are updated with their position */
			const column = Number(i.customId.split('_')[2]);
			if (isNaN(column)) { return collector.stop('error_Error: column is Not a Number'); }
			const row = Number(i.customId.split('_')[3]);
			if (isNaN(row)) { return collector.stop('error_Error: column is Not a Number'); }
			chosenCardPositions[chosenCardPositions.current].column = column;
			chosenCardPositions[chosenCardPositions.current].row = row;

			/* Getting the uncovered emoji from the current position, and erroring if there is no emoji */
			const uncoveredEmoji = getArrayElement(getArrayElement(emojisInComponentArray, column), row);

			/* Changing the button's emoji to be the uncovered card and disabling it */
			componentArray[column]?.components[row]?.setEmoji(uncoveredEmoji);
			componentArray[column]?.components[row]?.setDisabled(true);

			const updatedInteraction = await update(i, { components: chosenCardPositions.current === 'first' ? componentArray : disableAllComponents(componentArray) })
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

				setTimeout(async () => {
					try {

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

							await sendNextRoundMessage(i, user1IsPlaying ? userId1 : userId2, userData1, userData2, componentArray)
								.catch((error) => {
									collector.stop(`error_${error}`);
									return undefined;
								});
						}
					}
					catch (error) {

						await sendErrorMessage(i, error)
							.catch(e => { console.error(e); });
					}
				}, 3_000);
			}
		}
		catch (error) {

			await sendErrorMessage(i, error)
				.catch(e => { console.error(e); });
		}
	});

	collector.on('end', async (collected, reason) => {
		try {

			/* Set both user's cooldown to false */
			setCooldown(userData1, interaction.guildId, false);
			setCooldown(userData2, interaction.guildId, false);

			if (reason.startsWith('error')) {

				const errorReason = reason.split('_').slice(1).join('_') || 'An unexpected error occurred.';
				await sendErrorMessage(lastInteraction, errorReason)
					.catch((error) => { console.error(error); });
				return;
			}

			// reason idle: someone waited too long
			if (reason.includes('idle') || reason.includes('time')) {

				const afterGameChangesData = await checkAfterGameChanges(lastInteraction, userData1, userData2, serverData)
					.catch((error) => { sendErrorMessage(lastInteraction, error); return null; });

				await update(lastInteraction, {
					embeds: [
						new EmbedBuilder()
							.setColor(userData1.quid.color)
							.setAuthor({ name: userData1.quid.getDisplayname(), iconURL: userData1.quid.avatarURL })
							.setDescription(`*${userDataCurrent.quid.name} decides that ${userDataCurrent.quid.pronounAndPlural(0, 'has', 'have')} adventured enough and goes back to the pack.*`)
							.setFooter({ text: `${decreasedStatsData1.statsUpdateText}\n${decreasedStatsData2.statsUpdateText}` }),
						...decreasedStatsData1.injuryUpdateEmbed,
						...decreasedStatsData2.injuryUpdateEmbed,
						...(afterGameChangesData?.levelUpEmbed1 ?? []),
						...(afterGameChangesData?.levelUpEmbed2 ?? []),
					],
					components: disableAllComponents(componentArray),
				})
					.catch((error) => { sendErrorMessage(lastInteraction, error); });
				return;
			}

			// reason roundLimit: too many rounds went past
			if (reason.includes('roundLimit')) {

				const losingUserData = uncoveredCardsUser1 < uncoveredCardsUser2 ? userData1 : uncoveredCardsUser2 < uncoveredCardsUser1 ? userData2 : getRandomNumber(2) === 0 ? userData1 : userData2;

				const losingHealthPoints = getSmallerNumber(getRandomNumber(5, 3), losingUserData.quid.profile.health);

				let extraDescription = '';
				let extraFooter = '';

				const { itemType, itemName } = getHighestItem(losingUserData.quid.profile.inventory);
				const inventory_ = widenValues(losingUserData.quid.profile.inventory);
				if (itemType && itemName && pullFromWeightedTable({ 0: 1, 1: 1 }) === 0) {

					inventory_[itemType][itemName] -= 1;
					extraDescription = `accidentally drops a ${itemName} that ${losingUserData.quid.pronoun(0)} had with ${losingUserData.quid.pronoun(1)}.`;
					extraFooter = `-1 ${itemName} for ${losingUserData.quid.name}`;
				}
				else if (losingUserData.quid.profile.injuries.cold === false && pullFromWeightedTable({ 0: 1, 1: 1 }) === 0) {

					losingUserData.quid.profile.injuries.cold = true;
					extraDescription = `notices that ${losingUserData.quid.pronounAndPlural(0, 'is', 'are')} feeling weak and can't stop coughing. The long jouney must've given ${losingUserData.quid.pronoun(1)} a cold.`;
					extraFooter = `-${losingHealthPoints} HP (from cold) for ${losingUserData.quid.name}`;
				}
				else {

					losingUserData.quid.profile.injuries.wounds += 1;
					extraDescription = `feels blood running down ${losingUserData.quid.pronoun(2)} side. The humans must've wounded ${losingUserData.quid.pronoun(0)}.`;
					extraFooter = `-${losingHealthPoints} HP (from wound) for ${losingUserData.quid.name}`;
				}

				losingUserData.update(
					(u => {
						const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, lastInteraction.guildId)).profiles, lastInteraction.guildId);
						p.inventory = inventory_;
						p.health -= losingHealthPoints;
						p.injuries = losingUserData.quid.profile.injuries;
					}),
				);


				const afterGameChangesData = await checkAfterGameChanges(lastInteraction, userData1, userData2, serverData)
					.catch((error) => { sendErrorMessage(lastInteraction, error); return null; });

				await update(lastInteraction, {
					embeds: [
						new EmbedBuilder()
							.setColor(userData1.quid.color)
							.setAuthor({ name: userData1.quid.getDisplayname(), iconURL: userData1.quid.avatarURL })
							.setDescription(`*The adventure didn't go as planned. Not only did the two animals get lost, they also had to run from humans. While running, ${losingUserData.quid.name} ${extraDescription} What a shame!*`)
							.setFooter({ text: `${decreasedStatsData1.statsUpdateText}\n${decreasedStatsData2.statsUpdateText}\n\n${extraFooter}` }),
						...decreasedStatsData1.injuryUpdateEmbed,
						...decreasedStatsData2.injuryUpdateEmbed,
						...(afterGameChangesData?.levelUpEmbed1 ?? []),
						...(afterGameChangesData?.levelUpEmbed2 ?? []),
					],
					components: disableAllComponents(componentArray),
				})
					.catch((error) => { sendErrorMessage(lastInteraction, error); });
				return;
			}

			// reason success: every card has been uncovered
			if (reason.includes('success')) {

				const winningUserData = uncoveredCardsUser1 > uncoveredCardsUser2 ? userData1 : uncoveredCardsUser2 > uncoveredCardsUser1 ? userData2 : getRandomNumber(2) === 0 ? userData1 : userData2;

				let foundItem: KeyOfUnion<Inventory[keyof Inventory]> | null = null;
				let extraHealthPoints = 0;

				if (winningUserData.quid.profile.health < winningUserData.quid.profile.maxHealth) {

					extraHealthPoints = getSmallerNumber(getRandomNumber(5, 8), winningUserData.quid.profile.maxHealth - winningUserData.quid.profile.health);
				}
				else if (Object.keys(winningUserData.quid.profile.temporaryStatIncrease).length <= 1 && pullFromWeightedTable({ 0: 20 - finishedRounds, 1: finishedRounds - 10 }) === 0) {

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
						const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, lastInteraction.guildId)).profiles, lastInteraction.guildId);
						p.inventory = winningUserData.quid.profile.inventory;
						p.health += extraHealthPoints;
					}),
				);


				const afterGameChangesData = await checkAfterGameChanges(lastInteraction, userData1, userData2, serverData)
					.catch((error) => { sendErrorMessage(lastInteraction, error); });

				await update(lastInteraction, {
					embeds: [
						new EmbedBuilder()
							.setColor(userData1.quid.color)
							.setAuthor({ name: userData1.quid.getDisplayname(), iconURL: userData1.quid.avatarURL })
							.setDescription(`*The two animals laugh as they return from a successful adventure. ${winningUserData.quid.name} ${foundItem === null ? 'feels especially refreshed from this trip' : `even found a ${foundItem} on the way`}. What a success!*`)
							.setFooter({ text: `${decreasedStatsData1.statsUpdateText}\n${decreasedStatsData2.statsUpdateText}\n\n${extraHealthPoints > 0 ? `+${extraHealthPoints} HP for ${winningUserData.quid.name} (${winningUserData.quid.profile.health}/${winningUserData.quid.profile.maxHealth})` : `+1 ${foundItem} for ${winningUserData.quid.name}`}` }),
						...decreasedStatsData1.injuryUpdateEmbed,
						...decreasedStatsData2.injuryUpdateEmbed,
						...(afterGameChangesData?.levelUpEmbed1 ?? []),
						...(afterGameChangesData?.levelUpEmbed2 ?? []),
					],
					components: disableAllComponents(componentArray),
				})
					.catch((error) => { sendErrorMessage(lastInteraction, error); });
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
): Promise<Message> {

	const message = await respond(interaction, {
		content: `<@${userId}>`,
		embeds: [new EmbedBuilder()
			.setColor(userData1.quid.color)
			.setAuthor({ name: userData1.quid.getDisplayname(), iconURL: userData1.quid.avatarURL })
			.setDescription(`*The two animals are strolling around. ${userData2.quid.name} notices something behind a plant and goes to take a closer look.*`)],
		components: componentArray,
	}, false);

	await interaction.message.delete();

	return message;
}

/**
 * Checks for both players whether to level them up, if they are passed out, whether to add friendship points, and if they need to be given any advice.
 */
async function checkAfterGameChanges(
	interaction: ButtonInteraction<'cached'>,
	userData1: UserData<never, never>,
	userData2: UserData<never, never>,
	serverData: ServerSchema,
): Promise<{
	levelUpEmbed1: EmbedBuilder[],
	levelUpEmbed2: EmbedBuilder[]
}> {

	const levelUpEmbed1 = await checkLevelUp(interaction, userData1, serverData);
	const levelUpEmbed2 = await checkLevelUp(interaction, userData2, serverData);

	await isPassedOut(interaction, userData1, true);
	await isPassedOut(interaction, userData2, true);

	await addFriendshipPoints(interaction.message, userData1, userData2);

	await restAdvice(interaction, userData1);
	await restAdvice(interaction, userData2);

	await drinkAdvice(interaction, userData1);
	await drinkAdvice(interaction, userData2);

	await eatAdvice(interaction, userData1);
	await eatAdvice(interaction, userData2);

	return { levelUpEmbed1, levelUpEmbed2 };
}