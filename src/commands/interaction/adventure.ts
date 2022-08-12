import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ComponentType, EmbedBuilder, Message, SlashCommandBuilder } from 'discord.js';
import { hasCooldownMap } from '../../events/interactionCreate';
import { KeyOfUnion, sendErrorMessage, widenValues } from '../../utils/helperFunctions';
import { respond } from '../../utils/helperFunctions';
import userModel from '../../models/userModel';
import { CurrentRegionType, Inventory, Profile, Quid, ServerSchema, SlashCommand, UserSchema } from '../../typedef';
import { drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { changeCondition, getSmallerNumber, pickRandomCommonPlant, pickRandomRarePlant, pickRandomSpecialPlant, pickRandomUncommonPlant } from '../../utils/changeCondition';
import { hasCompletedAccount, isInGuild } from '../../utils/checkUserState';
import { hasFullInventory, isInteractable, isInvalid, isPassedOut } from '../../utils/checkValidity';
import { createCommandComponentDisabler, disableAllComponents, disableCommandComponent } from '../../utils/componentDisabling';
import { addFriendshipPoints, checkOldMentions, getFriendshipHearts, getFriendshipPoints } from '../../utils/friendshipHandling';
import { getMapData } from '../../utils/helperFunctions';
import { pronoun, pronounAndPlural } from '../../utils/getPronouns';
import { checkLevelUp } from '../../utils/levelHandling';
import { generateRandomNumber, pullFromWeightedTable } from '../../utils/randomizers';
import { getHighestItem, remindOfAttack } from '../gameplay_primary/attack';
const { error_color } = require('../../../config.json');

const name: SlashCommand['name'] = 'adventure';
const description: SlashCommand['description'] = 'Go adventuring with a friend. Requires 6 friendship hearts.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.setDMPermission(false)
		.addUserOption(option =>
			option.setName('user')
				.setDescription('The user that you want to adventure with.')
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
		if (await isInvalid(interaction, userData1, quidData1, profileData1, embedArray, name)) { return; }

		/* Define messageContent as the return of remindOfAttack */
		const messageContent = remindOfAttack(interaction.guildId);

		/* Checks whether the user's inventory is full and returns if it is. */
		if (await hasFullInventory(interaction, quidData1, profileData1, embedArray, messageContent)) { return; }

		/* Gets the mentioned user. */
		const mentionedUser = interaction.options.getUser('user');
		if (!mentionedUser) { throw new TypeError('mentionedUser is undefined'); }

		/* Checks whether the mentioned user is associated with the account. */
		if (userData1.userId.includes(mentionedUser.id)) {

			await respond(interaction, {
				content: messageContent,
				embeds: [...embedArray, new EmbedBuilder()
					.setColor(quidData1.color)
					.setAuthor({ name: quidData1.name, iconURL: quidData1.avatarURL })
					.setDescription(`*${quidData1.name} is looking to go on an adventure, but going alone is very dangerous. The ${quidData1.displayedSpecies || quidData1.species} should find someone to take with ${pronoun(quidData1, 1)}.*`)],
			}, false)
				.catch(error => { throw new Error(error); });
			return;
		}

		/* Define the partners user data, check if the user is interactable, and if they are, define quid data and profile data. */
		const userData2 = await userModel.findOne(u => u.userId.includes(mentionedUser.id)).catch(() => { return null; });
		if (!isInteractable(interaction, userData2, messageContent, embedArray)) { return; }
		const quidData2 = getMapData(userData2.quids, getMapData(userData2.currentQuid, interaction.guildId));

		/* Check how many friendship hearts the players have and if it is less than the required amount, send an error message. */
		await checkOldMentions(userData1, quidData1._id, userData2, quidData2._id);
		const friendshipPoints = getFriendshipPoints(quidData1.mentions[quidData2._id] || [], quidData2.mentions[quidData1._id] || []);
		const friendshipHearts = getFriendshipHearts(friendshipPoints);
		const requiredFriendshipHearts = 6;
		if (friendshipHearts < requiredFriendshipHearts) {

			await respond(interaction, {
				content: messageContent,
				embeds: [...embedArray, new EmbedBuilder()
					.setColor(error_color)
					.setTitle(`You and ${quidData2.name} need at least ${requiredFriendshipHearts} ❤️ to be able to adventure together!`)
					.setDescription('You gain ❤️ by mentioning and interacting with each other. To check your friendships, type `/friendships`.'),
				],
			}, false)
				.catch((error) => { throw new Error(error); });
			return;
		}

		/* Sending a message asking the other player if they want to play, with a button to start the adventure. */
		const botReply = await respond(interaction, {
			content: messageContent,
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(quidData1.color)
				.setAuthor({ name: quidData1.name, iconURL: quidData1.avatarURL })
				.setDescription(`*${quidData1.name} impatiently paces at the pack borders, hoping for ${quidData2.name} to come and adventure with ${pronoun(quidData1, 1)}.*`)
				.setFooter({ text: 'The game that is being played is memory, meaning that a player has to uncover two cards, If the emojis match, the cards are left uncovered.' })],
			components: [new ActionRowBuilder<ButtonBuilder>()
				.setComponents(new ButtonBuilder()
					.setCustomId(`adventure_confirm_${mentionedUser.id}_${interaction.user.id}`)
					.setLabel('Start adventure')
					.setEmoji('🧭')
					.setStyle(ButtonStyle.Success))],
		}, true);

		/* Register the command to be disabled when another command is executed, for both players */
		createCommandComponentDisabler(userData1.uuid, interaction.guildId, botReply);
		createCommandComponentDisabler(userData2.uuid, interaction.guildId, botReply);

	},
};

