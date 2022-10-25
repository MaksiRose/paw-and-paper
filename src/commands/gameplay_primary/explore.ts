import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, Message, SlashCommandBuilder } from 'discord.js';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { hasFullInventory, isInvalid, isPassedOut } from '../../utils/checkValidity';
import { capitalizeString, getBiggerNumber, getMapData, getSmallerNumber, keyInObject, respond, sendErrorMessage, update } from '../../utils/helperFunctions';
import { remindOfAttack, startAttack } from './attack';
import Fuse from 'fuse.js';
import { disableAllComponents, disableCommandComponent } from '../../utils/componentDisabling';
import { cooldownMap, serverActiveUsersMap } from '../../events/interactionCreate';
import { createFightGame, createPlantGame, plantEmojis } from '../../utils/gameBuilder';
import { getRandomNumber, pullFromWeightedTable } from '../../utils/randomizers';
import { changeCondition, userFindsQuest } from '../../utils/changeCondition';
import { sendQuestMessage } from './start-quest';
import { checkLevelUp } from '../../utils/levelHandling';
import { coloredButtonsAdvice, drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { calculateInventorySize, pickMaterial, pickMeat, pickPlant, simulateMeatUse, simulatePlantUse } from '../../utils/simulateItemUse';
import { missingPermissions } from '../../utils/permissionHandler';
import { SlashCommand } from '../../typings/handle';
import { RankType, UserData } from '../../typings/data/user';
import { SpeciesHabitatType } from '../../typings/main';
import { speciesInfo } from '../..';
import { ServerSchema } from '../../typings/data/server';
import userModel from '../../models/userModel';
import { constructCustomId, deconstructCustomId } from '../../utils/customId';

type CustomIdArgs = ['new'] | ['new', string]
type Position = { row: number, column: number; };

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('explore')
		.setDescription('Travel through biomes to hunt for meat and gather herbs. Not available to Younglings.')
		.addStringOption(option =>
			option.setName('biome')
				.setDescription('The biome you want to explore')
				.setAutocomplete(true)
				.setRequired(false))
		.setDMPermission(false)
		.toJSON(),
	category: 'page2',
	position: 2,
	disablePreviousCommand: true,
	modifiesServerProfile: true,
	sendAutocomplete: async (interaction, userData, serverData) => {

		if (!serverData || !interaction.inGuild()) { return; }
		if (!hasNameAndSpecies(userData)) { return; }
		const focusedValue = interaction.options.getFocused();

		const availableBiomes = getAvailableBiomes(userData);
		const fuse = new Fuse(availableBiomes);
		const choices = focusedValue.length > 0 ? fuse.search(focusedValue).map(value => value.item) : availableBiomes;

		await interaction.respond(
			choices.slice(0, 25).map(choice => ({ name: choice, value: choice })),
		);
	},
	sendCommand: async (interaction, userData, serverData) => {

		await executeExploring(interaction, userData, serverData);
	},
	async sendMessageComponentResponse(interaction, userData, serverData) {

		const customId = deconstructCustomId<CustomIdArgs>(interaction.customId);
		if (interaction.isButton() && customId?.args[0] === 'new') {

			await executeExploring(interaction, userData, serverData);
		}
	},
};

