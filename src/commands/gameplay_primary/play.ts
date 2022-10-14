import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, Message, SlashCommandBuilder } from 'discord.js';
import { cooldownMap } from '../../events/interactionCreate';
import userModel from '../../models/userModel';
import { CurrentRegionType, Quid, RankType, ServerSchema, SlashCommand, SpeciesHabitatType, speciesInfo, UserSchema } from '../../typedef';
import { coloredButtonsAdvice, drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { changeCondition, infectWithChance } from '../../utils/changeCondition';
import { hasName, hasSpecies, isInGuild } from '../../utils/checkUserState';
import { hasFullInventory, isInteractable, isInvalid, isPassedOut } from '../../utils/checkValidity';
import { addFriendshipPoints } from '../../utils/friendshipHandling';
import { createFightGame, createPlantGame, plantEmojis } from '../../utils/gameBuilder';
import { pronoun, pronounAndPlural, upperCasePronounAndPlural } from '../../utils/getPronouns';
import { getMapData, getQuidDisplayname, getSmallerNumber, keyInObject, respond, update } from '../../utils/helperFunctions';
import { checkLevelUp } from '../../utils/levelHandling';
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
	sendCommand: async (client, interaction, userData, serverData, embedArray) => {

		await executePlaying(interaction, userData, serverData, embedArray);
	},
};