export const adventureInteractionCollector = async (
	interaction: ButtonInteraction,
	serverData: ServerSchema,
): Promise<void> => {

	if (!interaction.customId.includes('confirm')) { return; }
	if (!interaction.inCachedGuild()) { throw new Error('Interaction is not in cached guild.'); }
	if (!interaction.channel) { throw new Error('Interaction channel is missing.'); }

	/* Define the empty field emoji and the emoji options for the cards */
	const coveredField = '⬛';
	const allMemoryCardOptions = ['🌱', '🌿', '☘️', '🍀', '🍃', '💐', '🌷', '🌹', '🥀', '🌺', '🌸', '🌼', '🌻', '🍇', '🍊', '🫒', '🌰', '🏕️', '🌲', '🌳', '🍂', '🍁', '🍄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞', '🐁', '🦔', '🌵', '🦂', '🏜️', '🎍', '🪴', '🎋', '🪨', '🌾', '🐍', '🦎', '🐫', '🐙', '🦑', '🦀', '🐡', '🐠', '🐟', '🌊', '🐚', '🪵', '🌴'];

	/* Get an array of 10 emojis from the memory card options, each emoji added twice. */
	const chosenMemoryCardOptions: string[] = [];
	for (let i = 0; i < 10; i++) {

		const randomMemoryCardOption = allMemoryCardOptions.splice(generateRandomNumber(allMemoryCardOptions.length, 0), 1)[0];
		if (!randomMemoryCardOption) { throw new TypeError('randomMemoryCardOption is undefined'); }
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
				.setCustomId(`interaction_board_${column}_${row}`)
				.setEmoji(coveredField)
				.setDisabled(false)
				.setStyle(ButtonStyle.Secondary),
			);

			const randomMemoryCardOption = chosenMemoryCardOptions.splice(generateRandomNumber(chosenMemoryCardOptions.length), 1)[0];
			if (!randomMemoryCardOption) { throw new TypeError('randomMemoryCardOption is undefined'); }
			emojisInComponentArray[column]?.push(randomMemoryCardOption);
		}
	}

	/* Gets the current active quid and the server profile from the account */
	const userId1 = interaction.customId.split('_')[3];
	if (!userId1) { throw new TypeError('userId1 is undefined'); }
	const userData1 = await userModel.findOne(u => u.userId.includes(userId1));
	const quidData1 = getMapData(userData1.quids, getMapData(userData1.currentQuid, interaction.guildId));
	let profileData1 = getMapData(quidData1.profiles, interaction.guildId);

	/* Gets the current active quid and the server profile from the partners account */
	const userId2 = interaction.customId.split('_')[2];
	if (!userId2) { throw new TypeError('userId2 is undefined'); }
	const userData2 = await userModel.findOne(u => u.userId.includes(userId2));
	const quidData2 = getMapData(userData2.quids, getMapData(userData2.currentQuid, interaction.guildId));
	let profileData2 = getMapData(quidData2.profiles, interaction.guildId);

	/* For both users, set cooldowns to true, but unregister the command from being disabled, and get the condition chang */
	hasCooldownMap.set(userData1.uuid + interaction.guildId, true);
	hasCooldownMap.set(userData2.uuid + interaction.guildId, true);
	delete disableCommandComponent[userData1.uuid + interaction.guildId];
	delete disableCommandComponent[userData2.uuid + interaction.guildId];
	const experiencePoints = generateRandomNumber(11, 5);
	const decreasedStatsData1 = await changeCondition(userData1, quidData1, profileData1, experiencePoints, CurrentRegionType.Prairie);
	profileData1 = decreasedStatsData1.profileData;
	const decreasedStatsData2 = await changeCondition(userData2, quidData2, profileData2, experiencePoints, CurrentRegionType.Prairie);
	profileData2 = decreasedStatsData2.profileData;

	/* Define number of rounds, and the uncovered card amount for both users. */
	let finishedRounds = 0;
	type CardPositions = { column: number | null, row: number | null; };
	let chosenCardPositions: { first: CardPositions, second: CardPositions, current: 'first' | 'second'; } = { first: { column: null, row: null }, second: { column: null, row: null }, current: 'first' };
	let uncoveredCardsUser1 = 0;
	let uncoveredCardsUser2 = 0;

	let user1IsPlaying = generateRandomNumber(2, 0) === 0 ? true : false;
	let userDataCurrent = user1IsPlaying ? userData1 : userData2;
	let quidDataCurrent = getMapData(userDataCurrent.quids, getMapData(userDataCurrent.currentQuid, interaction.guildId));

	let botReply = await sendNextRoundMessage(interaction, user1IsPlaying ? userId1 : userId2, quidData1, quidData2, componentArray)
		.catch((error) => { throw new Error(error); });

	const collector = interaction.channel.createMessageComponentCollector({
		componentType: ComponentType.Button,
		// This returns `reason` as 'idle' on end event
		idle: 120_000,
		filter: (i => i.customId.startsWith('adventure_') && userDataCurrent.userId.includes(i.user.id)),
	});

	collector.on('collect', async (i) => {

		/* The column and row of the current card are updated with their position */
		const column = Number(i.customId.split('_')[2]);
		if (isNaN(column)) { return collector.stop('error_Error: column is Not a Number'); }
		const row = Number(i.customId.split('_')[3]);
		if (isNaN(row)) { return collector.stop('error_Error: column is Not a Number'); }
		chosenCardPositions[chosenCardPositions.current].column = column;
		chosenCardPositions[chosenCardPositions.current].row = row;

		/* Getting the uncovered emoji from the current position, and erroring if there is no emoji */
		const uncoveredEmoji = emojisInComponentArray[column]?.[row];
		if (!uncoveredEmoji) { return collector.stop('error_TypeError: uncoveredEmoji is undefined'); }

		/* Changing the button's emoji to be the uncovered card and disabling it */
		componentArray[column]?.components[row]?.setEmoji(uncoveredEmoji);
		componentArray[column]?.components[row]?.setDisabled(true);

		const updatedInteraction = await i
			.update({ components: componentArray })
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

				/* Getting the column and row from the first selected button */
				const firstPickColumn = chosenCardPositions.first.column;
				if (!firstPickColumn) { return collector.stop('error_Error: firstPickColumn is null'); }
				const firstPickRow = chosenCardPositions.first.row;
				if (!firstPickRow) { return collector.stop('error_Error: firstPickRow is null'); }

				/* Getting the column and row from the second selected button */
				const secondPickColumn = chosenCardPositions.second.column;
				if (!secondPickColumn) { return collector.stop('error_Error: secondPickColumn is null'); }
				const secondPickRow = chosenCardPositions.second.row;
				if (!secondPickRow) { return collector.stop('error_Error: secondPickRow is null'); }

				/* If there are no emojis or the emojis don't match, set both buttons emojis to covered fields and enable them */
				const firstPickEmoji = componentArray[firstPickColumn]?.components[firstPickRow]?.toJSON().emoji;
				const secondPickEmoji = componentArray[secondPickColumn]?.components[secondPickRow]?.toJSON().emoji;
				if (!firstPickEmoji || !secondPickEmoji || firstPickEmoji !== secondPickEmoji) {

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
				quidDataCurrent = getMapData(userDataCurrent.quids, getMapData(userDataCurrent.currentQuid, interaction.guildId));

				const newBotReply = await sendNextRoundMessage(i, user1IsPlaying ? userId1 : userId2, quidData1, quidData2, componentArray)
					.catch((error) => {
						collector.stop(`error_${error}`);
						return undefined;
					});
				if (!newBotReply) { return; }
				else { botReply = newBotReply; }

				if (componentArray.every(actionRow => actionRow.components.every(button => button.toJSON().disabled === true))) { collector.stop('success'); }
				else if (finishedRounds >= 20) { collector.stop('roundLimit'); }
			}, 3_000);
		}
	});

	collector.on('end', async (collected, reason) => {

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

			await interaction
				.update({
					embeds: [
						new EmbedBuilder()
							.setColor(quidData1.color)
							.setAuthor({ name: quidData1.name, iconURL: quidData1.avatarURL })
							.setDescription(`*${quidDataCurrent.name} decides that ${pronounAndPlural(quidDataCurrent, 0, 'has', 'have')} adventured enough and goes back to the pack.*`)
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

		// reason roundLimit: too many rounds went past
		if (reason.includes('roundLimit')) {

			const losingUserData = uncoveredCardsUser1 < uncoveredCardsUser2 ? userData1 : uncoveredCardsUser2 < uncoveredCardsUser1 ? userData2 : generateRandomNumber(2, 0) === 0 ? userData1 : userData2;
			const losingQuidData = getMapData(losingUserData.quids, getMapData(losingUserData.currentQuid, interaction.guildId));
			const losingProfileData = getMapData(losingQuidData.profiles, interaction.guildId);

			const losingHealthPoints = getSmallerNumber(generateRandomNumber(5, 3), losingProfileData.health);

			let extraDescription = '';
			let extraFooter = '';

			const flattenedInventory = (Object.values(losingProfileData.inventory) as Array<Inventory[keyof Inventory]>).map(type => Object.values(type)).flat().reduce((a, b) => a + b);
			const _inventory = widenValues(losingProfileData.inventory);
			if (flattenedInventory > 0 && pullFromWeightedTable({ 0: 1, 1: 1 }) === 0) {

				const { itemType, itemName } = getHighestItem(losingProfileData.inventory);
				_inventory[itemType][itemName] -= 1;
				extraDescription = `accidentally drops a ${itemName} that ${pronoun(losingQuidData, 0)} had with ${pronoun(losingQuidData, 1)}.`;
				extraFooter = `-1 ${itemName} for ${losingQuidData.name}`;
			}
			else if (losingProfileData.injuries.cold === false && pullFromWeightedTable({ 0: 1, 1: 1 }) === 0) {

				losingProfileData.injuries.cold = true;
				extraDescription = `notices that ${pronounAndPlural(losingQuidData, 0, 'is', 'are')} feeling weak and can't stop coughing. The long jouney must've given ${pronoun(losingQuidData, 1)} a cold.`;
				extraFooter = `-${losingHealthPoints} HP (from cold) for ${losingQuidData.name}`;
			}
			else {

				losingProfileData.injuries.wounds += 1;
				extraDescription = `feels blood running down ${pronoun(losingQuidData, 2)} side. The humans must've wounded ${pronoun(losingQuidData, 0)}.`;
				extraFooter = `-${losingHealthPoints} HP (from wound) for ${losingQuidData.name}`;
			}

			await userModel
				.findOneAndUpdate(
					u => u.uuid === losingUserData.uuid,
					(u => {
						const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
						p.inventory = losingProfileData.inventory;
						p.health -= losingHealthPoints;
						p.injuries = losingProfileData.injuries;
					}),
				)
				.catch((error) => { sendErrorMessage(interaction, error); });


			const afterGameChangesData = await checkAfterGameChanges(interaction, userData1, quidData1, profileData1, userData2, quidData2, profileData2, serverData)
				.catch((error) => { sendErrorMessage(interaction, error); });

			await botReply
				.edit({
					embeds: [
						new EmbedBuilder()
							.setColor(quidData1.color)
							.setAuthor({ name: quidData1.name, iconURL: quidData1.avatarURL })
							.setDescription(`*The adventure didn't go as planned. Not only did the two animals get lost, they also had to run from humans. While running, ${losingQuidData.name} ${extraDescription} What a shame!*`)
							.setFooter({ text: `${decreasedStatsData1.statsUpdateText}\n\n${decreasedStatsData2.statsUpdateText}\n\n${extraFooter}` }),
						...(decreasedStatsData1.injuryUpdateEmbed ? [decreasedStatsData1.injuryUpdateEmbed] : []),
						...(decreasedStatsData2.injuryUpdateEmbed ? [decreasedStatsData2.injuryUpdateEmbed] : []),
						...(afterGameChangesData?.user1CheckLevelData.levelUpEmbed ? [afterGameChangesData.user1CheckLevelData.levelUpEmbed] : []),
						...(afterGameChangesData?.user2CheckLevelData.levelUpEmbed ? [afterGameChangesData.user2CheckLevelData.levelUpEmbed] : []),
					],
					components: disableAllComponents(botReply.components.map(component => component.toJSON())),
				})
				.catch((error) => { sendErrorMessage(interaction, error); });
			return;
		}

		// reason success: every card has been uncovered
		if (reason.includes('success')) {

			const winningUserData = uncoveredCardsUser1 > uncoveredCardsUser2 ? userData1 : uncoveredCardsUser2 > uncoveredCardsUser1 ? userData2 : generateRandomNumber(2, 0) === 0 ? userData1 : userData2;
			const winningQuidData = getMapData(winningUserData.quids, getMapData(winningUserData.currentQuid, interaction.guildId));
			const winningProfileData = getMapData(winningQuidData.profiles, interaction.guildId);

			let foundItem: KeyOfUnion<Inventory[keyof Inventory]> | null = null;
			let extraHealthPoints = 0;

			if (winningProfileData.health < winningProfileData.maxHealth) {

				extraHealthPoints = getSmallerNumber(generateRandomNumber(5, 8), winningProfileData.health);
			}
			else if (Object.keys(winningProfileData.temporaryStatIncrease).length <= 1 && pullFromWeightedTable({ 0: finishedRounds * 3, 1: 45 - finishedRounds }) === 1) {

				foundItem = pickRandomSpecialPlant();
				winningProfileData.inventory.specialPlants[foundItem] += 1;
			}
			else if (pullFromWeightedTable({ 0: finishedRounds * 8, 1: 30 - finishedRounds }) === 1) {

				if (pullFromWeightedTable({ 0: finishedRounds * 8, 1: 30 - finishedRounds }) === 1) {

					foundItem = pickRandomRarePlant();
					winningProfileData.inventory.rarePlants[foundItem] += 1;
				}
				else {

					foundItem = pickRandomUncommonPlant();
					winningProfileData.inventory.uncommonPlants[foundItem] += 1;
				}
			}
			else {

				foundItem = pickRandomCommonPlant();
				winningProfileData.inventory.commonPlants[foundItem] += 1;
			}

			await userModel
				.findOneAndUpdate(
					u => u.uuid === winningUserData.uuid,
					(u => {
						const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
						p.inventory = winningProfileData.inventory;
						p.health += winningProfileData.health;
					}),
				)
				.catch((error) => { sendErrorMessage(interaction, error); });


			const afterGameChangesData = await checkAfterGameChanges(interaction, userData1, quidData1, profileData1, userData2, quidData2, profileData2, serverData)
				.catch((error) => { sendErrorMessage(interaction, error); });

			await botReply
				.edit({
					embeds: [
						new EmbedBuilder()
							.setColor(quidData1.color)
							.setAuthor({ name: quidData1.name, iconURL: quidData1.avatarURL })
							.setDescription(`*The two animals laugh as they return from a successful adventure. ${winningQuidData.name} ${foundItem === null ? 'feels especially refreshed from this trip' : `even found a ${foundItem} on the way`}. What a success!*`)
							.setFooter({ text: `${decreasedStatsData1.statsUpdateText}\n\n${decreasedStatsData2.statsUpdateText}\n\n${foundItem === null ? `+${extraHealthPoints} HP for ${winningQuidData.name} (${winningProfileData.health}/${winningProfileData.maxHealth})` : `+1 ${foundItem} for ${winningQuidData.name}`}` }),
						...(decreasedStatsData1.injuryUpdateEmbed ? [decreasedStatsData1.injuryUpdateEmbed] : []),
						...(decreasedStatsData2.injuryUpdateEmbed ? [decreasedStatsData2.injuryUpdateEmbed] : []),
						...(afterGameChangesData?.user1CheckLevelData.levelUpEmbed ? [afterGameChangesData.user1CheckLevelData.levelUpEmbed] : []),
						...(afterGameChangesData?.user2CheckLevelData.levelUpEmbed ? [afterGameChangesData.user2CheckLevelData.levelUpEmbed] : []),
					],
					components: disableAllComponents(botReply.components.map(component => component.toJSON())),
				})
				.catch((error) => { sendErrorMessage(interaction, error); });
			return;
		}
	});
};

/**
 * It sends a message to the channel that the interaction was sent in
 * @param interaction - The interaction object that was passed to the command.
 * @param userId - The user ID of the user who will play the next round
 * @param quidData1 - The first quid's data.
 * @param quidData2 - The other quid's data.
 * @param componentArray - This is an array of ActionRowBuilder<ButtonBuilder> objects.
 */
const sendNextRoundMessage = async (
	interaction: ButtonInteraction,
	userId: string,
	quidData1: Quid,
	quidData2: Quid,
	componentArray: ActionRowBuilder<ButtonBuilder>[],
): Promise<Message> => {

	const message = await respond(interaction, {
		content: `<@${userId}>`,
		embeds: [new EmbedBuilder()
			.setColor(quidData1.color)
			.setAuthor({ name: quidData1.name, iconURL: quidData1.avatarURL })
			.setDescription(`*The two animals are strolling around. ${quidData2.name} notices something behind a plant and goes to take a closer look.*`)],
		components: componentArray,
	}, false);

	await interaction.message.delete();

	return message;
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