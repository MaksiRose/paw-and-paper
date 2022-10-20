import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, Message, SlashCommandBuilder } from 'discord.js';
import { speciesInfo } from '../..';
import { cooldownMap } from '../../events/interactionCreate';
import userModel, { getUserData } from '../../models/userModel';
import { ServerSchema } from '../../typings/data/server';
import { CurrentRegionType, QuidSchema, RankType, UserData, UserSchema } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { SpeciesHabitatType } from '../../typings/main';
import { coloredButtonsAdvice, drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { changeCondition, infectWithChance } from '../../utils/changeCondition';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { hasFullInventory, isInteractable, isInvalid, isPassedOut } from '../../utils/checkValidity';
import { addFriendshipPoints } from '../../utils/friendshipHandling';
import { createFightGame, createPlantGame, plantEmojis } from '../../utils/gameBuilder';
import { capitalizeString, getArrayElement, getMapData, getSmallerNumber, keyInObject, respond, update } from '../../utils/helperFunctions';
import { checkLevelUp } from '../../utils/levelHandling';
import { missingPermissions } from '../../utils/permissionHandler';
import { getRandomNumber, pullFromWeightedTable } from '../../utils/randomizers';
import { pickPlant } from '../../utils/simulateItemUse';
import { isResting } from '../gameplay_maintenance/rest';
import { remindOfAttack } from './attack';
import { sendQuestMessage } from './start-quest';

const tutorialMap: Map<string, number> = new Map();

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('play')
		.setDescription('Gain experience in a safe environment, or play with others to give them health.')
		.addUserOption(option =>
			option.setName('user')
				.setDescription('The user you want to play with')
				.setRequired(false))
		.setDMPermission(false)
		.toJSON(),
	category: 'page2',
	position: 0,
	disablePreviousCommand: true,
	modifiesServerProfile: true,
	sendCommand: async (interaction, userData, serverData) => {

		await executePlaying(interaction, userData, serverData);
	},
};