export async function executeExploring(
	interaction: ChatInputCommandInteraction | ButtonInteraction,
	userData: UserData<undefined, ''> | null,
	serverData: ServerSchema | null,
): Promise<void> {

	if (await missingPermissions(interaction, [
		'ViewChannel', // Needed because of createCommandComponentDisabler in sendQuestMessage
		/* 'ViewChannel',*/ interaction.channel?.isThread() ? 'SendMessagesInThreads' : 'SendMessages', 'EmbedLinks', // Needed for channel.send call in remainingHumans called by startAttack
	]) === true) { return; }

	/* This ensures that the user is in a guild and has a completed account. */
	if (serverData === null) { throw new Error('serverData is null'); }
	if (!isInGuild(interaction) || !hasNameAndSpecies(userData, interaction)) { return; }

	/* It's disabling all components if userData exists and the command is set to disable a previous command. */
	if (command.disablePreviousCommand) { await disableCommandComponent[userData._id + (interaction.guildId || 'DM')]?.(); }

	/* Checks if the profile is resting, on a cooldown or passed out. */
	const restEmbed = await isInvalid(interaction, userData);
	if (restEmbed === false) { return; }

	let messageContent = remindOfAttack(interaction.guildId);

	if (await hasFullInventory(interaction, userData, restEmbed, messageContent)) { return; }

	/* Checks  if the user is a Youngling and sends a message that they are too young if they are. */
	if (userData.quid.profile.rank === RankType.Youngling) {

		await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, new EmbedBuilder()
				.setColor(userData.quid.color)
				.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
				.setDescription(`*A hunter cuts ${userData.quid.name} as they see ${userData.quid.pronoun(1)} running towards the pack borders.* "You don't have enough experience to go into the wilderness, ${userData.quid.profile.rank}," *they say.*`)],
		}, true);
		return;
	}

	const stringInput = interaction.isChatInputCommand() ? interaction.options.getString('biome')?.toLowerCase() : deconstructCustomId<CustomIdArgs>(interaction.customId)?.args[1]?.toLowerCase();
	if (userData.quid.profile.tutorials.explore === false) {

		await respond(interaction, {
			content: 'Tip: When exploring, you encounter animals that have levels and plants in different leveled environments. These levels are in relation to your own level and determine whether you have a higher chance of beating them or getting hurt. Tactically use the Leave/Flee button if you think that the level is too high for you to beat.',
			components: [
				new ActionRowBuilder<ButtonBuilder>()
					.setComponents(new ButtonBuilder()
						.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData._id, ['new', ...(stringInput ? [stringInput] : []) as [string]]))
						.setLabel('I understand, let\'s explore!')
						.setStyle(ButtonStyle.Success)),
			],
		}, true);

		await userData.update(
			(u) => {
				const p = getMapData(getMapData(u.quids, userData!.quid!._id).profiles, interaction.guildId);
				p.tutorials.explore = true;
			},
		);
		return;
	}

	cooldownMap.set(userData._id + interaction.guildId, true);

	/* Here we are getting the biomes available to the quid, getting a user input if there is one, and defining chosenBiome as the user input if it matches an available biome, else it is null. */
	const availableBiomes = getAvailableBiomes(userData);
	let chosenBiome = (stringInput && availableBiomes.includes(stringInput)) ? stringInput : null;

	/** In case a biome was already chosen, the first waiting game reply would be the original reply. If they have to choose a biome, the biome choosing is the original reply, and the waiting game is an update to button click. To safe API calls, the update function is called with this interaction if it isn't null. This is later re-used for finding a plant/exploring */
	let buttonInteraction: ButtonInteraction<'cached'> | null = null;

	/* Send a message to the user asking them to select a biome, with buttons for each available biome. They have 30 seconds to click a button, and if they do, their choice will be saved in chosenBiome, else chosenBiome remains null */
	if (!chosenBiome) {

		const biomeComponent = new ActionRowBuilder<ButtonBuilder>()
			.setComponents(availableBiomes.map(value => new ButtonBuilder()
				.setCustomId(value)
				.setLabel(capitalizeString(value))
				.setStyle(ButtonStyle.Primary)));

		const getBiomeMessage = await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, new EmbedBuilder()
				.setColor(userData.quid.color)
				.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
				.setDescription(`*${userData.quid.name} is longing for adventure as ${userData.quid.pronounAndPlural(0, 'look')} into the wild outside of camp. All there is to decide is where the journey will lead ${userData.quid.pronoun(1)}.*`)],
			components: [biomeComponent],
		}, true);

		chosenBiome = await (getBiomeMessage as Message<true>)
			.awaitMessageComponent({
				filter: (i) => i.user.id === interaction.user.id,
				componentType: ComponentType.Button,
				time: 30_000,
			})
			.then(async int => {

				buttonInteraction = int;
				return int.customId;
			})
			.catch(async () => {

				cooldownMap.set(userData!._id + interaction.guildId, false);
				await respond(interaction, { components: disableAllComponents(getBiomeMessage.components) }, true);

				return null;
			});
	}

	/* chosenBiomeNumber is defined based on the index position of the chosenBiome in availableBiomes. chosenBiome should now either be found in availableBiomes, or it should be null, in which case chosenBiomeNumber is -1 and the explore command ends. */
	const chosenBiomeNumber = availableBiomes.findIndex(index => index === chosenBiome) as -1 | 0 | 1 | 2;
	if (chosenBiomeNumber === -1) { return; }

	/* Prepare everything for the waiting game, like the field for the waiting game and the emojis that could appear on the field. Then, place 3-5 random emojis randomly on the waitingArray */
	const empty = '⬛';
	const goal = '🚩';
	const player = '📍';
	const waitingGameField = [
		[empty, empty, empty, goal, empty, empty, empty],
		[empty, empty, empty, empty, empty, empty, empty],
		[empty, empty, empty, empty, empty, empty, empty],
		[empty, empty, empty, empty, empty, empty, empty],
		[empty, empty, empty, player, empty, empty, empty],
	];

	const selectableEmojis = plantEmojis.habitat[speciesInfo[userData.quid.species].habitat];

	for (let index = 0; index < getRandomNumber(3, 3); index++) {

		const testField: Position[] = waitingGameField
			.map((value, index) => value
				.reduce((newArray, v, i) => {
					if (v === empty) { newArray.push({ row: index, column: i }); }
					return newArray;
				}, [] as Position[]))
			.flat();

		const position = testField[getRandomNumber(testField.length)]!;
		waitingGameField[position.row]![position.column] = selectableEmojis[getRandomNumber(selectableEmojis.length)]!;
	}

	const waitingString = `*${userData.quid.name} slips out of camp, ${userData.quid.pronoun(2)} body disappearing in the morning mist. For a while ${userData.quid.pronoun(0)} will look around in the ${chosenBiome}, searching for anything of use…*\n`;


	/* The player position is updated, we don't really need to remember the old one. so we have the playerPos, which then gets saved in the collect event temporarily while this one gets overwritten. The oldGoalPos however needs to get remembered so that the goal doesn't move back to where it comes from. So we need where it was in the previous round, where it is in this round, and where it will go. for this reason, we are saving it here, and it gets overwritten with where it was (not where it moved) after a round is over */
	let _row = waitingGameField.findIndex(v => v.some(e => e === player));
	const playerPos: Position = { row: _row, column: waitingGameField[_row]?.findIndex(e => e === player) ?? -1 };

	_row = waitingGameField.findIndex(v => v.some(e => e === goal));
	let oldGoalPos: Position = { row: _row, column: waitingGameField[_row]?.findIndex(e => e === goal) ?? -1 };

	let waitingComponent = getWaitingComponent(waitingGameField, playerPos, empty, goal);

	let botReply = await (async function(messageObject) { return buttonInteraction ? await update(buttonInteraction, messageObject) : await respond(interaction, messageObject, true); })(getWaitingMessageObject(messageContent, restEmbed, userData, waitingString, waitingGameField, waitingComponent));


	const collector = (botReply as Message<true>).createMessageComponentCollector({
		filter: (i) => i.user.id === interaction.user.id,
		componentType: ComponentType.Button,
		time: 15_000,
	});

	collector.on('collect', async int => {
		try {

			const oldPlayerPos = { ...playerPos };

			if (int.customId.includes('left')) { playerPos.column -= 1; }
			if (int.customId.includes('up')) { playerPos.row -= 1; }
			if (int.customId.includes('down')) { playerPos.row += 1; }
			if (int.customId.includes('right')) { playerPos.column += 1; }

			_row = waitingGameField.findIndex(v => v.some(e => e === goal));
			let goalPos: Position = { row: _row, column: waitingGameField[_row]?.findIndex(e => e === goal) ?? -1 };

			let options: Position[] = [
				{ row: goalPos.row, column: goalPos.column - 1 },
				{ row: goalPos.row - 1, column: goalPos.column },
				{ row: goalPos.row + 1, column: goalPos.column },
				{ row: goalPos.row, column: goalPos.column + 1 },
			].filter(pos => waitingGameField[pos.row]?.[pos.column] === player || waitingGameField[pos.row]?.[pos.column] === empty);

			/* If we have enough options to chose from, remove the option where we go back where we were in the previous round */
			if (options.length > 1) { options = options.filter(pos => pos.row !== oldGoalPos.row || pos.column !== oldGoalPos.column); }

			oldGoalPos = { ...goalPos };
			goalPos = options[getRandomNumber(options.length)] ?? goalPos;

			waitingGameField[oldGoalPos.row]![oldGoalPos.column] = empty;
			waitingGameField[goalPos.row]![goalPos.column] = goal;
			waitingGameField[oldPlayerPos.row]![oldPlayerPos.column] = empty;
			waitingGameField[playerPos.row]![playerPos.column] = player;

			/* If the player and goal are in the same position or if the player and the goal swapped positions */
			if (
				(playerPos.row === goalPos.row && playerPos.column === goalPos.column)
				|| (
					(playerPos.row === oldGoalPos.row && playerPos.column === oldGoalPos.column)
					&& (goalPos.row === oldPlayerPos.row && goalPos.column === oldPlayerPos.column)
				)
			) {

				buttonInteraction = int;
				collector.stop();
				return;
			}

			waitingComponent = getWaitingComponent(waitingGameField, playerPos, empty, goal);

			botReply = await update(int, getWaitingMessageObject(messageContent, restEmbed, userData!, waitingString, waitingGameField, waitingComponent));
		}
		catch (error) {

			await sendErrorMessage(interaction, error)
				.catch(e => { console.error(e); });
		}
	});

	await new Promise<void>(resolve => {

		collector.on('end', async () => { resolve(); });

		setTimeout(() => { resolve(); }, 20_000);
	});

	const experiencePoints = chosenBiomeNumber == 2 ? getRandomNumber(41, 20) : chosenBiomeNumber == 1 ? getRandomNumber(21, 10) : getRandomNumber(11, 5);
	const changedCondition = await changeCondition(userData, experiencePoints);

	const responseTime = chosenBiomeNumber === 2 ? 3_000 : chosenBiomeNumber === 1 ? 4_000 : 5_000;
	const embed = new EmbedBuilder()
		.setColor(userData.quid.color)
		.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL });
	let exploreComponent: ActionRowBuilder<ButtonBuilder> | null = null;

	messageContent = remindOfAttack(interaction.guildId);
	const highRankProfilesCount = (await userModel.find(
		(u) => {
			return Object.values(u.quids).filter(q => {
				const p = q.profiles[interaction.guildId];
				return p && p.rank !== RankType.Youngling;
			}).length > 0;
		},
	))
		.map(user => Object.values(user.quids).filter(q => {
			const p = q.profiles[interaction.guildId];
			return p && p.rank !== RankType.Youngling;
		}).length)
		.reduce((a, b) => a + b, 0);
	const serverInventoryCount = calculateInventorySize(serverData.inventory, ([key]) => key !== 'materials');

	let foundQuest = false;
	let foundSapling = false;
	// If the chosen biome is the highest choosable biome, the user has no quest, has not unlocked a higher rank and they succeed in the chance, get a quest
	if (chosenBiomeNumber === (availableBiomes.length - 1)
		&& userFindsQuest(userData)) {

		foundQuest = true;
	}
	// If the server has more items than 8 per profile (It's 2 more than counted when the humans spawn, to give users a bit of leeway), there is no attack, and the next possible attack is possible, start an attack
	else if (serverInventoryCount > highRankProfilesCount * 8
		&& remindOfAttack(interaction.guildId) === null
		&& serverData.nextPossibleAttack <= Date.now()) {

		// The numerator is the amount of items above 7 per profile, the denominator is the amount of profiles
		const humanCount = Math.round((serverInventoryCount - (highRankProfilesCount * 7)) / highRankProfilesCount);
		await startAttack(interaction, humanCount);

		messageContent = serverActiveUsersMap.get(interaction.guildId)?.map(user => `<@${user}>`).join(' ') ?? '';
		embed.setDescription(`*${userData.quid.name} has just been looking around for food when ${userData.quid.pronounAndPlural(0, 'suddenly hear')} voices to ${userData.quid.pronoun(2)} right. Cautiously ${userData.quid.pronounAndPlural(0, 'creep')} up, and sure enough: a group of humans! It looks like it's around ${humanCount}. They seem to be discussing something, and keep pointing over towards where the pack is lying. Alarmed, the ${userData.quid.getDisplayspecies()} runs away. **${capitalizeString(userData.quid.pronoun(0))} must gather as many packmates as possible to protect the pack!***`);
		embed.setFooter({ text: `${changedCondition.statsUpdateText}\n\nYou have two minutes to prepare before the humans will attack!` });
	}
	// If the user gets the right chance, find sapling or material or nothing
	else if (pullFromWeightedTable({ 0: 10, 1: 90 + userData.quid.profile.sapling.waterCycles }) === 0) {

		const serverMaterialsCount = Object.values(serverData.inventory.materials).flat().reduce((a, b) => a + b, 0);

		if (!userData.quid.profile.sapling.exists) {

			foundSapling = true;
			await userData.update(
				(u) => {
					const p = getMapData(getMapData(u.quids, userData!.quid!._id).profiles, interaction.guildId);
					p.sapling = {
						exists: true,
						health: 50,
						waterCycles: 0,
						nextWaterTimestamp: Date.now(),
						sentGentleReminder: false,
						sentReminder: false,
						lastMessageChannelId: interaction.channelId,
					};
				},
			);

			embed.setImage('https://raw.githubusercontent.com/MaksiRose/paw-and-paper/main/pictures/ginkgo_tree/Discovery.png');
			embed.setDescription(`*${userData.quid.name} is looking around for useful things around ${userData.quid.pronoun(1)} when ${userData.quid.pronounAndPlural(0, 'discover')} the sapling of a ginkgo tree. The ${userData.quid.getDisplayspecies()} remembers that they bring good luck and health. Surely it can't hurt to bring it back to the pack!*`);
			embed.setFooter({ text: changedCondition.statsUpdateText + '\nWater the ginkgo sapling with \'/water-tree\'.' });
		}
		else if (serverMaterialsCount < 36) {

			const foundMaterial = pickMaterial(serverData.inventory);

			await userData.update(
				(u) => {
					const p = getMapData(getMapData(u.quids, userData!.quid!._id).profiles, interaction.guildId);
					p.inventory.materials[foundMaterial] += 1;
				},
			);

			embed.setDescription(`*${userData.quid.name} is looking around for things around ${userData.quid.pronoun(1)} but there doesn't appear to be anything useful. The ${userData.quid.getDisplayspecies()} decides to grab a ${foundMaterial} as to not go back with nothing to show.*`);
			embed.setFooter({ text: `${changedCondition.statsUpdateText}\n\n+1 ${foundMaterial}` });
		}
		else {

			embed.setDescription(`*${userData.quid.name} trots back into camp, mouth empty, and luck run out. Maybe ${userData.quid.pronoun(0)} will go exploring again later, bring something that time!*`);
			if (changedCondition.statsUpdateText) { embed.setFooter({ text: changedCondition.statsUpdateText }); }
		}
	}
	// If the user gets the right chance, find a plant
	else if (pullFromWeightedTable({ 0: userData.quid.profile.rank === RankType.Healer ? 2 : 1, 1: userData.quid.profile.rank === RankType.Hunter ? 2 : 1 }) === 0) {

		/* First we are calculating needed plants - existing plants through simulatePlantUse three times, of which two it is calculated for active users only. The results of these are added together and divided by 3 to get their average. This is then used to get a random number that can be between 1 higher and 1 lower than that. The user's level is added with this, and it is limited to not be below 1. */
		const simAverage = Math.round((await simulatePlantUse(serverData, true) + await simulatePlantUse(serverData, true) + await simulatePlantUse(serverData, false)) / 3);
		const environmentLevel = getBiggerNumber(1, userData.quid.profile.levels + getRandomNumber(3, simAverage - 1));

		const foundItem = await pickPlant(chosenBiomeNumber, serverData);

		if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Warm) {

			embed.setDescription(`*For a while, ${userData.quid.name} has been trudging through the hot sand, searching in vain for something useful. ${capitalizeString(userData.quid.pronounAndPlural(0, 'was', 'were'))} about to give up when ${userData.quid.pronounAndPlural(0, 'discover')} a ${foundItem} in a small, lone bush. Now ${userData.quid.pronounAndPlural(0, 'just need')} to pick it up gently...*`);
		}
		else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Cold) {

			embed.setDescription(`*For a while, ${userData.quid.name} has been trudging through the dense undergrowth, searching in vain for something useful. ${capitalizeString(userData.quid.pronounAndPlural(0, 'was', 'were'))} about to give up when ${userData.quid.pronounAndPlural(0, 'discover')} a ${foundItem} at the end of a tree trunk. Now ${userData.quid.pronounAndPlural(0, 'just need')} to pick it up gently...*`);
		}
		else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Water) {

			embed.setDescription(`*For a while, ${userData.quid.name} has been swimming through the water, searching in vain for something useful. ${capitalizeString(userData.quid.pronounAndPlural(0, 'was', 'were'))} about to give up when ${userData.quid.pronounAndPlural(0, 'discover')} a ${foundItem} among large algae. Now ${userData.quid.pronounAndPlural(0, 'just need')} to pick it up gently...*`);
		}
		else { throw new Error('userData.quid species habitat not found'); }
		embed.setFooter({ text: `The ${foundItem} is in an environment of difficulty level ${environmentLevel}.\nYou will be presented five buttons with five emojis each. The footer will show you an emoji, and you have to find the button with that emoji, but without the campsite (${plantEmojis.toAvoid}).` });

		await (async function(messageObject) { return buttonInteraction ? await update(buttonInteraction, messageObject) : await respond(interaction, messageObject, true); })({
			content: messageContent,
			embeds: [...restEmbed, embed],
			components: [new ActionRowBuilder<ButtonBuilder>()
				.setComponents(new ButtonBuilder()
					.setCustomId('pickup')
					.setLabel('Pick up')
					.setEmoji('🌿')
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId('leave')
					.setLabel('Leave')
					.setEmoji('💨')
					.setStyle(ButtonStyle.Primary))],
		});

		const int = await (botReply as Message<true>)
			.awaitMessageComponent({
				filter: i => i.user.id === interaction.user.id,
				componentType: ComponentType.Button,
				time: 30_000,
			})
			.then(async int => {

				buttonInteraction = int;
				if (int.customId.includes('leave')) { return undefined; }
				return int;
			})
			.catch(() => { return undefined; });

		if (int === undefined) {

			embed.setDescription(`*After thinking about it for a moment, ${userData.quid.name} decides ${userData.quid.pronounAndPlural(0, 'is', 'are')} too tired to focus on picking up the plant. It's better to leave it there in case another pack member comes along.*`);
			if (changedCondition.statsUpdateText) { embed.setFooter({ text: changedCondition.statsUpdateText }); }
		}
		else {

			let totalCycles: 0 | 1 | 2 = 0;
			let points = 0;

			await (async function interactionCollector(
				interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>,
				userData: UserData<never, never>,
				serverData: ServerSchema,
				newInteraction: ButtonInteraction<'cached'>,
				previousExploreComponents?: ActionRowBuilder<ButtonBuilder>,
			): Promise<void> {


				const plantGame = createPlantGame(speciesInfo[userData.quid.species].habitat);

				exploreComponent = plantGame.plantComponent;
				embed.setFooter({ text: `Click the button with this emoji: ${plantGame.emojiToFind}, but without the campsite (${plantEmojis.toAvoid}).` });

				botReply = await update(newInteraction, {
					content: messageContent,
					embeds: [...restEmbed, embed],
					components: [...previousExploreComponents ? [previousExploreComponents] : [], exploreComponent],
				});

				/* Here we are making sure that the correct button will be blue by default. If the player choses the correct button, this will be overwritten. */
				exploreComponent = plantGame.correctButtonOverwrite();

				newInteraction = await (botReply as Message<true>)
					.awaitMessageComponent({
						filter: i => i.user.id === interaction.user.id,
						componentType: ComponentType.Button,
						time: responseTime,
					})
					.then(async i => {

						/* Here we make the button the player choses red, this will apply always except if the player choses the correct button, then this will be overwritten. */
						exploreComponent = plantGame.chosenWrongButtonOverwrite(i.customId);

						if (i.customId.includes(plantGame.emojiToFind)) {

							if (!i.customId.includes(plantEmojis.toAvoid)) {
								/* The button the player choses is overwritten to be green here, only because we are sure that they actually chose corectly. */
								exploreComponent = plantGame.chosenRightButtonOverwrite(i.customId);

								points += 2;
							}
							else { points -= 2; }
						}

						return i;
					})
					.catch(() => {

						points -= 2;
						return newInteraction;
					});

				exploreComponent.setComponents(exploreComponent.components.map(c => c.setDisabled(true)));

				totalCycles += 1;

				if (totalCycles < 3) {

					await interactionCollector(interaction, userData, serverData, newInteraction, exploreComponent);
					return;
				}
				buttonInteraction = newInteraction;

				const levelDifference = userData.quid.profile.levels - environmentLevel;
				points += levelDifference; // It doesn't matter if this is higher than 6 or lower than -6, it will not affect the weighted table
				const outcome = pullFromWeightedTable({ 0: -1 * points, 1: 6 - Math.abs(points), 2: points });

				if (outcome === 2) {

					await userData.update(
						(u) => {
							const p = getMapData(getMapData(u.quids, userData!.quid!._id).profiles, interaction.guildId);
							if (keyInObject(p.inventory.commonPlants, foundItem)) { p.inventory.commonPlants[foundItem] += 1; }
							else if (keyInObject(p.inventory.uncommonPlants, foundItem)) { p.inventory.uncommonPlants[foundItem] += 1; }
							else { p.inventory.rarePlants[foundItem] += 1; }
						},
					);

					embed.setDescription(`*${userData.quid.name} gently lowers ${userData.quid.pronoun(2)} head, picking up the ${foundItem} and carrying it back in ${userData.quid.pronoun(2)} mouth. What a success!*`);

					embed.setFooter({ text: `${changedCondition.statsUpdateText}\n\n+1 ${foundItem}` });
				}
				else if (outcome === 1) {

					if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Warm) {

						embed.setDescription(`*${userData.quid.name} tries really hard to pick up the ${foundItem} that ${userData.quid.pronoun(0)} discovered in a small, lone bush. But as the ${userData.quid.getDisplayspecies()} tries to pick it up, it just breaks into little pieces.*`);
					}
					else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Cold) {

						embed.setDescription(`*${userData.quid.name} tries really hard to pick up the ${foundItem} that ${userData.quid.pronoun(0)} discovered at the end of a tree trunk. But as the ${userData.quid.getDisplayspecies()} tries to pick it up, it just breaks into little pieces.*`);
					}
					else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Water) {

						embed.setDescription(`*${userData.quid.name} tries really hard to pick up the ${foundItem} that ${userData.quid.pronoun(0)} discovered among large algae. But as the ${userData.quid.getDisplayspecies()} tries to pick it up, it just breaks into little pieces.*`);
					}
					else { throw new Error('userData.quid species habitat not found'); }
					if (changedCondition.statsUpdateText) { embed.setFooter({ text: changedCondition.statsUpdateText }); }
				}
				else {

					const healthPoints = getSmallerNumber(userData.quid.profile.health, getRandomNumber(5, 3));

					const allElderlyUsersArray = await userModel.find(
						(u) => {
							return Object.values(u.quids).filter(q => {
								const p = q.profiles[interaction.guildId];
								return p !== undefined && p.rank === RankType.Elderly;
							}).length > 0;
						});

					if (getRandomNumber(2) === 0 && allElderlyUsersArray.length > 0) {

						userData.quid.profile.injuries.poison = true;

						if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Warm) {

							embed.setDescription(`*Piles of sand and lone, scraggly bushes are dotting the landscape all around ${userData.quid.name}. ${capitalizeString(userData.quid.pronounAndPlural(0, 'pad'))} through the scattered branches from long-dead trees, carefully avoiding the cacti, trying to reach the ${foundItem} ${userData.quid.pronoun(0)} saw. The ${userData.quid.getDisplayspecies()} steps on a root but feels it twist and pulse before it leaps from its camouflage and latches onto ${userData.quid.pronoun(2)} body. The snake pumps poison into ${userData.quid.pronoun(1)} while ${userData.quid.pronounAndPlural(0, 'lashes', 'lash')} around, trying to throw it off, finally succeeding and rushing away.*`);
						}
						else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Cold) {

							embed.setDescription(`*Many sticks and roots are popping up all around ${userData.quid.name}. ${capitalizeString(userData.quid.pronounAndPlural(0, 'shuffle'))} through the fallen branches and twisting vines, trying to reach the ${foundItem} ${userData.quid.pronoun(0)} found. The ${userData.quid.getDisplayspecies()} steps on a root but feels it weave and pulse before it leaps from its camouflage and latches onto ${userData.quid.pronoun(2)} body. The snake pumps poison into ${userData.quid.pronoun(1)} while ${userData.quid.pronounAndPlural(0, 'lashes', 'lash')} around, trying to throw it off, finally succeeding and rushing away.*`);
						}
						else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Water) {

							embed.setDescription(`*Many plants and jellyfish are popping up all around ${userData.quid.name}. ${capitalizeString(userData.quid.pronounAndPlural(0, 'weave'))} through the jellyfish and twisting kelp, trying to reach the ${foundItem} ${userData.quid.pronoun(0)} found. The ${userData.quid.getDisplayspecies()} pushes through a piece of kelp but feels it twist and pulse before it latches onto ${userData.quid.pronoun(2)} body. The jellyfish wraps ${userData.quid.pronoun(1)} with its stingers, poison flowing into ${userData.quid.pronoun(1)} while ${userData.quid.pronounAndPlural(0, 'thrashes', 'trash')} around trying to throw it off, finally succeeding and rushing away to the surface.*`);
						}
						else { throw new Error('userData.quid species habitat not found'); }
						embed.setFooter({ text: `-${healthPoints} HP (from poison)\n${changedCondition.statsUpdateText}` });
					}
					else if (getRandomNumber(2) === 0 && userData.quid.profile.injuries.cold == false) {

						userData.quid.profile.injuries.cold = true;

						if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Warm) {

							embed.setDescription(`*${userData.quid.name} pads along the ground, dashing from bush to bush, inspecting every corner for something ${userData.quid.pronoun(0)} could add to the inventory. Suddenly, the ${userData.quid.getDisplayspecies()} sways, feeling tired and feeble. A coughing fit grew louder, escaping ${userData.quid.pronoun(2)} throat.*`);
						}
						else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Cold) {

							embed.setDescription(`*${userData.quid.name} plots around the forest, dashing from tree to tree, inspecting every corner for something ${userData.quid.pronoun(0)} could add to the inventory. Suddenly, the ${userData.quid.getDisplayspecies()} sways, feeling tired and feeble. A coughing fit grew louder, escaping ${userData.quid.pronoun(2)} throat.*`);
						}
						else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Water) {

							embed.setDescription(`*${userData.quid.name} flips around in the water, swimming from rock to rock, inspecting every nook for something ${userData.quid.pronoun(0)} could add to the inventory. Suddenly, the ${userData.quid.getDisplayspecies()} falters in ${userData.quid.pronoun(2)} stroke, feeling tired and feeble. A coughing fit grew louder, bubbles escaping ${userData.quid.pronoun(2)} throat to rise to the surface.*`);
						}
						else { throw new Error('userData.quid species habitat not found'); }
						embed.setFooter({ text: `-${healthPoints} HP (from cold)\n${changedCondition.statsUpdateText}` });

					}
					else {

						userData.quid.profile.injuries.infections += 1;

						if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Warm) {

							embed.setDescription(`*The soft noise of sand shifting on the ground spooks ${userData.quid.name} as ${userData.quid.pronounAndPlural(0, 'walk')} around the area, searching for something useful for ${userData.quid.pronoun(2)} pack. A warm wind brushes against ${userData.quid.pronoun(2)} side, and a cactus bush sweeps atop ${userData.quid.pronoun(2)} path, going unnoticed. A needle pricks into ${userData.quid.pronoun(2)} skin, sending pain waves through ${userData.quid.pronoun(2)} body. While removing the needle ${userData.quid.name} notices how swollen the wound looks. It is infected.*`);
						}
						else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Cold) {

							embed.setDescription(`*The thunks of acorns falling from trees spook ${userData.quid.name} as ${userData.quid.pronounAndPlural(0, 'prance')} around the forest, searching for something useful for ${userData.quid.pronoun(2)} pack. A warm wind brushes against ${userData.quid.pronoun(2)} side, and a thorn bush sweeps atop ${userData.quid.pronoun(2)} path, going unnoticed. A thorn pricks into ${userData.quid.pronoun(2)} skin, sending pain waves through ${userData.quid.pronoun(2)} body. While removing the thorn ${userData.quid.name} notices how swollen the wound looks. It is infected.*`);
						}
						else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Water) {

							embed.setDescription(`*The sudden silence in the water spooks ${userData.quid.name} as ${userData.quid.pronounAndPlural(0, 'swim')} around in the water, searching for something useful for ${userData.quid.pronoun(2)} pack. A rocky outcropping appears next to ${userData.quid.pronoun(1)}, unnoticed. The rocks scrape into ${userData.quid.pronoun(2)} side, sending shockwaves of pain up ${userData.quid.pronoun(2)} flank. ${userData.quid.name} takes a closer look and notices how swollen the wound is. It is infected.*`);
						}
						else { throw new Error('userData.quid species habitat not found'); }
						embed.setFooter({ text: `-${healthPoints} HP (from infection)\n${changedCondition.statsUpdateText}` });
					}

					await userData.update(
						(u) => {
							const p = getMapData(getMapData(u.quids, userData.quid._id).profiles, interaction.guildId);
							p.health -= healthPoints;
							p.injuries = userData.quid.profile.injuries;
						},
					);
				}
			})(interaction, userData, serverData, int);
		}
	}
	// Find an enemy
	else {

		/* First we are calculating needed meat - existing meat through simulateMeatUse three times, of which two it is calculated for active users only. The results of these are added together and divided by 3 to get their average. This is then used to get a random number that can be between 1 higher and 1 lower than that. The user's level is added with this, and it is limited to not be below 1. */
		const simAverage = Math.round((await simulateMeatUse(serverData, true) + await simulateMeatUse(serverData, true) + await simulateMeatUse(serverData, false)) / 3);
		const opponentLevel = getBiggerNumber(1, userData.quid.profile.levels + getRandomNumber(3, simAverage - 1));

		const opponentsArray = speciesInfo[userData.quid.species].biome1OpponentArray.concat([
			...(chosenBiomeNumber > 0 ? speciesInfo[userData.quid.species].biome2OpponentArray : []),
			...(chosenBiomeNumber === 2 ? speciesInfo[userData.quid.species].biome3OpponentArray : []),
		]);
		const opponentSpecies = pickMeat(opponentsArray, serverData.inventory);

		if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Warm) {

			embed.setDescription(`*${userData.quid.name} creeps close to the ground, ${userData.quid.pronoun(2)} pelt blending with the sand surrounding ${userData.quid.pronoun(1)}. The ${userData.quid.getDisplayspecies()} watches a pile of shrubs, ${userData.quid.pronoun(2)} eyes flitting around before catching a motion out of the corner of ${userData.quid.pronoun(2)} eyes. A particularly daring ${opponentSpecies} walks on the ground surrounding the bushes before sitting down and cleaning itself.*`);
		}
		else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Cold) {

			embed.setDescription(`*${userData.quid.name} pads silently to the clearing, stopping just shy of leaving the safety of the thick trees that housed ${userData.quid.pronoun(2)} pack, camp, and home. A lone ${opponentSpecies} stands in the clearing, snout in the stream that cuts the clearing in two, leaving it unaware of the ${userData.quid.getDisplayspecies()} a few meters behind it, ready to pounce.*`);
		}
		else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Water) {

			embed.setDescription(`*${userData.quid.name} hides behind some kelp, looking around the clear water for any prey. A lone ${opponentSpecies} swims around aimlessly, not alarmed of any potential attacks. The ${userData.quid.getDisplayspecies()} gets in position, contemplating an ambush.*`);
		}
		else { throw new Error('userData.quid species habitat not found'); }
		embed.setFooter({ text: `The ${opponentSpecies} is level ${opponentLevel}.\nYou will be presented three buttons: Attack, dodge and defend. Your opponent chooses one of them, and you have to choose which button is the correct response.` });

		await (async function(messageObject) { return buttonInteraction ? await update(buttonInteraction, messageObject) : await respond(interaction, messageObject, true); })({
			content: messageContent,
			embeds: [...restEmbed, embed],
			components: [new ActionRowBuilder<ButtonBuilder>()
				.setComponents(new ButtonBuilder()
					.setCustomId('fight')
					.setLabel('Fight')
					.setEmoji('⚔️')
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId('flee')
					.setLabel('Flee')
					.setEmoji('💨')
					.setStyle(ButtonStyle.Primary))],
		});

		const int = await (botReply as Message<true>)
			.awaitMessageComponent({
				filter: i => i.user.id === interaction.user.id,
				componentType: ComponentType.Button,
				time: 30_000,
			})
			.then(async int => {

				buttonInteraction = int;
				if (int.customId.includes('flee')) { return undefined; }
				return int;
			})
			.catch(() => { return undefined; });

		if (int === undefined) {

			if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Warm) {

				embed.setDescription(`*${userData.quid.name} eyes the ${opponentSpecies}, which is still unaware of the possible danger. The ${userData.quid.getDisplayspecies()} paces, still unsure whether to attack. Suddenly, the ${userData.quid.getDisplayspecies()}'s head shoots up as it tries to find the source of the sound before running away. Looks like this hunt was unsuccessful.*`);
			}
			else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Cold) {

				embed.setDescription(`*The ${opponentSpecies} sits in the clearing, unaware of ${userData.quid.name} hiding in the thicket behind it. The ${userData.quid.getDisplayspecies()} watches as the animal gets up, shakes the loose water droplets from its mouth, and walks into the forest, its shadow fading from ${userData.quid.name}'s sight. Looks like this hunt was unsuccessful.*`);
			}
			else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Water) {

				embed.setDescription(`*${userData.quid.name} looks at the ${opponentSpecies}, which is still unaware of ${userData.quid.pronoun(1)} watching through the kelp. Subconsciously, the ${userData.quid.getDisplayspecies()} starts swimming back and fourth, still unsure whether to attack. The ${opponentSpecies}'s head turns in a flash to eye the suddenly moving kelp before it frantically swims away. Looks like this hunt was unsuccessful.*`);
			}
			else { throw new Error('userData.quid species habitat not found'); }
			if (changedCondition.statsUpdateText) { embed.setFooter({ text: changedCondition.statsUpdateText }); }
		}
		else {

			let totalCycles: 0 | 1 | 2 = 0;
			let points = 0;

			await (async function interactionCollector(
				interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>,
				userData: UserData<never, never>,
				serverData: ServerSchema,
				newInteraction: ButtonInteraction<'cached'>,
				previousExploreComponents?: ActionRowBuilder<ButtonBuilder>,
				lastRoundCycleIndex?: number,
			): Promise<void> {


				const fightGame = createFightGame(totalCycles, lastRoundCycleIndex);

				exploreComponent = fightGame.fightComponent;
				if (fightGame.cycleKind === '_attack') {

					embed.setDescription(`⏫ *The ${opponentSpecies} gets ready to attack. ${userData.quid.name} must think quickly about how ${userData.quid.pronounAndPlural(0, 'want')} to react.*`);
					embed.setFooter({ text: 'Click the button that wins against your opponent\'s move (⏫ Attack).' });
				}
				else if (fightGame.cycleKind === 'dodge') {

					embed.setDescription(`↪️ *Looks like the ${opponentSpecies} is preparing a maneuver for ${userData.quid.name}'s next move. The ${userData.quid.getDisplayspecies()} must think quickly about how ${userData.quid.pronounAndPlural(0, 'want')} to react.*`);
					embed.setFooter({ text: 'Click the button that wins against your opponent\'s move (↪️ Dodge).' });
				}
				else if (fightGame.cycleKind === 'defend') {

					embed.setDescription(`⏺️ *The ${opponentSpecies} gets into position to oppose an attack. ${userData.quid.name} must think quickly about how ${userData.quid.pronounAndPlural(0, 'want')} to react.*`);
					embed.setFooter({ text: 'Click the button that wins against your opponent\'s move (⏺️ Defend).' });
				}
				else { throw new Error('cycleKind is not attack, dodge or defend'); }

				botReply = await update(newInteraction, {
					content: messageContent,
					embeds: [...restEmbed, embed],
					components: [...previousExploreComponents ? [previousExploreComponents] : [], exploreComponent],
				});

				/* Here we are making sure that the correct button will be blue by default. If the player choses the correct button, this will be overwritten. */
				exploreComponent = fightGame.correctButtonOverwrite();

				newInteraction = await (botReply as Message<true>)
					.awaitMessageComponent({
						filter: i => i.user.id === interaction.user.id,
						componentType: ComponentType.Button,
						time: responseTime,
					})
					.then(async i => {

						/* Here we make the button the player choses red, this will apply always except if the player choses the correct button, then this will be overwritten. */
						exploreComponent = fightGame.chosenWrongButtonOverwrite(i.customId);

						if ((i.customId.includes('_attack') && fightGame.cycleKind === 'dodge')
							|| (i.customId.includes('defend') && fightGame.cycleKind === '_attack')
							|| (i.customId.includes('dodge') && fightGame.cycleKind === 'defend')) {

							points -= 2;
						}
						else if ((i.customId.includes('_attack') && fightGame.cycleKind === 'defend')
							|| (i.customId.includes('defend') && fightGame.cycleKind === 'dodge')
							|| (i.customId.includes('dodge') && fightGame.cycleKind === '_attack')) {

							/* The button the player choses is overwritten to be green here, only because we are sure that they actually chose corectly. */
							exploreComponent = fightGame.chosenRightButtonOverwrite(i.customId);

							points += 2;
						}

						return i;
					})
					.catch(() => {

						points -= 2;
						return newInteraction;
					});

				exploreComponent.setComponents(exploreComponent.components.map(c => c.setDisabled(true)));

				totalCycles += 1;

				if (totalCycles < 3) {

					await interactionCollector(interaction, userData, serverData, newInteraction, exploreComponent, fightGame.thisRoundCycleIndex);
					return;
				}
				buttonInteraction = newInteraction;

				const levelDifference = userData.quid.profile.levels - opponentLevel;
				points += levelDifference; // It doesn't matter if this is higher than 6 or lower than -6, it will not affect the weighted table
				const outcome = pullFromWeightedTable({ 0: -1 * points, 1: 6 - Math.abs(points), 2: points });

				if (outcome === 2) {

					await userData.update(
						(u) => {
							const p = getMapData(getMapData(u.quids, userData.quid._id).profiles, interaction.guildId);
							p.inventory.meat[opponentSpecies] += 1;
						},
					);

					if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Warm) {

						embed.setDescription(`*${userData.quid.name} shakes the sand from ${userData.quid.pronoun(2)} paws, the still figure of the ${opponentSpecies} casting a shadow for ${userData.quid.pronoun(1)} to rest in before returning home with the meat. ${capitalizeString(userData.quid.pronounAndPlural(0, 'turn'))} to the dead ${opponentSpecies} to start dragging it back to camp. The meat would be well-stored in the camp, added to the den of food for the night, after being cleaned.*`);
					}
					else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Cold) {

						embed.setDescription(`*${userData.quid.name} licks ${userData.quid.pronoun(2)} paws, freeing the dirt that is under ${userData.quid.pronoun(2)} claws. The ${userData.quid.getDisplayspecies()} turns to the dead ${opponentSpecies} behind ${userData.quid.pronoun(1)}, marveling at the size of it. Then, ${capitalizeString(userData.quid.pronounAndPlural(0, 'grab'))} the ${opponentSpecies} by the neck, dragging it into the bushes and back to the camp.*`);
					}
					else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Water) {

						embed.setDescription(`*The ${userData.quid.getDisplayspecies()} swims quickly to the surface, trying to stay as stealthy and unnoticed as possible. ${capitalizeString(userData.quid.pronounAndPlural(0, 'break'))} the surface, gain ${userData.quid.pronoun(2)} bearing, and the ${userData.quid.getDisplayspecies()} begins swimming to the shore, dragging the dead ${opponentSpecies} up the shore to the camp.*`);
					}
					else { throw new Error('userData.quid species habitat not found'); }
					embed.setFooter({ text: `${changedCondition.statsUpdateText}\n\n+1 ${opponentSpecies}` });
				}
				else if (outcome === 1) {

					if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Warm) {

						embed.setDescription(`*${userData.quid.name} and the ${opponentSpecies} are snarling at one another as they retreat to the opposite sides of the hill, now stirred up and filled with sticks from the surrounding bushes. The ${userData.quid.getDisplayspecies()} runs back to camp, ${userData.quid.pronoun(2)} mouth empty as before.*`);
					}
					else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Cold) {

						embed.setDescription(`*${userData.quid.name} and the ${opponentSpecies} are snarling at one another as they retreat into the bushes surrounding the clearing, now covered in trampled grass and loose clumps of dirt. The ${userData.quid.getDisplayspecies()} runs back to camp, ${userData.quid.pronoun(2)} mouth empty as before.*`);
					}
					else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Water) {

						embed.setDescription(`*${userData.quid.name} and the ${opponentSpecies} glance at one another as they swim in opposite directions from the kelp, now cloudy from the stirred up dirt. The ${userData.quid.getDisplayspecies()} swims back to camp, ${userData.quid.pronoun(2)} mouth empty as before.*`);
					}
					else { throw new Error('userData.quid species habitat not found'); }
					if (changedCondition.statsUpdateText) { embed.setFooter({ text: changedCondition.statsUpdateText }); }
				}
				else {

					const healthPoints = getSmallerNumber(userData.quid.profile.health, getRandomNumber(5, 3));

					if (getRandomNumber(2) === 0) {

						userData.quid.profile.injuries.wounds += 1;

						if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Warm) {

							embed.setDescription(`*The ${userData.quid.getDisplayspecies()} rolls over in the sand, pinned down by the ${opponentSpecies}.* "Get off my territory," *it growls before walking away from the shaking form of ${userData.quid.name} laying on the sand. ${capitalizeString(userData.quid.pronounAndPlural(0, 'let'))} the ${opponentSpecies} walk away for a little, trying to put space between the two animals. After catching ${userData.quid.pronoun(2)} breath, the ${userData.quid.getDisplayspecies()} pulls ${userData.quid.pronoun(4)} off the ground, noticing sand sticking to ${userData.quid.pronoun(2)} side. ${capitalizeString(userData.quid.pronounAndPlural(0, 'shake'))} ${userData.quid.pronoun(2)} body, sending bolts of pain up ${userData.quid.pronoun(2)} side from the wound. ${capitalizeString(userData.quid.pronounAndPlural(0, 'slowly walk'))} away from the valley that the ${opponentSpecies} was sitting in before running back towards camp.*`);
						}
						else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Cold) {

							embed.setDescription(`*${userData.quid.name} runs into the brush, trying to avoid making the wound from the ${opponentSpecies} any worse than it already is. The ${userData.quid.getDisplayspecies()} stops and confirms that the ${opponentSpecies} isn't following ${userData.quid.pronoun(1)}, before walking back inside the camp borders.*`);
						}
						else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Water) {

							embed.setDescription(`*Running from the ${opponentSpecies}, ${userData.quid.name} flips and spins around in the water, trying to escape from the grasp of the animal behind ${userData.quid.pronoun(1)}. ${capitalizeString(userData.quid.pronounAndPlural(0, 'slip'))} into a small crack in a wall, waiting silently for the creature to give up. Finally, the ${opponentSpecies} swims away, leaving the ${userData.quid.getDisplayspecies()} alone. Slowly emerging from the crevice, ${userData.quid.name} flinches away from the wall as ${userData.quid.pronounAndPlural(0, 'hit')} it, a wound making itself known from the fight. Hopefully, it can be treated back at the camp.*`);
						}
						else { throw new Error('userData.quid species habitat not found'); }
						embed.setFooter({ text: `-${healthPoints} HP (from wound)\n${changedCondition.statsUpdateText}` });
					}
					else {

						userData.quid.profile.injuries.sprains += 1;

						if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Warm) {

							embed.setDescription(`*${userData.quid.name} limps back to camp, ${userData.quid.pronoun(2)} paw sprained from the fight with the ${opponentSpecies}. Only barely did ${userData.quid.pronoun(0)} get away, leaving the enemy alone in the sand that is now stirred up and filled with sticks from the surrounding bushes. Maybe next time, the ${userData.quid.getDisplayspecies()} will be successful in ${userData.quid.pronoun(2)} hunt.*`);
						}
						else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Cold) {

							embed.setDescription(`*${userData.quid.name} limps back to camp, ${userData.quid.pronoun(2)} paw sprained from the fight with the ${opponentSpecies}. Only barely did ${userData.quid.pronoun(0)} get away, leaving the enemy alone in a clearing now filled with trampled grass and dirt clumps. Maybe next time, the ${userData.quid.getDisplayspecies()} will be successful in ${userData.quid.pronoun(2)} hunt.*`);
						}
						else if (speciesInfo[userData.quid.species].habitat === SpeciesHabitatType.Water) {

							embed.setDescription(`*${userData.quid.name} swims back to camp in pain, ${userData.quid.pronoun(2)} fin sprained from the fight with the ${opponentSpecies}. Only barely did ${userData.quid.pronoun(0)} get away, leaving the enemy alone in the water that is now cloudy from the stirred up dirt. Maybe next time, the ${userData.quid.getDisplayspecies()} will be successful in ${userData.quid.pronoun(2)} hunt.*`);
						}
						else { throw new Error('userData.quid species habitat not found'); }
						embed.setFooter({ text: `-${healthPoints} HP (from sprain)\n${changedCondition.statsUpdateText}` });

					}

					await userData.update(
						(u) => {
							const p = getMapData(getMapData(u.quids, userData.quid._id).profiles, interaction.guildId);
							p.health -= healthPoints;
							p.injuries = userData.quid.profile.injuries;
						},
					);
				}
			})(interaction, userData, serverData, int);
		}
	}

	cooldownMap.set(userData._id + interaction.guildId, false);
	const levelUpEmbed = await checkLevelUp(interaction, userData, serverData);

	if (foundQuest) {

		await userData.update(
			(u) => {
				const p = getMapData(getMapData(u.quids, userData!.quid!._id).profiles, interaction.guildId);
				p.hasQuest = true;
			},
		);

		botReply = await sendQuestMessage(buttonInteraction || interaction, userData, serverData, messageContent, restEmbed, [...changedCondition.injuryUpdateEmbed, ...levelUpEmbed], changedCondition.statsUpdateText);
	}
	else {

		botReply = await (async function(messageObject) { return buttonInteraction ? await update(buttonInteraction, messageObject) : await respond(interaction, messageObject, true); })({
			content: messageContent,
			embeds: [
				...restEmbed,
				embed,
				...changedCondition.injuryUpdateEmbed,
				...levelUpEmbed,
			],
			components: [
				...(exploreComponent ? [exploreComponent] : []),
				new ActionRowBuilder<ButtonBuilder>()
					.setComponents(new ButtonBuilder()
						.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData._id, ['new', ...(stringInput ? [stringInput] : []) as [string]]))
						.setLabel('Explore again')
						.setStyle(ButtonStyle.Primary)),
			],
		});
	}

	await isPassedOut(interaction, userData, true);

	await coloredButtonsAdvice(interaction, userData);
	await restAdvice(interaction, userData);
	await drinkAdvice(interaction, userData);
	await eatAdvice(interaction, userData);

	if (userData.advice.ginkgosapling === false && foundSapling) {

		await userData.update(
			(u) => {
				u.advice.ginkgosapling = true;
			},
		);

		await respond(interaction, {
			content: `${interaction.user.toString()} ❓ **Tip:**\nA Ginkgo sapling gives you more luck the older it gets. For example, you might find better items or be more often successful with healing or repairing.`,
		}, false);
	}
}