export async function executePlaying(
	interaction: ChatInputCommandInteraction | ButtonInteraction,
	userData1: UserSchema | null,
	serverData: ServerSchema | null,
	embedArray: EmbedBuilder[],
): Promise<void> {

	/* This ensures that the user is in a guild and has a completed account. */
	if (!isInGuild(interaction)) { return; }
	if (serverData === null) { throw new Error('serverData is null'); }
	if (!hasName(interaction, userData1)) { return; }

	/* Gets the current active quid and the server profile from the account */
	let quidData1 = getMapData(userData1.quids, getMapData(userData1.currentQuid, interaction.guildId));
	let profileData1 = getMapData(quidData1.profiles, interaction.guildId);
	if (!hasSpecies(interaction, quidData1)) { return; }

	/* Checks if the profile is resting, on a cooldown or passed out. */
	if (await isInvalid(interaction, userData1, quidData1, profileData1, embedArray)) { return; }

	let messageContent = remindOfAttack(interaction.guildId);

	if (await hasFullInventory(interaction, userData1, quidData1, profileData1, embedArray, messageContent)) { return; }

	const mentionedUserId = interaction.isChatInputCommand() ? interaction.options.getUser('user')?.id : interaction.customId.split('_')[3];
	const tutorialMapEntry = tutorialMap.get(quidData1._id + profileData1.serverId);
	if (profileData1.tutorials.play === false && profileData1.rank === RankType.Youngling && (tutorialMapEntry === undefined || tutorialMapEntry === 0)) {

		await respond(interaction, {
			content: '*About the structure of RPG messages:*\n\n- Most messages have `Roleplay text`, which is written in cursive, and only for fun!\n- More important is the `Info text`, which is at the bottom of each message, and has the most important info like how to play a game or stat changes. **Read this part first** to avoid confusion!\n\n> Here is an example of what this might look like:',
			embeds: [new EmbedBuilder()
				.setColor(quidData1.color)
				.setImage('https://raw.githubusercontent.com/MaksiRose/paw-and-paper/dev/pictures/tutorials/Play.png')],
			components: [
				new ActionRowBuilder<ButtonBuilder>()
					.setComponents(new ButtonBuilder()
						.setCustomId(`play_new_@${userData1._id}${mentionedUserId ? `_${mentionedUserId}` : ''}`)
						.setLabel('I understand, let\'s try it out!')
						.setStyle(ButtonStyle.Success)),
			],
		}, true);
		tutorialMap.set(quidData1._id + profileData1.serverId, 1);
		return;
	}

	if (mentionedUserId && userData1.userId.includes(mentionedUserId)) {

		await respond(interaction, {
			content: messageContent,
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(quidData1.color)
				.setAuthor({ name: getQuidDisplayname(userData1, quidData1, interaction.guildId), iconURL: quidData1.avatarURL })
				.setDescription(`*${quidData1.name} plays with ${pronoun(quidData1, 4)}. The rest of the pack looks away in embarrassment.*`)],
		}, true);
		return;
	}

	let userData2 = mentionedUserId ? await userModel.findOne(u => u.userId.includes(mentionedUserId)).catch(() => { return null; }) : null;

	if (!userData2) {

		const usersEligibleForPlaying = (await userModel
			.find(
				u => Object.values(u.quids).filter(q => isEligableForPlaying(u._id, q, interaction.guildId)).length > 0,
			))
			.filter(u => u._id !== userData1?._id);

		if (usersEligibleForPlaying.length > 0) {

			userData2 = usersEligibleForPlaying[getRandomNumber(usersEligibleForPlaying.length)] || null;
			if (userData2) {

				const newCurrentQuid = Object.values(userData2.quids).find(q => isEligableForPlaying(userData2!._id, q, interaction.guildId));
				if (newCurrentQuid) { userData2.currentQuid[interaction.guildId] = newCurrentQuid._id; }
			}
		}
	}

	/* Check if the user is interactable, and if they are, define quid data and profile data. */
	if (mentionedUserId && !isInteractable(interaction, userData2, messageContent, embedArray)) { return; }
	let quidData2 = userData2 ? getMapData(userData2.quids, getMapData(userData2.currentQuid, interaction.guildId)) : null;
	let profileData2 = quidData2 ? getMapData(quidData2.profiles, interaction.guildId) : null;

	cooldownMap.set(userData1._id + interaction.guildId, true);

	const experiencePoints = profileData1.rank === RankType.Youngling ? getRandomNumber(9, 1) : profileData1.rank === RankType.Apprentice ? getRandomNumber(11, 5) : 0;
	const changedCondition = await changeCondition(userData1, quidData1, profileData1, experiencePoints, CurrentRegionType.Prairie);
	profileData1 = changedCondition.profileData;

	const responseTime = profileData1.rank === RankType.Youngling ? (tutorialMapEntry === 1 || tutorialMapEntry === 2) ? 3_600_000 : 10_000 : 5_000;
	const embed = new EmbedBuilder()
		.setColor(quidData1.color)
		.setAuthor({ name: getQuidDisplayname(userData1, quidData1, interaction.guildId), iconURL: quidData1.avatarURL });
	let infectedEmbed: EmbedBuilder | null = null;
	let playComponent: ActionRowBuilder<ButtonBuilder> | null = null;
	let botReply: Message;
	/** This is used in case the user is fighting or finding a plant, in order to respond to the interaction */
	let buttonInteraction: ButtonInteraction<'cached'> | null = null;

	let foundQuest = false;
	let playedTogether = false;
	// If the user is a Youngling with a level over 2 that doesn't have a quest and has not unlocked any ranks and they haven't mentioned anyone, with a 1 in 3 chance get a quest
	if (profileData1.rank === RankType.Youngling
		&& profileData1.levels > 1
		&& profileData1.hasQuest === false
		&& profileData1.unlockedRanks === 0
		&& !mentionedUserId
		&& getRandomNumber(3) === 0) { foundQuest = true; }
	// Play together either 100% of the time if someone was mentioned, or 70% of the time if either there is a userData2 or the user is a Youngling
	else if (tutorialMapEntry !== 1
		&& (mentionedUserId
			|| tutorialMapEntry === 2
			|| ((userData2 || profileData1.rank === RankType.Youngling)
				&& pullFromWeightedTable({ 0: 3, 1: 7 }) === 1))
	) {

		playedTogether = true;
		if (tutorialMapEntry === 2) { quidData2 = null; }

		if (userData2 && quidData2 && profileData2 && (profileData1.rank === RankType.Youngling || profileData1.rank === RankType.Apprentice)) {

			const partnerHealthPoints = getSmallerNumber(profileData2.maxHealth - profileData2.health, getRandomNumber(5, 1));

			userData2 = await userModel.findOneAndUpdate(
				u => u._id === userData2!._id,
				(u) => {
					const p = getMapData(getMapData(u.quids, quidData2!._id).profiles, interaction.guildId);
					p.health += partnerHealthPoints;
				},
			);
			quidData2 = getMapData(userData2.quids, quidData2._id);
			profileData2 = getMapData(quidData2.profiles, interaction.guildId);

			if (partnerHealthPoints > 0) {

				changedCondition.statsUpdateText += `\n\n+${partnerHealthPoints} HP for ${quidData2.name} (${profileData2.health}/${profileData2.maxHealth})`;
			}
		}

		let whoWinsChance = pullFromWeightedTable({ 0: 1, 1: 1 });

		if (mentionedUserId === undefined) {

			const fightGame = createFightGame();
			playComponent = fightGame.fightComponent;

			whoWinsChance = 1;

			if (fightGame.cycleKind === 'attack') {

				embed.setDescription(`⏫ *${quidData2?.name || 'The Elderly'} gets ready to attack. ${quidData1.name} must think quickly about how ${pronounAndPlural(quidData1, 0, 'want')} to react.*`);
				embed.setFooter({ text: 'Click the button that wins against your opponent\'s move (⏫ Attack).\nTip: Dodging an attack surprises the opponent and puts you in the perfect position for a counterattack.' });
			}
			else if (fightGame.cycleKind === 'dodge') {

				embed.setDescription(`↪️ *Looks like ${quidData2?.name || 'the Elderly'} is preparing a maneuver for ${quidData1.name}'s next move. The ${quidData1.displayedSpecies || quidData1.species} must think quickly about how ${pronounAndPlural(quidData1, 0, 'want')} to react.*`);
				embed.setFooter({ text: 'Click the button that wins against your opponent\'s move (↪️ Dodge).\nTip: Defending a maneuver blocks it effectively, which prevents your opponent from hurting you.' });
			}
			else if (fightGame.cycleKind === 'defend') {

				embed.setDescription(`⏺️ *${quidData2?.name || 'The Elderly'} gets into position to oppose an attack. ${quidData1.name} must think quickly about how ${pronounAndPlural(quidData1, 0, 'want')} to react.*`);
				embed.setFooter({ text: 'Click the button that wins against your opponent\'s move (⏺️ Defend).\nTip: Attacks come with a lot of force, making them difficult to defend against.' });
			}
			else { throw new TypeError('cycleKind is undefined'); }

			botReply = await respond(interaction, {
				content: messageContent,
				embeds: [...embedArray, embed],
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

					userData1 = await userModel.findOneAndUpdate(
						u => u._id === userData1!._id,
						(u) => {
							const p = getMapData(getMapData(u.quids, quidData1._id).profiles, interaction.guildId);
							p.tutorials.play = true;
						},
					);
					quidData1 = getMapData(userData1.quids, quidData1._id);
					profileData1 = getMapData(quidData1.profiles, profileData1.serverId);

					tutorialMap.delete(quidData1._id + profileData1.serverId);

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

			embed.setDescription(`*${quidData1.name} trails behind ${quidData2?.name ?? 'an Elderly'}'s rear end, preparing for a play attack. The ${quidData1.displayedSpecies || quidData1.species} launches forward, landing on top of ${!quidData2 ? 'them' : pronoun(quidData2, 1)}.* "I got you${!quidData2 ? '' : ', ' + quidData2.name}!" *${pronounAndPlural(quidData1, 0, 'say')}. Both creatures bounce away from each other, laughing.*`);
			embed.setImage('https://external-preview.redd.it/iUqJpDGv2YSDitYREfnTvsUkl9GG6oPMCRogvilkIrg.gif?s=9b0ea7faad7624ec00b5f8975e2cf3636f689e27');
		}
		else {

			embed.setDescription(`*${quidData1.name} trails behind ${quidData2?.name ?? 'an Elderly'}'s rear end, preparing for a play attack. Right when the ${quidData1.displayedSpecies || quidData1.species} launches forward, ${quidData2?.name ?? 'the Elderly'} dashes sideways, followed by a precise jump right on top of ${quidData1.name}.* "I got you, ${quidData1.name}!" *${!quidData2 ? 'they say' : pronounAndPlural(quidData2, 0, 'say')}. Both creatures bounce away from each other, laughing.*`);
			embed.setImage('https://i.pinimg.com/originals/7e/e4/01/7ee4017f0152c7b7c573a3dfe2c6673f.gif');
		}
		if (changedCondition.statsUpdateText) { embed.setFooter({ text: changedCondition.statsUpdateText }); }

		/* If user 2 had a cold, infect user 1 with a 30% chance. */
		if (quidData2 && profileData2) {

			const infectedCheck = await infectWithChance(userData1, quidData1, profileData1, quidData2, profileData2);
			profileData1 = infectedCheck.profileData;
			infectedEmbed = infectedCheck.infectedEmbed;
		}
	}
	// with a 90% chance if the user is not a youngling, find nothing
	else if (profileData1.rank !== RankType.Youngling
		&& pullFromWeightedTable({ 0: 90, 1: 10 + profileData1.sapling.waterCycles }) === 0) {

		embed.setDescription(`*${quidData1.name} bounces around camp, watching the busy hustle and blurs of hunters and healers at work. ${upperCasePronounAndPlural(quidData1, 0, 'splashes', 'splash')} into the stream that splits the pack in half, chasing the minnows with ${pronoun(quidData1, 2)} eyes.*`);
		if (changedCondition.statsUpdateText) { embed.setFooter({ text: changedCondition.statsUpdateText }); }
	}
	// if the user is not a youngling, and either the user is also not an apprentice or with a 90% chance, get hurt
	else if (profileData1.rank !== RankType.Youngling
		&& (profileData1.rank !== RankType.Apprentice
			|| pullFromWeightedTable({ 0: 10, 1: 90 + profileData1.sapling.waterCycles }))) {

		const healthPoints = getSmallerNumber(getRandomNumber(5, 3), profileData1.health);

		if (getRandomNumber(2) === 0 && profileData1.injuries.cold === false) {

			profileData1.injuries.cold = true;

			embed.setDescription(`*${quidData1.name} tumbles around camp, weaving through dens and packmates at work. ${upperCasePronounAndPlural(quidData1, 0, 'pause')} for a moment, having a sneezing and coughing fit. It looks like ${quidData1.name} has caught a cold.*`);
			embed.setFooter({ text: `-${healthPoints} HP (from cold)\n${changedCondition.statsUpdateText}` });

		}
		else {

			profileData1.injuries.wounds += 1;

			embed.setDescription(`*${quidData1.name} strays from camp, playing near the pack borders. ${upperCasePronounAndPlural(quidData1, 0, 'hop')} on rocks and pebbles, trying to keep ${pronoun(quidData1, 2)} balance, but the rock ahead of ${pronoun(quidData1, 1)} is steeper and more jagged. ${upperCasePronounAndPlural(quidData1, 0, 'land')} with an oomph and a gash slicing through ${pronoun(quidData1, 2)} feet from the sharp edges.*`);
			embed.setFooter({ text: `-${healthPoints} HP (from wound)\n${changedCondition.statsUpdateText}` });
		}

		userData1 = await userModel.findOneAndUpdate(
			u => u._id === userData1?._id,
			(u) => {
				const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, profileData1.serverId)).profiles, profileData1.serverId);
				p.health -= healthPoints;
				p.injuries = profileData1.injuries;
			},
		);
		quidData1 = getMapData(userData1.quids, quidData1._id);
		profileData1 = getMapData(quidData1.profiles, profileData1.serverId);
	}
	// find a plant
	else {

		const plantGame = createPlantGame(speciesInfo[quidData1.species].habitat);
		const foundItem = await pickPlant(0, serverData);

		playComponent = plantGame.plantComponent;

		const biome = {
			[SpeciesHabitatType.Cold]: 'forest',
			[SpeciesHabitatType.Warm]: 'shrubland',
			[SpeciesHabitatType.Water]: 'river',
		}[speciesInfo[quidData1.species].habitat];
		const descriptionText = `*${quidData1.name} bounds across the den territory, chasing a bee that is just out of reach. Without looking, the ${quidData1.displayedSpecies || quidData1.species} crashes into a Healer, loses sight of the bee, and scurries away into the ${biome}. On ${pronoun(quidData1, 2)} way back to the pack border, ${quidData1.name} sees something special on the ground. It's a ${foundItem}!*`;

		embed.setDescription(descriptionText);
		embed.setFooter({ text: `Click the button with this emoji: ${plantGame.emojiToFind}, but without the campsite (${plantEmojis.toAvoid}).` });

		botReply = await respond(interaction, {
			content: messageContent,
			embeds: [...embedArray, embed],
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

				if (tutorialMapEntry === 1) { tutorialMap.set(quidData1._id + profileData1.serverId, 2); }

				userData1 = await userModel.findOneAndUpdate(
					u => u._id === userData1?._id,
					(u) => {
						const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
						if (keyInObject(p.inventory.commonPlants, foundItem)) { p.inventory.commonPlants[foundItem] += 1; }
						else if (keyInObject(p.inventory.uncommonPlants, foundItem)) { p.inventory.uncommonPlants[foundItem] += 1; }
						else { p.inventory.rarePlants[foundItem] += 1; }
					},
				);
				quidData1 = getMapData(userData1.quids, quidData1._id);
				profileData1 = getMapData(quidData1.profiles, profileData1.serverId);
				embed.setFooter({ text: `${changedCondition.statsUpdateText}\n\n+1 ${foundItem}` });
			}
			else {

				embed.setDescription(descriptionText.substring(0, descriptionText.length - 1) + ` But as the ${quidData1.displayedSpecies || quidData1.species} tries to pick it up, it just breaks into little pieces.*`);
			}
			buttonInteraction = i;
		}

		playComponent.setComponents(playComponent.components.map(c => c.setDisabled(true)));
	}

	cooldownMap.set(userData1._id + interaction.guildId, false);
	const levelUpEmbed = (await checkLevelUp(interaction, userData1, quidData1, profileData1, serverData)).levelUpEmbed;

	if (foundQuest) {

		userData1 = await userModel.findOneAndUpdate(
			u => u._id === userData1!._id,
			(u) => {
				const p = getMapData(getMapData(u.quids, quidData1._id).profiles, interaction.guildId);
				p.hasQuest = true;
			},
		);
		quidData1 = getMapData(userData1.quids, quidData1._id);
		profileData1 = getMapData(quidData1.profiles, profileData1.serverId);

		botReply = await sendQuestMessage(interaction, userData1, quidData1, profileData1, serverData, messageContent, embedArray, [...(changedCondition.injuryUpdateEmbed ? [changedCondition.injuryUpdateEmbed] : []),
			...(levelUpEmbed ? [levelUpEmbed] : [])], changedCondition.statsUpdateText);
	}
	else {

		const tutorialMapEntry_ = tutorialMap.get(quidData1._id + profileData1.serverId);
		botReply = await (async function(messageObject) { return buttonInteraction ? await update(buttonInteraction, messageObject) : await respond(interaction, messageObject, true); })({
			content: messageContent,
			embeds: [
				...embedArray,
				embed,
				...(changedCondition.injuryUpdateEmbed ? [changedCondition.injuryUpdateEmbed] : []),
				...(infectedEmbed ? [infectedEmbed] : []),
				...(levelUpEmbed ? [levelUpEmbed] : []),
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

	await isPassedOut(interaction, userData1, quidData1, profileData1, true);

	await coloredButtonsAdvice(interaction, userData1);
	await restAdvice(interaction, userData1, profileData1);
	await drinkAdvice(interaction, userData1, profileData1);
	await eatAdvice(interaction, userData1, profileData1);

	if (playedTogether && userData2 !== null && quidData2 !== null) { await addFriendshipPoints(botReply, userData1, quidData1._id, userData2, quidData2._id); }
}

function isEligableForPlaying(
	_id: string,
	quid: Quid,
	guildId: string,
): quid is Quid<true> {

	const p = quid.profiles[guildId];
	return quid.name !== '' && quid.species !== '' && p !== undefined && p.currentRegion === CurrentRegionType.Prairie && p.energy > 0 && p.health > 0 && p.hunger > 0 && p.thirst > 0 && p.injuries.cold === false && cooldownMap.get(_id + guildId) !== true && p.isResting === false && isResting(_id, p.serverId) === false;
}