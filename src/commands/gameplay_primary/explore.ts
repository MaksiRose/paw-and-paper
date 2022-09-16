import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, Message, SlashCommandBuilder } from 'discord.js';
import { Inventory, Profile, Quid, RankType, ServerSchema, SlashCommand, SpeciesHabitatType, speciesInfo, SpeciesNames, UserSchema } from '../../typedef';
import { hasCompletedAccount, isInGuild } from '../../utils/checkUserState';
import { hasFullInventory, isInvalid, isPassedOut } from '../../utils/checkValidity';
import { pronoun, pronounAndPlural, upperCasePronoun, upperCasePronounAndPlural } from '../../utils/getPronouns';
import { capitalizeString, getMapData, getSmallerNumber, keyInObject, respond, update } from '../../utils/helperFunctions';
import { remindOfAttack, startAttack } from './attack';
import Fuse from 'fuse.js';
import { disableAllComponents } from '../../utils/componentDisabling';
import { cooldownMap, serverActiveUsersMap } from '../../events/interactionCreate';
import { createFightGame, createPlantGame, plantEmojis } from '../../utils/gameBuilder';
import { getRandomNumber, pullFromWeightedTable } from '../../utils/randomizers';
import { changeCondition, pickRandomCommonPlant, pickRandomMaterial, pickRandomRarePlant, pickRandomUncommonPlant } from '../../utils/changeCondition';
import userModel from '../../models/userModel';
import { sendQuestMessage } from './start-quest';
import { checkLevelUp } from '../../utils/levelHandling';
import { coloredButtonsAdvice, drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';

type Position = { row: number, column: number; };
const name: SlashCommand['name'] = 'explore';
const description: SlashCommand['description'] = 'The main activity of every rank above Younglings. Find meat and herbs. Costs energy, but gives XP.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.addStringOption(option =>
			option.setName('biome')
				.setDescription('The biome you want to explore')
				.setAutocomplete(true)
				.setRequired(false))
		.setDMPermission(false)
		.toJSON(),
	disablePreviousCommand: true,
	sendAutocomplete: async (client, interaction, userData, serverData) => {

		if (!serverData || !interaction.inGuild()) { return; }
		if (!userData) { return; }
		const focusedValue = interaction.options.getFocused();

		/* Gets the current active quid and the server profile from the account */
		const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId));
		const profileData = getMapData(quidData.profiles, interaction.guildId);

		let choices = getAvailableBiomes(quidData, profileData);

		const fuse = new Fuse(choices);
		if (focusedValue.length > 0) { choices = fuse.search(focusedValue).map(value => value.item); }

		await interaction.respond(
			choices.slice(0, 25).map(choice => ({ name: choice, value: choice })),
		);
	},
	sendCommand: async (client, interaction, userData, serverData, embedArray) => {

		await executeExploring(interaction, userData, serverData, embedArray);
	},
};