function getWaitingMessageObject(
	messageContent: string,
	restEmbed: EmbedBuilder[],
	userData: UserData<never, never>,
	waitingString: string,
	waitingGameField: string[][],
	waitingComponent: ActionRowBuilder<ButtonBuilder>,
): { content: string; embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[]; } {

	return {
		content: messageContent,
		embeds: [...restEmbed, new EmbedBuilder()
			.setColor(userData.quid.color)
			.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
			.setDescription(waitingString + waitingGameField.map(v => v.join('')).join('\n'))
			.setFooter({ text: 'This game is voluntary to skip waiting time. If you don\'t mind waiting, you can ignore this game.' })],
		components: [waitingComponent],
	};
}

function getWaitingComponent(
	waitingGameField: string[][],
	playerPos: Position,
	empty: string,
	goal: string,
): ActionRowBuilder<ButtonBuilder> {

	return new ActionRowBuilder<ButtonBuilder>()
		.setComponents([
			new ButtonBuilder()
				.setCustomId('left')
				.setEmoji('⬅️')
				.setDisabled(waitingGameField[playerPos.row]?.[playerPos.column - 1] !== empty && waitingGameField[playerPos.row]?.[playerPos.column - 1] !== goal)
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId('up')
				.setEmoji('⬆️')
				.setDisabled(waitingGameField[playerPos.row - 1]?.[playerPos.column] !== empty && waitingGameField[playerPos.row - 1]?.[playerPos.column] !== goal)
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId('down')
				.setEmoji('⬇️')
				.setDisabled(waitingGameField[playerPos.row + 1]?.[playerPos.column] !== empty && waitingGameField[playerPos.row + 1]?.[playerPos.column] !== goal)
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId('right')
				.setEmoji('➡️')
				.setDisabled(waitingGameField[playerPos.row]?.[playerPos.column + 1] !== empty && waitingGameField[playerPos.row]?.[playerPos.column + 1] !== goal)
				.setStyle(ButtonStyle.Secondary),
		]);
}

function getAvailableBiomes(
	userData: UserData<never, never>,
): readonly [string, string, string] | readonly [string, string] | readonly [string] {

	const array = {
		[SpeciesHabitatType.Cold]: ['forest', 'taiga', 'tundra'] as const,
		[SpeciesHabitatType.Warm]: ['shrubland', 'savanna', 'desert'] as const,
		[SpeciesHabitatType.Water]: ['river', 'coral reef', 'ocean'] as const,
	}[speciesInfo[userData.quid.species].habitat];

	return userData.quid.profile.rank === RankType.Elderly ? array : userData.quid.profile.rank === RankType.Healer || userData.quid.profile.rank === RankType.Hunter ? [array[0], array[1]] as const : [array[0]] as const;
}