export async function executePlaying(
	interaction: ChatInputCommandInteraction | ButtonInteraction,
	userData1: UserData<undefined, ''> | null,
	serverData: ServerSchema | null,
): Promise<void> {

	if (await missingPermissions(interaction, [
		'ViewChannel', // Needed because of createCommandComponentDisabler in sendQuestMessage
		/* 'ViewChannel',*/ interaction.channel?.isThread() ? 'SendMessagesInThreads' : 'SendMessages', 'EmbedLinks', 'EmbedLinks', // Needed for channel.send call in addFriendshipPoints
	]) === true) { return; }

	/* This ensures that the user is in a guild and has a completed account. */
	if (serverData === null) { throw new Error('serverData is null'); }
	if (!isInGuild(interaction) || !hasNameAndSpecies(userData1, interaction)) { return; }

	/* Checks if the profile is resting, on a cooldown or passed out. */
	const restEmbed = await isInvalid(interaction, userData1);
	if (restEmbed === false) { return; }

	let messageContent = remindOfAttack(interaction.guildId);

	if (await hasFullInventory(interaction, userData1, restEmbed, messageContent)) { return; }

	const mentionedUserId = interaction.isChatInputCommand() ? interaction.options.getUser('user')?.id : interaction.customId.split('_')[3];
	const tutorialMapEntry = tutorialMap.get(userData1.quid._id + userData1.quid.profile.serverId);
	if (userData1.quid.profile.tutorials.play === false && userData1.quid.profile.rank === RankType.Youngling && (tutorialMapEntry === undefined || tutorialMapEntry === 0)) {

		await respond(interaction, {
			content: '*About the structure of RPG messages:*\n\n- Most messages have `Roleplay text`, which is written in cursive, and only for fun!\n- More important is the `Info text`, which is at the bottom of each message, and has the most important info like how to play a game or stat changes. **Read this part first** to avoid confusion!\n\n> Here is an example of what this might look like:',
			embeds: [new EmbedBuilder()
				.setColor(userData1.quid.color)
				.setImage('https://raw.githubusercontent.com/MaksiRose/paw-and-paper/dev/pictures/tutorials/Play.png')],
			components: [
				new ActionRowBuilder<ButtonBuilder>()
					.setComponents(new ButtonBuilder()
						.setCustomId(`play_new_@${userData1._id}${mentionedUserId ? `_${mentionedUserId}` : ''}`)
						.setLabel('I understand, let\'s try it out!')
						.setStyle(ButtonStyle.Success)),
			],
		}, true);
		tutorialMap.set(userData1.quid._id + userData1.quid.profile.serverId, 1);
		return;
	}

	if (mentionedUserId && userData1.userId.includes(mentionedUserId)) {

		await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, new EmbedBuilder()
				.setColor(userData1.quid.color)
				.setAuthor({ name: userData1.quid.getDisplayname(), iconURL: userData1.quid.avatarURL })
				.setDescription(`*${userData1.quid.name} plays with ${userData1.quid.pronoun(4)}. The rest of the pack looks away in embarrassment.*`)],
		}, true);
		return;
	}

	let _userData2 = mentionedUserId ? await userModel.findOne(u => u.userId.includes(mentionedUserId)).catch(() => { return null; }) : null;
	if (!_userData2) {

		const usersEligibleForPlaying = (await userModel
			.find(
				u => Object.values(u.quids).filter(q => isEligableForPlaying(u, q, interaction.guildId)).length > 0,
			))
			.filter(u => u._id !== userData1?._id);

		if (usersEligibleForPlaying.length > 0) {

			_userData2 = getArrayElement(usersEligibleForPlaying, getRandomNumber(usersEligibleForPlaying.length));
			if (_userData2) {

				const newCurrentQuid = Object.values(_userData2.quids).find(q => isEligableForPlaying(_userData2!, q, interaction.guildId));
				if (newCurrentQuid) { _userData2.currentQuid[interaction.guildId] = newCurrentQuid._id; }
			}
		}
	}

	/* Check if the user is interactable, and if they are, define quid data and profile data. */
	let userData2 = _userData2 ? getUserData(_userData2, interaction.guildId, _userData2.quids[_userData2.currentQuid[interaction.guildId] ?? '']) : null;
	if (mentionedUserId && !isInteractable(interaction, userData2, messageContent, restEmbed)) { return; }

	cooldownMap.set(userData1._id + interaction.guildId, true);

	const experiencePoints = userData1.quid.profile.rank === RankType.Youngling ? getRandomNumber(9, 1) : userData1.quid.profile.rank === RankType.Apprentice ? getRandomNumber(11, 5) : 0;
	const changedCondition = await changeCondition(userData1, experiencePoints, CurrentRegionType.Prairie);

	const responseTime = userData1.quid.profile.rank === RankType.Youngling ? (tutorialMapEntry === 1 || tutorialMapEntry === 2) ? 3_600_000 : 10_000 : 5_000;
	const embed = new EmbedBuilder()
		.setColor(userData1.quid.color)
		.setAuthor({ name: userData1.quid.getDisplayname(), iconURL: userData1.quid.avatarURL });
	let infectedEmbed: EmbedBuilder[] = [];
	let playComponent: ActionRowBuilder<ButtonBuilder> | null = null;
	let botReply: Message;
	/** This is used in case the user is fighting or finding a plant, in order to respond to the interaction */
	let buttonInteraction: ButtonInteraction<'cached'> | null = null;

	let foundQuest = false;
	let playedTogether = false;
	// If the user is a Youngling with a level over 2 that doesn't have a quest and has not unlocked any ranks and they haven't mentioned anyone, with a 1 in 3 chance get a quest
	if (userData1.quid.profile.rank === RankType.Youngling
		&& userData1.quid.profile.levels > 1
		&& userData1.quid.profile.hasQuest === false
		&& userData1.quid.profile.unlockedRanks === 0
		&& !mentionedUserId
		&& getRandomNumber(3) === 0) { foundQuest = true; }
	// Play together either 100% of the time if someone was mentioned, or 70% of the time if either there is a userData2 or the user is a Youngling
	else if (tutorialMapEntry !== 1
		&& (mentionedUserId
			|| tutorialMapEntry === 2
			|| ((userData2 || userData1.quid.profile.rank === RankType.Youngling)
				&& pullFromWeightedTable({ 0: 3, 1: 7 }) === 1))
	) {

		playedTogether = true;
		if (tutorialMapEntry === 2) { userData2 = null; }

		if (hasNameAndSpecies(userData2) && (userData1.quid.profile.rank === RankType.Youngling || userData1.quid.profile.rank === RankType.Apprentice)) {

			const partnerHealthPoints = getSmallerNumber(userData2.quid.profile.maxHealth - userData2.quid.profile.health, getRandomNumber(5, 1));

			await userData2.update(
				(u) => {
					const p = getMapData(getMapData(u.quids, userData2!.quid!._id).profiles, interaction.guildId);
					p.health += partnerHealthPoints;
				},
			);

			if (partnerHealthPoints > 0) {

				changedCondition.statsUpdateText += `\n\n+${partnerHealthPoints} HP for ${userData2.quid.name} (${userData2.quid.profile.health}/${userData2.quid.profile.maxHealth})`;
			}
		}

		let whoWinsChance = pullFromWeightedTable({ 0: 1, 1: 1 });

		if (mentionedUserId === undefined) {

			const fightGame = createFightGame();
			playComponent = fightGame.fightComponent;

			whoWinsChance = 1;

			if (fightGame.cycleKind === 'attack') {

				embed.setDescription(`⏫ *${userData2?.quid?.name || 'The Elderly'} gets ready to attack. ${userData1.quid.name} must think quickly about how ${userData1.quid.pronounAndPlural(0, 'want')} to react.*`);
				embed.setFooter({ text: 'Click the button that wins against your opponent\'s move (⏫ Attack).\nTip: Dodging an attack surprises the opponent and puts you in the perfect position for a counterattack.' });
			}
			else if (fightGame.cycleKind === 'dodge') {

				embed.setDescription(`↪️ *Looks like ${userData2?.quid?.name || 'the Elderly'} is preparing a maneuver for ${userData1.quid.name}'s next move. The ${userData1.quid.getDisplayspecies()} must think quickly about how ${userData1.quid.pronounAndPlural(0, 'want')} to react.*`);
				embed.setFooter({ text: 'Click the button that wins against your opponent\'s move (↪️ Dodge).\nTip: Defending a maneuver blocks it effectively, which prevents your opponent from hurting you.' });
			}
			else if (fightGame.cycleKind === 'defend') {

				embed.setDescription(`⏺️ *${userData2?.quid?.name || 'The Elderly'} gets into position to oppose an attack. ${userData1.quid.name} must think quickly about how ${userData1.quid.pronounAndPlural(0, 'want')} to react.*`);
				embed.setFooter({ text: 'Click the button that wins against your opponent\'s move (⏺️ Defend).\nTip: Attacks come with a lot of force, making them difficult to defend against.' });
			}
			else { throw new TypeError('cycleKind is undefined'); }

			botReply = await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, embed],
				components: [playComponent],
			}, true);

			/* Here we are making sure that the correct button will be blue by default. If the player choses the correct button, this will be overwritten. */
			playComponent = fightGame.correctButtonOverwrite();

			const i = await (botReply as Message<true>)
				.awaitMessageComponent({
					filter: i => i.user.id === interaction.user.id,
					componentType: ComponentType.Button,
					time: responseTime,
				})
				.catch(() => { return null; });

			if (i !== null) {

				/* Here we make the button the player choses red, this will apply always except if the player choses the correct button, then this will be overwritten. */
				playComponent = fightGame.chosenWrongButtonOverwrite(i.customId);

				if ((i.customId.includes('attack') && fightGame.cycleKind === 'defend')
					|| (i.customId.includes('defend') && fightGame.cycleKind === 'dodge')
					|| (i.customId.includes('dodge') && fightGame.cycleKind === 'attack')) {

					/* The button the player choses is overwritten to be green here, only because we are sure that they actually chose corectly. */
					playComponent = fightGame.chosenRightButtonOverwrite(i.customId);

					await userData1.update(
						(u) => {
							const p = getMapData(getMapData(u.quids, userData1!.quid!._id).profiles, interaction.guildId);
							p.tutorials.play = true;
						},
					);

					tutorialMap.delete(userData1.quid._id + userData1.quid.profile.serverId);

					whoWinsChance = 0;
				}
				buttonInteraction = i;
			}

			playComponent.setComponents(playComponent.components.map(component => component.setDisabled(true)));
		}
		else {

			messageContent = `${messageContent}\n\n<@${mentionedUserId}>`;
		}

		if (whoWinsChance === 0) {

			embed.setDescription(`*${userData1.quid.name} trails behind ${userData2?.quid?.name ?? 'an Elderly'}'s rear end, preparing for a play attack. The ${userData1.quid.getDisplayspecies()} launches forward, landing on top of ${userData2?.quid === undefined ? 'them' : userData2.quid.pronoun(1)}.* "I got you${!userData2 ? '' : ', ' + userData1.quid.name}!" *${userData1.quid.pronounAndPlural(0, 'say')}. Both creatures bounce away from each other, laughing.*`);
			embed.setImage('https://external-preview.redd.it/iUqJpDGv2YSDitYREfnTvsUkl9GG6oPMCRogvilkIrg.gif?s=9b0ea7faad7624ec00b5f8975e2cf3636f689e27');
		}
		else {

			embed.setDescription(`*${userData1.quid.name} trails behind ${userData2?.quid?.name ?? 'an Elderly'}'s rear end, preparing for a play attack. Right when the ${userData1.quid.getDisplayspecies()} launches forward, ${userData2?.quid?.name ?? 'the Elderly'} dashes sideways, followed by a precise jump right on top of ${userData1.quid.name}.* "I got you, ${userData1.quid.name}!" *${userData2?.quid === undefined ? 'they say' : userData2.quid.pronounAndPlural(0, 'say')}. Both creatures bounce away from each other, laughing.*`);
			embed.setImage('https://i.pinimg.com/originals/7e/e4/01/7ee4017f0152c7b7c573a3dfe2c6673f.gif');
		}
		if (changedCondition.statsUpdateText) { embed.setFooter({ text: changedCondition.statsUpdateText }); }

		/* If user 2 had a cold, infect user 1 with a 30% chance. */
		if (hasNameAndSpecies(userData2)) {

			infectedEmbed = await infectWithChance(userData1, userData2);
		}
	}
	// with a 90% chance if the user is not a youngling, find nothing
	else if (userData1.quid.profile.rank !== RankType.Youngling
		&& pullFromWeightedTable({ 0: 90, 1: 10 + userData1.quid.profile.sapling.waterCycles }) === 0) {

		embed.setDescription(`*${userData1.quid.name} bounces around camp, watching the busy hustle and blurs of hunters and healers at work. ${capitalizeString(userData1.quid.pronounAndPlural(0, 'splashes', 'splash'))} into the stream that splits the pack in half, chasing the minnows with ${userData1.quid.pronoun(2)} eyes.*`);
		if (changedCondition.statsUpdateText) { embed.setFooter({ text: changedCondition.statsUpdateText }); }
	}
	// if the user is not a youngling, and either the user is also not an apprentice or with a 90% chance, get hurt
	else if (userData1.quid.profile.rank !== RankType.Youngling
		&& (userData1.quid.profile.rank !== RankType.Apprentice
			|| pullFromWeightedTable({ 0: 10, 1: 90 + userData1.quid.profile.sapling.waterCycles }))) {

		const healthPoints = getSmallerNumber(getRandomNumber(5, 3), userData1.quid.profile.health);

		if (getRandomNumber(2) === 0 && userData1.quid.profile.injuries.cold === false) {

			userData1.quid.profile.injuries.cold = true;

			embed.setDescription(`*${userData1.quid.name} tumbles around camp, weaving through dens and packmates at work. ${capitalizeString(userData1.quid.pronounAndPlural(0, 'pause'))} for a moment, having a sneezing and coughing fit. It looks like ${userData1.quid.name} has caught a cold.*`);
			embed.setFooter({ text: `-${healthPoints} HP (from cold)\n${changedCondition.statsUpdateText}` });

		}
		else {

			userData1.quid.profile.injuries.wounds += 1;

			embed.setDescription(`*${userData1.quid.name} strays from camp, playing near the pack borders. ${capitalizeString(userData1.quid.pronounAndPlural(0, 'hop'))} on rocks and pebbles, trying to keep ${userData1.quid.pronoun(2)} balance, but the rock ahead of ${userData1.quid.pronoun(1)} is steeper and more jagged. ${capitalizeString(userData1.quid.pronounAndPlural(0, 'land'))} with an oomph and a gash slicing through ${userData1.quid.pronoun(2)} feet from the sharp edges.*`);
			embed.setFooter({ text: `-${healthPoints} HP (from wound)\n${changedCondition.statsUpdateText}` });
		}

		await userData1.update(
			(u) => {
				const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, userData1!.quid!.profile.serverId)).profiles, userData1!.quid!.profile.serverId);
				p.health -= healthPoints;
				p.injuries = userData1!.quid!.profile.injuries;
			},
		);
	}
	// find a plant
	else {

		const plantGame = createPlantGame(speciesInfo[userData1.quid.species].habitat);
		const foundItem = await pickPlant(0, serverData);

		playComponent = plantGame.plantComponent;

		const biome = {
			[SpeciesHabitatType.Cold]: 'forest',
			[SpeciesHabitatType.Warm]: 'shrubland',
			[SpeciesHabitatType.Water]: 'river',
		}[speciesInfo[userData1.quid.species].habitat];
		const descriptionText = `*${userData1.quid.name} bounds across the den territory, chasing a bee that is just out of reach. Without looking, the ${userData1.quid.getDisplayspecies()} crashes into a Healer, loses sight of the bee, and scurries away into the ${biome}. On ${userData1.quid.pronoun(2)} way back to the pack border, ${userData1.quid.name} sees something special on the ground. It's a ${foundItem}!*`;

		embed.setDescription(descriptionText);
		embed.setFooter({ text: `Click the button with this emoji: ${plantGame.emojiToFind}, but without the campsite (${plantEmojis.toAvoid}).` });

		botReply = await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, embed],
			components: [playComponent],
		}, true);

		/* Here we are making sure that the correct button will be blue by default. If the player choses the correct button, this will be overwritten. */
		playComponent = plantGame.correctButtonOverwrite();
		if (changedCondition.statsUpdateText) { embed.setFooter({ text: changedCondition.statsUpdateText }); }

		const i = await (botReply as Message<true>)
			.awaitMessageComponent({
				filter: i => i.user.id === interaction.user.id,
				componentType: ComponentType.Button,
				time: responseTime,
			})
			.catch(() => { return null; });

		if (i !== null) {

			/* Here we make the button the player choses red, this will apply always except if the player choses the correct button, then this will be overwritten. */
			playComponent = plantGame.chosenWrongButtonOverwrite(i.customId);

			if (i.customId.includes(plantGame.emojiToFind) && !i.customId.includes(plantEmojis.toAvoid)) {

				/* The button the player choses is overwritten to be green here, only because we are sure that they actually chose corectly. */
				playComponent = plantGame.chosenRightButtonOverwrite(i.customId);

				if (tutorialMapEntry === 1) { tutorialMap.set(userData1.quid._id + userData1.quid.profile.serverId, 2); }

				await userData1.update(
					(u) => {
						const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
						if (keyInObject(p.inventory.commonPlants, foundItem)) { p.inventory.commonPlants[foundItem] += 1; }
						else if (keyInObject(p.inventory.uncommonPlants, foundItem)) { p.inventory.uncommonPlants[foundItem] += 1; }
						else { p.inventory.rarePlants[foundItem] += 1; }
					},
				);
				embed.setFooter({ text: `${changedCondition.statsUpdateText}\n\n+1 ${foundItem}` });
			}
			else {

				embed.setDescription(descriptionText.substring(0, descriptionText.length - 1) + ` But as the ${userData1.quid.getDisplayspecies()} tries to pick it up, it just breaks into little pieces.*`);
			}
			buttonInteraction = i;
		}

		playComponent.setComponents(playComponent.components.map(c => c.setDisabled(true)));
	}

	cooldownMap.set(userData1._id + interaction.guildId, false);
	const levelUpEmbed = await checkLevelUp(interaction, userData1, serverData);

	if (foundQuest) {

		await userData1.update(
			(u) => {
				const p = getMapData(getMapData(u.quids, userData1.quid._id).profiles, interaction.guildId);
				p.hasQuest = true;
			},
		);

		botReply = await sendQuestMessage(interaction, userData1, serverData, messageContent, restEmbed, [...changedCondition.injuryUpdateEmbed, ...levelUpEmbed], changedCondition.statsUpdateText);
	}
	else {

		const tutorialMapEntry_ = tutorialMap.get(userData1.quid._id + userData1.quid.profile.serverId);
		botReply = await (async function(messageObject) { return buttonInteraction ? await update(buttonInteraction, messageObject) : await respond(interaction, messageObject, true); })({
			content: messageContent,
			embeds: [
				...restEmbed,
				embed,
				...changedCondition.injuryUpdateEmbed,
				...infectedEmbed,
				...levelUpEmbed,
			],
			components: [
				...(playComponent ? [playComponent] : []),
				new ActionRowBuilder<ButtonBuilder>()
					.setComponents(new ButtonBuilder()
						.setCustomId(`play_new_@${userData1._id}${mentionedUserId ? `_${mentionedUserId}` : ''}`)
						.setLabel((tutorialMapEntry === 1 && tutorialMapEntry_ === 1) || (tutorialMapEntry === 2 && tutorialMapEntry_ === 2) ? 'Try again' : tutorialMapEntry === 1 && tutorialMapEntry_ === 2 ? 'Try another game' : 'Play again')
						.setStyle(ButtonStyle.Primary)),
			],
		});

		if (tutorialMapEntry === 2 && tutorialMapEntry_ === undefined) {

			await respond(buttonInteraction ?? interaction, {
				content: 'Good job! You have understood the basics of how to play the RPG. From now on, there is a time limit of a few seconds for clicking the minigame-buttons. Have fun!',
			}, false);
		}
	}

	await isPassedOut(interaction, userData1, true);

	await coloredButtonsAdvice(interaction, userData1);
	await restAdvice(interaction, userData1);
	await drinkAdvice(interaction, userData1);
	await eatAdvice(interaction, userData1);

	if (playedTogether && hasNameAndSpecies(userData2)) { await addFriendshipPoints(botReply, userData1, userData2); }
}

function isEligableForPlaying(
	userData: UserSchema,
	quid: QuidSchema<''>,
	guildId: string,
): quid is QuidSchema<never> {

	const user = getUserData(userData, guildId, quid);
	return hasNameAndSpecies(user) && user.quid.profile.currentRegion === CurrentRegionType.Prairie && user.quid.profile.energy > 0 && user.quid.profile.health > 0 && user.quid.profile.hunger > 0 && user.quid.profile.thirst > 0 && user.quid.profile.injuries.cold === false && cooldownMap.get(user._id + guildId) !== true && user.quid.profile.isResting === false && isResting(user) === false;
}