export async function executeExploring(
	interaction: ChatInputCommandInteraction | ButtonInteraction,
	userData: UserSchema | null,
	serverData: ServerSchema | null,
	embedArray: EmbedBuilder[],
): Promise<void> {

	/* This ensures that the user is in a guild and has a completed account. */
	if (!isInGuild(interaction)) { return; }
	if (!serverData) { throw new Error('serverData is null'); }
	if (!hasCompletedAccount(interaction, userData)) { return; }

	/* Gets the current active quid and the server profile from the account */
	const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId));
	let profileData = getMapData(quidData.profiles, interaction.guildId);

	/* Checks if the profile is resting, on a cooldown or passed out. */
	if (await isInvalid(interaction, userData, quidData, profileData, embedArray)) { return; }

	let messageContent = remindOfAttack(interaction.guildId);

	if (await hasFullInventory(interaction, quidData, profileData, embedArray, messageContent)) { return; }

	/* Checks  if the user is a Youngling and sends a message that they are too young if they are. */
	if (profileData.rank === RankType.Youngling) {

		await respond(interaction, {
			content: messageContent,
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(quidData.color)
				.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL })
				.setDescription(`*A hunter cuts ${quidData.name} as they see ${pronoun(quidData, 1)} running towards the pack borders.* "You don't have enough experience to go into the wilderness, ${profileData.rank}," *they say.*`)],
		}, true)
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	cooldownMap.set(userData.uuid + interaction.guildId, true);

	/* Here we are getting the biomes available to the quid, getting a user input if there is one, and defining chosenBiome as the user input if it matches an available biome, else it is null. */
	const availableBiomes = getAvailableBiomes(quidData, profileData);
	const stringInput = interaction.isChatInputCommand() ? interaction.options.getString('biome')?.toLowerCase() : interaction.customId.split('_')[2]?.toLowerCase();
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
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(quidData.color)
				.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL })
				.setDescription(`*${quidData.name} is longing for adventure as ${pronounAndPlural(quidData, 0, 'look')} into the wild outside of camp. All there is to decide is where the journey will lead ${pronoun(quidData, 1)}.*`)],
			components: [biomeComponent],
		}, true)
			.catch((error) => { throw new Error(error); });

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

				cooldownMap.set(userData!.uuid + interaction.guildId, false);
				await respond(interaction, { components: disableAllComponents(getBiomeMessage.components) }, true)
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});

				return null;
			});
	}

	/* chosenBiomeNumber is defined based on the index position of the chosenBiome in availableBiomes. chosenBiome should now either be found in availableBiomes, or it should be null, in which case chosenBiomeNumber is -1 and the explore command ends. */
	const chosenBiomeNumber = availableBiomes.findIndex(index => index === chosenBiome);
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

	const selectableEmojis = plantEmojis.habitat[speciesInfo[quidData.species as SpeciesNames].habitat];

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

	const waitingString = `*${quidData.name} slips out of camp, ${pronoun(quidData, 2)} body disappearing in the morning mist. For a while ${pronoun(quidData, 0)} will look around in the ${chosenBiome}, searching for anything of use…*\n`;


	/* The player position is updated, we don't really need to remember the old one. so we have the playerPos, which then gets saved in the collect event temporarily while this one gets overwritten. The oldGoalPos however needs to get remembered so that the goal doesn't move back to where it comes from. So we need where it was in the previous round, where it is in this round, and where it will go. for this reason, we are saving it here, and it gets overwritten with where it was (not where it moved) after a round is over */
	let _row = waitingGameField.findIndex(v => v.some(e => e === player));
	const playerPos: Position = { row: _row, column: waitingGameField[_row]?.findIndex(e => e === player) ?? -1 };

	_row = waitingGameField.findIndex(v => v.some(e => e === goal));
	let oldGoalPos: Position = { row: _row, column: waitingGameField[_row]?.findIndex(e => e === goal) ?? -1 };

	let waitingComponent = getWaitingComponent(waitingGameField, playerPos, empty);

	let botReply = await (async function(messageObject) { return buttonInteraction ? await update(buttonInteraction, messageObject) : await respond(interaction, messageObject, true); })(getWaitingMessageObject(messageContent, embedArray, quidData, waitingString, waitingGameField, waitingComponent))
		.catch((error) => { throw new Error(error); });
	buttonInteraction = null;


	const collector = botReply.createMessageComponentCollector({
		filter: (i) => i.user.id === interaction.user.id,
		time: 15_000,
	});

	collector.on('collect', async int => {

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
		) { collector.stop(); }

		waitingComponent = getWaitingComponent(waitingGameField, playerPos, empty);

		botReply = await update(int, getWaitingMessageObject(messageContent, embedArray, quidData, waitingString, waitingGameField, waitingComponent))
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
				return botReply;
			});
	});

	await new Promise<void>(resolve => {

		collector.on('end', async () => { resolve(); });

		setTimeout(() => { resolve(); }, 20_000);
	});

	const experiencePoints = chosenBiomeNumber == 2 ? getRandomNumber(41, 20) : chosenBiomeNumber == 1 ? getRandomNumber(21, 10) : getRandomNumber(11, 5);
	const changedCondition = await changeCondition(userData, quidData, profileData, experiencePoints);
	profileData = changedCondition.profileData;

	const responseTime = chosenBiomeNumber === 2 ? 3_000 : chosenBiomeNumber === 1 ? 4_000 : 5_000;
	const embed = new EmbedBuilder()
		.setColor(quidData.color)
		.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL });
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
	const serverInventoryCount = (Object.entries(profileData.inventory) as [keyof Inventory, Inventory[keyof Inventory]][]).map(([key, type]) => key === 'materials' ? [] : Object.values(type)).flat().reduce((a, b) => a + b);

	let foundQuest = false;
	// If the server has more items than 8 per profile (It's 2 more than counted when the humans spawn, to give users a bit of leeway), there is no attack, and the next possible attack is possible, start an attack
	if (serverInventoryCount > highRankProfilesCount * 8
		&& remindOfAttack(interaction.guildId) === null
		&& serverData.nextPossibleAttack <= Date.now()) {

		// The numerator is the amount of items above 7 per profile, the denominator is the amount of profiles
		const humanCount = Math.round((serverInventoryCount - (highRankProfilesCount * 7)) / highRankProfilesCount);
		startAttack(interaction, humanCount);

		messageContent = serverActiveUsersMap.get(interaction.guildId)?.map(user => `<@${user}>`).join(' ') ?? null;
		embed.setDescription(`*${quidData.name} has just been looking around for food when ${pronounAndPlural(quidData, 0, 'suddenly hear')} voices to ${pronoun(quidData, 2)} right. Cautiously ${pronounAndPlural(quidData, 0, 'creep')} up, and sure enough: a group of humans! It looks like it's around ${humanCount}. They seem to be discussing something, and keep pointing over towards where the pack is lying. Alarmed, the ${quidData.displayedSpecies || quidData.species} runs away. **${upperCasePronoun(quidData, 0)} must gather as many packmates as possible to protect the pack!***`);
		embed.setFooter({ text: `${changedCondition.statsUpdateText}\n\nYou have two minutes to prepare before the humans will attack!` });
	}
	// If the chosen biome is the highest choosable biome, the user has no quest, has not unlocked a higher rank and they succeed in the chance, get a  quest
	else if (chosenBiomeNumber === (availableBiomes.length - 1)
		&& profileData.hasQuest === false
		&& profileData.unlockedRanks === (profileData.rank === RankType.Apprentice ? 1 : profileData.rank === RankType.Hunter || profileData.rank === RankType.Healer ? 2 : 3)
		&& getRandomNumber((profileData.rank === RankType.Elderly) ? 500 : (profileData.rank === RankType.Hunter || profileData.rank == RankType.Healer) ? 375 : 250, 0) === 0) {

		foundQuest = true;
	}
	// If the user gets the right chance, find sapling or material or nothing
	else if (pullFromWeightedTable({ 0: 10, 1: 90 + profileData.sapling.waterCycles }) === 0) {

		const serverMaterialsCount = Object.values(serverData.inventory.materials).flat().reduce((a, b) => a + b, 0);

		if (!profileData.sapling.exists) {

			userData = await userModel.findOneAndUpdate(
				u => u.uuid === userData!.uuid,
				(u) => {
					const p = getMapData(getMapData(u.quids, getMapData(userData!.currentQuid, interaction.guildId)).profiles, interaction.guildId);
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
			embed.setDescription(`*${quidData.name} is looking around for useful things around ${pronoun(quidData, 1)} when ${pronounAndPlural(quidData, 0, 'discover')} the sapling of a ginkgo tree. The ${quidData.displayedSpecies || quidData.species} remembers that they bring good luck and health. Surely it can't hurt to bring it back to the pack!*`);
			embed.setFooter({ text: changedCondition.statsUpdateText + '\nWater the ginkgo sapling with \'rp water\'.' });
		}
		else if (serverMaterialsCount < 36) {

			const foundMaterial = pickRandomMaterial();

			userData = await userModel.findOneAndUpdate(
				u => u.uuid === userData!.uuid,
				(u) => {
					const p = getMapData(getMapData(u.quids, getMapData(userData!.currentQuid, interaction.guildId)).profiles, interaction.guildId);
					p.inventory.materials[foundMaterial] += 1;
				},
			);

			embed.setDescription(`*${quidData.name} is looking around for things around ${pronoun(quidData, 1)} but there doesn't appear to be anything useful. The ${quidData.displayedSpecies || quidData.species} decides to grab a ${foundMaterial} as to not go back with nothing to show.*`);
			embed.setFooter({ text: `${changedCondition.statsUpdateText}\n\n+1 ${foundMaterial}` });
		}
		else {

			embed.setDescription(`*${quidData.name} trots back into camp, mouth empty, and luck run out. Maybe ${pronoun(quidData, 0)} will go exploring again later, bring something that time!*`);
			embed.setFooter({ text: changedCondition.statsUpdateText });
		}
	}
	// If the user gets the right chance, find a plant
	else if (pullFromWeightedTable({ 0: profileData.rank === RankType.Healer ? 2 : 1, 1: profileData.rank === RankType.Hunter ? 2 : 1 }) === 0) {

		const foundItem = (pullFromWeightedTable({ 0: 70, 1: 30 + profileData.sapling.waterCycles }) == 1 && chosenBiomeNumber > 0) ? (pullFromWeightedTable({ 0: 70, 1: 30 + profileData.sapling.waterCycles }) == 1 && chosenBiomeNumber === 2) ? pickRandomRarePlant() : pickRandomUncommonPlant() : pickRandomCommonPlant();

		if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Warm) {

			embed.setDescription(`*For a while, ${quidData.name} has been trudging through the hot sand, searching in vain for something useful. ${upperCasePronounAndPlural(quidData, 0, 'was', 'were')} about to give up when ${pronounAndPlural(quidData, 0, 'discover')} a ${foundItem} in a small, lone bush. Now ${pronounAndPlural(quidData, 0, 'just need')} to pick it up gently...*`);
		}
		else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Cold) {

			embed.setDescription(`*For a while, ${quidData.name} has been trudging through the dense undergrowth, searching in vain for something useful. ${upperCasePronounAndPlural(quidData, 0, 'was', 'were')} about to give up when ${pronounAndPlural(quidData, 0, 'discover')} a ${foundItem} at the end of a tree trunk. Now ${pronounAndPlural(quidData, 0, 'just need')} to pick it up gently...*`);
		}
		else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Water) {

			embed.setDescription(`*For a while, ${quidData.name} has been swimming through the water, searching in vain for something useful. ${upperCasePronounAndPlural(quidData, 0, 'was', 'were')} about to give up when ${pronounAndPlural(quidData, 0, 'discover')} a ${foundItem} among large algae. Now ${pronounAndPlural(quidData, 0, 'just need')} to pick it up gently...*`);
		}
		else { throw new Error('quidData species habitat not found'); }
		embed.setFooter({ text: `You will be presented five buttons with five emojis each. The footer will show you an emoji, and you have to find the button with that emoji, but without the campsite (${plantEmojis.toAvoid}).` });

		botReply = await respond(interaction, {
			content: messageContent,
			embeds: [...embedArray, embed],
			components: [new ActionRowBuilder<ButtonBuilder>()
				.setComponents(new ButtonBuilder()
					.setCustomId('pickup')
					.setLabel('Pick up')
					.setEmoji('🌿')
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId('leave')
					.setLabel('leave')
					.setEmoji('💨')
					.setStyle(ButtonStyle.Primary))],
		}, true);

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

			embed.setDescription(`*After thinking about it for a moment, ${quidData.name} decides ${pronounAndPlural(quidData, 0, 'is', 'are')} too tired to focus on picking up the plant. It's better to leave it there in case another pack member comes along.*`);
			embed.setFooter({ text: changedCondition.statsUpdateText });
		}
		else {

			let totalCycles: 0 | 1 | 2 = 0;
			let winLoseRatio = 0;

			await (async function interactionCollector(
				interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>,
				userData: UserSchema,
				serverData: ServerSchema,
				newInteraction: ButtonInteraction,
				previousExploreComponents?: ActionRowBuilder<ButtonBuilder>,
			): Promise<void> {


				const plantGame = createPlantGame(speciesInfo[quidData.species as SpeciesNames].habitat);

				exploreComponent = plantGame.plantComponent;
				embed.setFooter({ text: `Click the button with this emoji: ${plantGame.emojiToFind}, but without the campsite (${plantEmojis.toAvoid}).` });

				botReply = await update(newInteraction, {
					content: messageContent,
					embeds: [...embedArray, embed],
					components: [...previousExploreComponents ? [previousExploreComponents] : [], exploreComponent],
				})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
						return botReply;
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

								winLoseRatio += 1;
							}
							else { winLoseRatio -= 1; }
						}

						return i;
					})
					.catch(() => {

						winLoseRatio -= 1;
						return newInteraction;
					});

				exploreComponent.setComponents(exploreComponent.components.map(c => c.setDisabled(true)));

				totalCycles += 1;

				if (totalCycles < 3) {

					await interactionCollector(interaction, userData, serverData, newInteraction, exploreComponent);
					return;
				}

				if (winLoseRatio < 0) { winLoseRatio = 0; }

				winLoseRatio = pullFromWeightedTable({ 0: 3 - winLoseRatio, 1: winLoseRatio % 3, 2: winLoseRatio });

				if (winLoseRatio === 2) {

					userData = await userModel.findOneAndUpdate(
						u => u.uuid === userData!.uuid,
						(u) => {
							const p = getMapData(getMapData(u.quids, getMapData(userData!.currentQuid, interaction.guildId)).profiles, interaction.guildId);
							if (keyInObject(p.inventory.commonPlants, foundItem)) { p.inventory.commonPlants[foundItem] += 1; }
							else if (keyInObject(p.inventory.uncommonPlants, foundItem)) { p.inventory.uncommonPlants[foundItem] += 1; }
							else { p.inventory.rarePlants[foundItem] += 1; }
						},
					);

					embed.setDescription(`*${quidData.name} gently lowers ${pronoun(quidData, 2)} head, picking up the ${foundItem} and carrying it back in ${pronoun(quidData, 2)} mouth. What a success!*`);

					embed.setFooter({ text: `${changedCondition.statsUpdateText}\n\n+1 ${foundItem}` });
				}
				else if (winLoseRatio === 1) {

					if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Warm) {

						embed.setDescription(`*${quidData.name} tries really hard to pick up the ${foundItem} that ${pronoun(quidData, 0)} discovered in a small, lone bush. But as the ${quidData.displayedSpecies || quidData.species} tries to pick it up, it just breaks into little pieces.*`);
					}
					else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Cold) {

						embed.setDescription(`*${quidData.name} tries really hard to pick up the ${foundItem} that ${pronoun(quidData, 0)} discovered at the end of a tree trunk. But as the ${quidData.displayedSpecies || quidData.species} tries to pick it up, it just breaks into little pieces.*`);
					}
					else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Water) {

						embed.setDescription(`*${quidData.name} tries really hard to pick up the ${foundItem} that ${pronoun(quidData, 0)} discovered among large algae. But as the ${quidData.displayedSpecies || quidData.species} tries to pick it up, it just breaks into little pieces.*`);
					}
					else { throw new Error('quidData species habitat not found'); }
					embed.setFooter({ text: changedCondition.statsUpdateText });
				}
				else {

					const healthPoints = getSmallerNumber(profileData.health, getRandomNumber(5, 3));

					const allElderlyUsersArray = await userModel.find(
						(u) => {
							return Object.values(u.quids).filter(q => {
								const p = q.profiles[interaction.guildId];
								return p !== undefined && p.rank === RankType.Elderly;
							}).length > 0;
						});

					if (getRandomNumber(2) === 0 && allElderlyUsersArray.length > 0) {

						profileData.injuries.poison = true;

						if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Warm) {

							embed.setDescription(`*Piles of sand and lone, scraggly bushes are dotting the landscape all around ${quidData.name}. ${upperCasePronounAndPlural(quidData, 0, 'pad')} through the scattered branches from long-dead trees, carefully avoiding the cacti, trying to reach the ${foundItem} ${pronoun(quidData, 0)} saw. The ${quidData.displayedSpecies || quidData.species} steps on a root but feels it twist and pulse before it leaps from its camouflage and latches onto ${pronoun(quidData, 2)} body. The snake pumps poison into ${pronoun(quidData, 1)} while ${pronounAndPlural(quidData, 0, 'lashes', 'lash')} around, trying to throw it off, finally succeeding and rushing away.*`);
						}
						else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Cold) {

							embed.setDescription(`*Many sticks and roots are popping up all around ${quidData.name}. ${upperCasePronounAndPlural(quidData, 0, 'shuffle')} through the fallen branches and twisting vines, trying to reach the ${foundItem} ${pronoun(quidData, 0)} found. The ${quidData.displayedSpecies || quidData.species} steps on a root but feels it weave and pulse before it leaps from its camouflage and latches onto ${pronoun(quidData, 2)} body. The snake pumps poison into ${pronoun(quidData, 1)} while ${pronounAndPlural(quidData, 0, 'lashes', 'lash')} around, trying to throw it off, finally succeeding and rushing away.*`);
						}
						else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Water) {

							embed.setDescription(`*Many plants and jellyfish are popping up all around ${quidData.name}. ${upperCasePronounAndPlural(quidData, 0, 'weave')} through the jellyfish and twisting kelp, trying to reach the ${foundItem} ${pronoun(quidData, 0)} found. The ${quidData.displayedSpecies || quidData.species} pushes through a piece of kelp but feels it twist and pulse before it latches onto ${pronoun(quidData, 2)} body. The jellyfish wraps ${pronoun(quidData, 1)} with its stingers, poison flowing into ${pronoun(quidData, 1)} while ${pronounAndPlural(quidData, 0, 'thrashes', 'trash')} around trying to throw it off, finally succeeding and rushing away to the surface.*`);
						}
						else { throw new Error('quidData species habitat not found'); }
						embed.setFooter({ text: `-${healthPoints} HP (from poison)\n${changedCondition.statsUpdateText}` });
					}
					else if (getRandomNumber(2) === 0 && profileData.injuries.cold == false) {

						profileData.injuries.cold = true;

						if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Warm) {

							embed.setDescription(`*${quidData.name} pads along the ground, dashing from bush to bush, inspecting every corner for something ${pronoun(quidData, 0)} could add to the inventory. Suddenly, the ${quidData.displayedSpecies || quidData.species} sways, feeling tired and feeble. A coughing fit grew louder, escaping ${pronoun(quidData, 2)} throat.*`);
						}
						else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Cold) {

							embed.setDescription(`*${quidData.name} plots around the forest, dashing from tree to tree, inspecting every corner for something ${pronoun(quidData, 0)} could add to the inventory. Suddenly, the ${quidData.displayedSpecies || quidData.species} sways, feeling tired and feeble. A coughing fit grew louder, escaping ${pronoun(quidData, 2)} throat.*`);
						}
						else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Water) {

							embed.setDescription(`*${quidData.name} flips around in the water, swimming from rock to rock, inspecting every nook for something ${pronoun(quidData, 0)} could add to the inventory. Suddenly, the ${quidData.displayedSpecies || quidData.species} falters in ${pronoun(quidData, 2)} stroke, feeling tired and feeble. A coughing fit grew louder, bubbles escaping ${pronoun(quidData, 2)} throat to rise to the surface.*`);
						}
						else { throw new Error('quidData species habitat not found'); }
						embed.setFooter({ text: `-${healthPoints} HP (from cold)\n${changedCondition.statsUpdateText}` });

					}
					else {

						profileData.injuries.infections += 1;

						if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Warm) {

							embed.setDescription(`*The soft noise of sand shifting on the ground spooks ${quidData.name} as ${pronounAndPlural(quidData, 0, 'walk')} around the area, searching for something useful for ${pronoun(quidData, 2)} pack. A warm wind brushes against ${pronoun(quidData, 2)} side, and a cactus bush sweeps atop ${pronoun(quidData, 2)} path, going unnoticed. A needle pricks into ${pronoun(quidData, 2)} skin, sending pain waves through ${pronoun(quidData, 2)} body. While removing the needle ${quidData.name} notices how swollen the wound looks. It is infected.*`);
						}
						else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Cold) {

							embed.setDescription(`*The thunks of acorns falling from trees spook ${quidData.name} as ${pronounAndPlural(quidData, 0, 'prance')} around the forest, searching for something useful for ${pronoun(quidData, 2)} pack. A warm wind brushes against ${pronoun(quidData, 2)} side, and a thorn bush sweeps atop ${pronoun(quidData, 2)} path, going unnoticed. A thorn pricks into ${pronoun(quidData, 2)} skin, sending pain waves through ${pronoun(quidData, 2)} body. While removing the thorn ${quidData.name} notices how swollen the wound looks. It is infected.*`);
						}
						else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Water) {

							embed.setDescription(`*The sudden silence in the water spooks ${quidData.name} as ${pronounAndPlural(quidData, 0, 'swim')} around in the water, searching for something useful for ${pronoun(quidData, 2)} pack. A rocky outcropping appears next to ${pronoun(quidData, 1)}, unnoticed. The rocks scrape into ${pronoun(quidData, 2)} side, sending shockwaves of pain up ${pronoun(quidData, 2)} flank. ${quidData.name} takes a closer look and notices how swollen the wound is. It is infected.*`);
						}
						else { throw new Error('quidData species habitat not found'); }
						embed.setFooter({ text: `-${healthPoints} HP (from infection)\n${changedCondition.statsUpdateText}` });
					}

					userData = await userModel.findOneAndUpdate(
						u => u.uuid === userData!.uuid,
						(u) => {
							const p = getMapData(getMapData(u.quids, getMapData(userData!.currentQuid, interaction.guildId)).profiles, interaction.guildId);
							p.health -= healthPoints;
							p.injuries = profileData.injuries;
						},
					);
				}
			})(interaction, userData, serverData, int);
		}
	}
	// Find an enemy
	else {

		let currentCombo = 0;
		let highestCombo = 0;
		let opponentLevel = getRandomNumber(1 + Math.ceil(profileData.levels / 10) * 5, (profileData.levels > 2 ? profileData.levels : 3) - Math.ceil(profileData.levels / 10) * 2);
		const opponentsArray = speciesInfo[quidData.species as SpeciesNames].biome1OpponentArray;
		if (chosenBiomeNumber > 0) { opponentsArray.push(...speciesInfo[quidData.species as SpeciesNames].biome2OpponentArray); }
		if (chosenBiomeNumber === 2) { opponentsArray.push(...speciesInfo[quidData.species as SpeciesNames].biome3OpponentArray); }

		const opponentSpecies = opponentsArray[getRandomNumber(opponentsArray.length, 0)];
		let playerLevel = profileData.levels;
		if (!opponentSpecies) { throw new TypeError('opponentSpecies is undefined'); }

		if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Warm) {

			embed.setDescription(`*${quidData.name} creeps close to the ground, ${pronoun(quidData, 2)} pelt blending with the sand surrounding ${pronoun(quidData, 1)}. The ${quidData.displayedSpecies || quidData.species} watches a pile of shrubs, ${pronoun(quidData, 2)} eyes flitting around before catching a motion out of the corner of ${pronoun(quidData, 2)} eyes. A particularly daring ${opponentSpecies} walks on the ground surrounding the bushes before sitting down and cleaning itself.*`);
		}
		else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Cold) {

			embed.setDescription(`*${quidData.name} pads silently to the clearing, stopping just shy of leaving the safety of the thick trees that housed ${pronoun(quidData, 2)} pack, camp, and home. A lone ${opponentSpecies} stands in the clearing, snout in the stream that cuts the clearing in two, leaving it unaware of the ${quidData.displayedSpecies || quidData.species} a few meters behind it, ready to pounce.*`);
		}
		else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Water) {

			embed.setDescription(`*${quidData.name} hides behind some kelp, looking around the clear water for any prey. A lone ${opponentSpecies} swims around aimlessly, not alarmed of any potential attacks. The ${quidData.displayedSpecies || quidData.species} gets in position, contemplating an ambush.*`);
		}
		else { throw new Error('quidData species habitat not found'); }
		embed.setFooter({ text: `The ${opponentSpecies} is level ${opponentLevel}.\nYou will be presented three buttons: Attack, dodge and defend. Your opponent chooses one of them, and you have to choose which button is the correct response.` });

		botReply = await respond(interaction, {
			content: messageContent,
			embeds: [...embedArray, embed],
			components: [new ActionRowBuilder<ButtonBuilder>()
				.setComponents(new ButtonBuilder()
					.setCustomId('fight')
					.setLabel('Fight')
					.setEmoji('⚔️')
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId('flee')
					.setLabel('flee')
					.setEmoji('💨')
					.setStyle(ButtonStyle.Primary))],
		}, true);

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

			if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Warm) {

				embed.setDescription(`*${quidData.name} eyes the ${opponentSpecies}, which is still unaware of the possible danger. The ${quidData.displayedSpecies || quidData.species} paces, still unsure whether to attack. Suddenly, the ${quidData.displayedSpecies || quidData.species}'s head shoots up as it tries to find the source of the sound before running away. Looks like this hunt was unsuccessful.*`);
			}
			else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Cold) {

				embed.setDescription(`*The ${opponentSpecies} sits in the clearing, unaware of ${quidData.name} hiding in the thicket behind it. The ${quidData.displayedSpecies || quidData.species} watches as the animal gets up, shakes the loose water droplets from its mouth, and walks into the forest, its shadow fading from ${quidData.name}'s sight. Looks like this hunt was unsuccessful.*`);
			}
			else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Water) {

				embed.setDescription(`*${quidData.name} looks at the ${opponentSpecies}, which is still unaware of ${pronoun(quidData, 1)} watching through the kelp. Subconsciously, the ${quidData.displayedSpecies || quidData.species} starts swimming back and fourth, still unsure whether to attack. The ${opponentSpecies}'s head turns in a flash to eye the suddenly moving kelp before it frantically swims away. Looks like this hunt was unsuccessful.*`);
			}
			else { throw new Error('quidData species habitat not found'); }
			embed.setFooter({ text: changedCondition.statsUpdateText });
		}
		else {

			let totalCycles: 0 | 1 | 2 = 0;

			await (async function interactionCollector(
				interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>,
				userData: UserSchema,
				serverData: ServerSchema,
				newInteraction: ButtonInteraction,
				previousExploreComponents?: ActionRowBuilder<ButtonBuilder>,
				lastRoundCycleIndex?: number,
			): Promise<void> {


				const fightGame = createFightGame(totalCycles, lastRoundCycleIndex);

				exploreComponent = fightGame.fightComponent;
				if (fightGame.cycleKind === 'attack') {

					embed.setDescription(`⏫ *The ${opponentSpecies} gets ready to attack. ${quidData.name} must think quickly about how ${pronounAndPlural(quidData, 0, 'want')} to react.*`);
				}
				else if (fightGame.cycleKind === 'dodge') {

					embed.setDescription(`↪️ *Looks like the ${opponentSpecies} is preparing a maneuver for ${quidData.name}'s next move. The ${quidData.displayedSpecies || quidData.species} must think quickly about how ${pronounAndPlural(quidData, 0, 'want')} to react.*`);
				}
				else if (fightGame.cycleKind === 'defend') {

					embed.setDescription(`⏺️ *The ${opponentSpecies} gets into position to oppose an attack. ${quidData.name} must think quickly about how ${pronounAndPlural(quidData, 0, 'want')} to react.*`);
				}
				else { throw new Error('cycleKind is not attack, dodge or defend'); }

				botReply = await update(newInteraction, {
					content: messageContent,
					embeds: [...embedArray, embed],
					components: [...previousExploreComponents ? [previousExploreComponents] : [], exploreComponent],
				})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
						return botReply;
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

						if ((i.customId.includes('attack') && fightGame.cycleKind === 'dodge')
						|| (i.customId.includes('defend') && fightGame.cycleKind === 'attack')
						|| (i.customId.includes('dodge') && fightGame.cycleKind === 'defend')) {

							opponentLevel += Math.ceil(profileData.levels / 10) * 2;
						}
						else if ((i.customId.includes('attack') && fightGame.cycleKind === 'defend')
						|| (i.customId.includes('defend') && fightGame.cycleKind === 'dodge')
						|| (i.customId.includes('dodge') && fightGame.cycleKind === 'attack')) {

							/* The button the player choses is overwritten to be green here, only because we are sure that they actually chose corectly. */
							exploreComponent = fightGame.chosenRightButtonOverwrite(i.customId);

							playerLevel += Math.ceil(profileData.levels / 10);
							currentCombo += 1;
							if (currentCombo > highestCombo) { highestCombo = currentCombo; }
						}
						else { currentCombo = 0; }

						return i;
					})
					.catch(() => {

						currentCombo = 0;
						return newInteraction;
					});

				exploreComponent.setComponents(exploreComponent.components.map(c => c.setDisabled(true)));

				totalCycles += 1;

				if (totalCycles < 3) {

					await interactionCollector(interaction, userData, serverData, newInteraction, exploreComponent);
					return;
				}

				playerLevel += (highestCombo === 3 ? 2 : highestCombo === 2 ? 1 : 0) * Math.ceil(profileData.levels / 10);
				playerLevel = getRandomNumber(playerLevel, 0);
				opponentLevel = getRandomNumber(opponentLevel, 0);

				if (playerLevel === opponentLevel || playerLevel === opponentLevel + 1 || playerLevel === opponentLevel + 2) {

					if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Warm) {

						embed.setDescription(`*${quidData.name} and the ${opponentSpecies} are snarling at one another as they retreat to the opposite sides of the hill, now stirred up and filled with sticks from the surrounding bushes. The ${quidData.displayedSpecies || quidData.species} runs back to camp, ${pronoun(quidData, 2)} mouth empty as before.*`);
					}
					else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Cold) {

						embed.setDescription(`*${quidData.name} and the ${opponentSpecies} are snarling at one another as they retreat into the bushes surrounding the clearing, now covered in trampled grass and loose clumps of dirt. The ${quidData.displayedSpecies || quidData.species} runs back to camp, ${pronoun(quidData, 2)} mouth empty as before.*`);
					}
					else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Water) {

						embed.setDescription(`*${quidData.name} and the ${opponentSpecies} glance at one another as they swim in opposite directions from the kelp, now cloudy from the stirred up dirt. The ${quidData.displayedSpecies || quidData.species} swims back to camp, ${pronoun(quidData, 2)} mouth empty as before.*`);
					}
					else { throw new Error('quidData species habitat not found'); }
					embed.setFooter({ text: changedCondition.statsUpdateText });
				}
				else if (playerLevel > opponentLevel) {

					userData = await userModel.findOneAndUpdate(
						u => u.uuid === userData!.uuid,
						(u) => {
							const p = getMapData(getMapData(u.quids, getMapData(userData!.currentQuid, interaction.guildId)).profiles, interaction.guildId);
							p.inventory.meat[opponentSpecies] += 1;
						},
					);

					if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Warm) {

						embed.setDescription(`*${quidData.name} shakes the sand from ${pronoun(quidData, 2)} paws, the still figure of the ${opponentSpecies} casting a shadow for ${pronoun(quidData, 1)} to rest in before returning home with the meat. ${upperCasePronounAndPlural(quidData, 0, 'turn')} to the dead ${opponentSpecies} to start dragging it back to camp. The meat would be well-stored in the camp, added to the den of food for the night, after being cleaned.*`);
					}
					else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Cold) {

						embed.setDescription(`*${quidData.name} licks ${pronoun(quidData, 2)} paws, freeing the dirt that is under ${pronoun(quidData, 2)} claws. The ${quidData.displayedSpecies || quidData.species} turns to the dead ${opponentSpecies} behind ${pronoun(quidData, 1)}, marveling at the size of it. Then, ${upperCasePronounAndPlural(quidData, 0, 'grab')} the ${opponentSpecies} by the neck, dragging it into the bushes and back to the camp.*`);
					}
					else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Water) {

						embed.setDescription(`*The ${quidData.displayedSpecies || quidData.species} swims quickly to the surface, trying to stay as stealthy and unnoticed as possible. ${upperCasePronounAndPlural(quidData, 0, 'break')} the surface, gain ${pronoun(quidData, 2)} bearing, and the ${quidData.displayedSpecies || quidData.species} begins swimming to the shore, dragging the dead ${opponentSpecies} up the shore to the camp.*`);
					}
					else { throw new Error('quidData species habitat not found'); }
					embed.setFooter({ text: `${changedCondition.statsUpdateText}\n\n+1 ${opponentSpecies}` });
				}
				else {

					const healthPoints = getSmallerNumber(profileData.health, getRandomNumber(5, 3));

					if (getRandomNumber(2) === 0) {

						profileData.injuries.wounds += 1;

						if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Warm) {

							embed.setDescription(`*The ${quidData.displayedSpecies || quidData.species} rolls over in the sand, pinned down by the ${opponentSpecies}.* "Get off my territory," *it growls before walking away from the shaking form of ${quidData.name} laying on the sand. ${upperCasePronounAndPlural(quidData, 0, 'let')} the ${opponentSpecies} walk away for a little, trying to put space between the two animals. After catching ${pronoun(quidData, 2)} breath, the ${quidData.displayedSpecies || quidData.species} pulls ${pronoun(quidData, 4)} off the ground, noticing sand sticking to ${pronoun(quidData, 2)} side. ${upperCasePronounAndPlural(quidData, 0, 'shake')} ${pronoun(quidData, 2)} body, sending bolts of pain up ${pronoun(quidData, 2)} side from the wound. ${upperCasePronounAndPlural(quidData, 0, 'slowly walk')} away from the valley that the ${opponentSpecies} was sitting in before running back towards camp.*`);
						}
						else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Cold) {

							embed.setDescription(`*${quidData.name} runs into the brush, trying to avoid making the wound from the ${opponentSpecies} any worse than it already is. The ${quidData.displayedSpecies || quidData.species} stops and confirms that the ${opponentSpecies} isn't following ${pronoun(quidData, 1)}, before walking back inside the camp borders.*`);
						}
						else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Water) {

							embed.setDescription(`*Running from the ${opponentSpecies}, ${quidData.name} flips and spins around in the water, trying to escape from the grasp of the animal behind ${pronoun(quidData, 1)}. ${upperCasePronounAndPlural(quidData, 0, 'slip')} into a small crack in a wall, waiting silently for the creature to give up. Finally, the ${opponentSpecies} swims away, leaving the ${quidData.displayedSpecies || quidData.species} alone. Slowly emerging from the crevice, ${quidData.name} flinches away from the wall as ${pronounAndPlural(quidData, 0, 'hit')} it, a wound making itself known from the fight. Hopefully, it can be treated back at the camp.*`);
						}
						else { throw new Error('quidData species habitat not found'); }
						embed.setFooter({ text: `-${healthPoints} HP (from wound)\n${changedCondition.statsUpdateText}` });
					}
					else {

						profileData.injuries.sprains += 1;

						if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Warm) {

							embed.setDescription(`*${quidData.name} limps back to camp, ${pronoun(quidData, 2)} paw sprained from the fight with the ${opponentSpecies}. Only barely did ${pronoun(quidData, 0)} get away, leaving the enemy alone in the sand that is now stirred up and filled with sticks from the surrounding bushes. Maybe next time, the ${quidData.displayedSpecies || quidData.species} will be successful in ${pronoun(quidData, 2)} hunt.*`);
						}
						else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Cold) {

							embed.setDescription(`*${quidData.name} limps back to camp, ${pronoun(quidData, 2)} paw sprained from the fight with the ${opponentSpecies}. Only barely did ${pronoun(quidData, 0)} get away, leaving the enemy alone in a clearing now filled with trampled grass and dirt clumps. Maybe next time, the ${quidData.displayedSpecies || quidData.species} will be successful in ${pronoun(quidData, 2)} hunt.*`);
						}
						else if (speciesInfo[quidData.species as SpeciesNames].habitat === SpeciesHabitatType.Water) {

							embed.setDescription(`*${quidData.name} swims back to camp in pain, ${pronoun(quidData, 2)} fin sprained from the fight with the ${opponentSpecies}. Only barely did ${pronoun(quidData, 0)} get away, leaving the enemy alone in the water that is now cloudy from the stirred up dirt. Maybe next time, the ${quidData.displayedSpecies || quidData.species} will be successful in ${pronoun(quidData, 2)} hunt.*`);
						}
						else { throw new Error('quidData species habitat not found'); }
						embed.setFooter({ text: `-${healthPoints} HP (from sprain)\n${changedCondition.statsUpdateText}` });

					}

					userData = await userModel.findOneAndUpdate(
						u => u.uuid === userData!.uuid,
						(u) => {
							const p = getMapData(getMapData(u.quids, getMapData(userData!.currentQuid, interaction.guildId)).profiles, interaction.guildId);
							p.health -= healthPoints;
							p.injuries = profileData.injuries;
						},
					);
				}
			})(interaction, userData, serverData, int);
		}
	}

	cooldownMap.set(userData.uuid + interaction.guildId, false);
	const levelUpEmbed = (await checkLevelUp(interaction, userData, quidData, profileData, serverData)).levelUpEmbed;

	if (foundQuest) {

		await sendQuestMessage(interaction, userData, quidData, profileData, serverData, messageContent, embedArray, [...(changedCondition.injuryUpdateEmbed ? [changedCondition.injuryUpdateEmbed] : []),
			...(levelUpEmbed ? [levelUpEmbed] : [])], changedCondition.statsUpdateText);
	}
	else {

		await (async function(messageObject) { return buttonInteraction ? await update(buttonInteraction, messageObject) : await respond(interaction, messageObject, true); })({
			content: messageContent,
			embeds: [
				...embedArray,
				embed,
				...(changedCondition.injuryUpdateEmbed ? [changedCondition.injuryUpdateEmbed] : []),
				...(levelUpEmbed ? [levelUpEmbed] : []),
			],
			components: [
				...(exploreComponent ? [exploreComponent] : []),
				new ActionRowBuilder<ButtonBuilder>()
					.setComponents(new ButtonBuilder()
						.setCustomId(`explore_new${stringInput ? `_${stringInput}` : ''}`)
						.setLabel('Play again')
						.setStyle(ButtonStyle.Primary)),
			],
		})
			.catch((error) => { throw new Error(error); });
	}

	await isPassedOut(interaction, userData, quidData, profileData, true);

	await coloredButtonsAdvice(interaction, userData);
	await restAdvice(interaction, userData, profileData);
	await drinkAdvice(interaction, userData, profileData);
	await eatAdvice(interaction, userData, profileData);
}

function getWaitingMessageObject(
	messageContent: string | null,
	embedArray: EmbedBuilder[],
	quidData: Quid,
	waitingString: string,
	waitingGameField: string[][],
	waitingComponent: ActionRowBuilder<ButtonBuilder>,
): { content: string | null; embeds: EmbedBuilder[]; components: ActionRowBuilder<ButtonBuilder>[]; } {

	return {
		content: messageContent,
		embeds: [...embedArray, new EmbedBuilder()
			.setColor(quidData.color)
			.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL })
			.setDescription(waitingString + waitingGameField.map(v => v.join('')).join('\n'))
			.setFooter({ text: 'This game is voluntary to skip waiting time. If you don\'t mind waiting, you can ignore this game.' })],
		components: [waitingComponent],
	};
}

function getWaitingComponent(
	waitingGameField: string[][],
	playerPos: Position,
	empty: string,
): ActionRowBuilder<ButtonBuilder> {

	return new ActionRowBuilder<ButtonBuilder>()
		.setComponents([
			new ButtonBuilder()
				.setCustomId('left')
				.setEmoji('⬅️')
				.setDisabled(waitingGameField[playerPos.row]?.[playerPos.column - 1] !== empty)
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId('up')
				.setEmoji('⬆️')
				.setDisabled(waitingGameField[playerPos.row - 1]?.[playerPos.column] !== empty)
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId('down')
				.setEmoji('⬇️')
				.setDisabled(waitingGameField[playerPos.row + 1]?.[playerPos.column] !== empty)
				.setDisabled(true)
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId('right')
				.setEmoji('➡️')
				.setDisabled(waitingGameField[playerPos.row]?.[playerPos.column + 1] !== empty)
				.setStyle(ButtonStyle.Secondary),
		]);
}

function getAvailableBiomes(
	quidData: Quid,
	profileData: Profile,
): string[] {

	return {
		[SpeciesHabitatType.Cold]: ['forest', 'taiga', 'tundra'],
		[SpeciesHabitatType.Warm]: ['shrubland', 'savanna', 'desert'],
		[SpeciesHabitatType.Water]: ['river', 'coral reef', 'ocean'],
	}[speciesInfo[quidData.species as SpeciesNames].habitat]
		.slice(0, (profileData.rank === RankType.Elderly) ? 3 : (profileData.rank === RankType.Healer || profileData.rank === RankType.Hunter) ? 2 : 1);
}