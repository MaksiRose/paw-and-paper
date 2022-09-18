import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, Message, SlashCommandBuilder } from 'discord.js';
import { cooldownMap } from '../../events/interactionCreate';
import userModel from '../../models/userModel';
import { CurrentRegionType, Quid, RankType, ServerSchema, SlashCommand, SpeciesHabitatType, speciesInfo, SpeciesNames, UserSchema } from '../../typedef';
import { coloredButtonsAdvice, drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { changeCondition, infectWithChance, pickRandomCommonPlant } from '../../utils/changeCondition';
import { hasCompletedAccount, isInGuild } from '../../utils/checkUserState';
import { hasFullInventory, isInteractable, isInvalid, isPassedOut } from '../../utils/checkValidity';
import { addFriendshipPoints } from '../../utils/friendshipHandling';
import { createFightGame, createPlantGame, plantEmojis } from '../../utils/gameBuilder';
import { pronoun, pronounAndPlural, upperCasePronounAndPlural } from '../../utils/getPronouns';
import { getMapData, getQuidDisplayname, getSmallerNumber, respond, update } from '../../utils/helperFunctions';
import { checkLevelUp } from '../../utils/levelHandling';
import { getRandomNumber, pullFromWeightedTable } from '../../utils/randomizers';
import { remindOfAttack } from './attack';
import { sendQuestMessage } from './start-quest';

const name: SlashCommand['name'] = 'play';
const description: SlashCommand['description'] = 'The main activity of Younglings. Costs energy, but gives XP.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.addUserOption(option =>
			option.setName('user')
				.setDescription('The user you want to play with')
				.setRequired(false))
		.setDMPermission(false)
		.toJSON(),
	disablePreviousCommand: true,
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
	if (!hasCompletedAccount(interaction, userData1)) { return; }

	/* Gets the current active quid and the server profile from the account */
	const quidData1 = getMapData(userData1.quids, getMapData(userData1.currentQuid, interaction.guildId));
	let profileData1 = getMapData(quidData1.profiles, interaction.guildId);

	/* Checks if the profile is resting, on a cooldown or passed out. */
	if (await isInvalid(interaction, userData1, quidData1, profileData1, embedArray)) { return; }

	let messageContent = remindOfAttack(interaction.guildId);

	if (await hasFullInventory(interaction, quidData1, profileData1, embedArray, messageContent)) { return; }

	const mentionedUserId = interaction.isChatInputCommand() ? interaction.options.getUser('user')?.id : interaction.customId.split('_')[2];
	if (mentionedUserId && userData1.userId.includes(mentionedUserId)) {

		await respond(interaction, {
			content: messageContent,
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(quidData1.color)
				.setAuthor({ name: getQuidDisplayname(quidData1, interaction.guildId), iconURL: quidData1.avatarURL })
				.setDescription(`*${quidData1.name} plays with ${pronoun(quidData1, 4)}. The rest of the pack looks away in embarrassment.*`)],
		}, true)
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	let userData2 = mentionedUserId ? await userModel.findOne(u => u.userId.includes(mentionedUserId)).catch(() => { return null; }) : null;

	if (!userData2) {

		const usersEligibleForPlaying = (await userModel
			.find(
				u => Object.values(u.quids).filter(q => isEligableForPlaying(u.uuid, q, interaction.guildId)).length > 0,
			))
			.filter(u => u.uuid !== userData1?.uuid);

		if (usersEligibleForPlaying.length > 0) {

			userData2 = usersEligibleForPlaying[getRandomNumber(usersEligibleForPlaying.length)] || null;
			if (userData2) {

				const newCurrentQuid = Object.values(userData2.quids).find(q => isEligableForPlaying(userData2!.uuid, q, interaction.guildId));
				if (newCurrentQuid) { userData2.currentQuid[interaction.guildId] = newCurrentQuid._id; }
			}
		}
	}

	/* Check if the user is interactable, and if they are, define quid data and profile data. */
	if (mentionedUserId && !isInteractable(interaction, userData2, messageContent, embedArray)) { return; }
	let quidData2 = userData2 ? getMapData(userData2.quids, getMapData(userData2.currentQuid, interaction.guildId)) : null;
	let profileData2 = quidData2 ? getMapData(quidData2.profiles, interaction.guildId) : null;

	cooldownMap.set(userData1.uuid + interaction.guildId, true);

	const experiencePoints = profileData1.rank === RankType.Youngling ? getRandomNumber(9, 1) : profileData1.rank === RankType.Apprentice ? getRandomNumber(11, 5) : 0;
	const changedCondition = await changeCondition(userData1, quidData1, profileData1, experiencePoints, CurrentRegionType.Prairie);
	profileData1 = changedCondition.profileData;

	const responseTime = profileData1.rank === RankType.Youngling ? 10_000 : 5_000;
	const embed = new EmbedBuilder()
		.setColor(quidData1.color)
		.setAuthor({ name: getQuidDisplayname(quidData1, interaction.guildId), iconURL: quidData1.avatarURL });
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
	else if (mentionedUserId
		|| ((userData2 || profileData1.rank === RankType.Youngling)
			&& pullFromWeightedTable({ 0: 3, 1: 7 }) === 1)
	) {

		playedTogether = true;
		if (userData2 && quidData2 && profileData2 && (profileData1.rank === RankType.Youngling || profileData1.rank === RankType.Apprentice)) {

			const partnerHealthPoints = getSmallerNumber(profileData2.maxHealth - profileData2.health, getRandomNumber(5, 1));

			userData2 = await userModel.findOneAndUpdate(
				u => u.uuid === userData2!.uuid,
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
				embed.setFooter({ text: 'Tip: Dodging an attack surprises the opponent and puts you in the perfect position for a counterattack.' });
			}
			else if (fightGame.cycleKind === 'dodge') {

				embed.setDescription(`↪️ *Looks like ${quidData2?.name || 'the Elderly'} is preparing a maneuver for ${quidData1.name}'s next move. The ${quidData1.displayedSpecies || quidData1.species} must think quickly about how ${pronounAndPlural(quidData1, 0, 'want')} to react.*`);
				embed.setFooter({ text: 'Tip: Defending a maneuver blocks it effectively, which prevents your opponent from hurting you.' });
			}
			else if (fightGame.cycleKind === 'defend') {

				embed.setDescription(`⏺️ *${quidData2?.name || 'The Elderly'} gets into position to oppose an attack. ${quidData1.name} must think quickly about how ${pronounAndPlural(quidData1, 0, 'want')} to react.*`);
				embed.setFooter({ text: 'Tip: Attacks come with a lot of force, making them difficult to defend against.' });
			}
			else { throw new TypeError('cycleKind is undefined'); }

			botReply = await respond(interaction, {
				content: messageContent,
				embeds: [...embedArray, embed],
				components: [playComponent],
			}, true);

			/* Here we are making sure that the correct button will be blue by default. If the player choses the correct button, this will be overwritten. */
			playComponent = fightGame.correctButtonOverwrite();

			await (botReply as Message<true>)
				.awaitMessageComponent({
					filter: i => i.user.id === interaction.user.id,
					componentType: ComponentType.Button,
					time: responseTime,
				})
				.then(async i => {

					/* Here we make the button the player choses red, this will apply always except if the player choses the correct button, then this will be overwritten. */
					playComponent = fightGame.chosenWrongButtonOverwrite(i.customId);

					if ((i.customId.includes('attack') && fightGame.cycleKind === 'defend')
						|| (i.customId.includes('defend') && fightGame.cycleKind === 'dodge')
						|| (i.customId.includes('dodge') && fightGame.cycleKind === 'attack')) {

						/* The button the player choses is overwritten to be green here, only because we are sure that they actually chose corectly. */
						playComponent = fightGame.chosenRightButtonOverwrite(i.customId);

						whoWinsChance = 0;
					}
					buttonInteraction = i;
				})
				.catch(() => { /* do nothing */ });

			playComponent.setComponents(playComponent.components.map(component => component.setDisabled(true)));
		}
		else {

			messageContent = `${(messageContent ?? '')}\n\n<@${mentionedUserId}>`;
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
		if (quidData2 && profileData2) { infectedEmbed = await infectWithChance(userData1, quidData1, profileData1, quidData2, profileData2); }
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

		await userModel.findOneAndUpdate(
			u => u.uuid === userData1?.uuid,
			(u) => {
				const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, profileData1.serverId)).profiles, profileData1.serverId);
				p.health -= healthPoints;
				p.injuries = profileData1.injuries;
			},
		);
	}
	// find a plant
	else {

		const plantGame = createPlantGame(speciesInfo[quidData1.species as SpeciesNames].habitat);
		const foundItem = pickRandomCommonPlant();

		playComponent = plantGame.plantComponent;

		const biome = {
			[SpeciesHabitatType.Cold]: 'forest',
			[SpeciesHabitatType.Warm]: 'shrubland',
			[SpeciesHabitatType.Water]: 'river',
		}[speciesInfo[quidData1.species as SpeciesNames].habitat];
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

		await (botReply as Message<true>)
			.awaitMessageComponent({
				filter: i => i.user.id === interaction.user.id,
				componentType: ComponentType.Button,
				time: responseTime,
			})
			.then(async i => {

				/* Here we make the button the player choses red, this will apply always except if the player choses the correct button, then this will be overwritten. */
				playComponent = plantGame.chosenWrongButtonOverwrite(i.customId);

				if (i.customId.includes(plantGame.emojiToFind) && !i.customId.includes(plantEmojis.toAvoid)) {

					/* The button the player choses is overwritten to be green here, only because we are sure that they actually chose corectly. */
					playComponent = plantGame.chosenRightButtonOverwrite(i.customId);

					userData1 = await userModel.findOneAndUpdate(
						u => u.uuid === userData1?.uuid,
						(u) => {
							const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
							p.inventory.commonPlants[foundItem] += 1;
						},
					);
					embed.setFooter({ text: `${changedCondition.statsUpdateText}\n\n+1 ${foundItem}` });
				}
				else {

					embed.setDescription(descriptionText.substring(0, descriptionText.length - 1) + ` But as the ${quidData1.displayedSpecies || quidData1.species} tries to pick it up, it just breaks into little pieces.*`);
				}
				buttonInteraction = i;
			})
			.catch(() => { /* do nothing */ });

		playComponent.setComponents(playComponent.components.map(c => c.setDisabled(true)));
	}

	cooldownMap.set(userData1.uuid + interaction.guildId, false);
	const levelUpEmbed = (await checkLevelUp(interaction, userData1, quidData1, profileData1, serverData)).levelUpEmbed;

	if (foundQuest) {

		await userModel.findOneAndUpdate(
			u => u.uuid === userData1!.uuid,
			(u) => {
				const p = getMapData(getMapData(u.quids, quidData1._id).profiles, interaction.guildId);
				p.hasQuest = true;
			},
		);

		botReply = await sendQuestMessage(interaction, userData1, quidData1, profileData1, serverData, messageContent, embedArray, [...(changedCondition.injuryUpdateEmbed ? [changedCondition.injuryUpdateEmbed] : []),
			...(levelUpEmbed ? [levelUpEmbed] : [])], changedCondition.statsUpdateText);
	}
	else {

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
						.setCustomId(`play_new${mentionedUserId ? `_${mentionedUserId}` : ''}`)
						.setLabel('Play again')
						.setStyle(ButtonStyle.Primary)),
			],
		})
			.catch((error) => { throw new Error(error); });
	}

	await isPassedOut(interaction, userData1, quidData1, profileData1, true);

	await coloredButtonsAdvice(interaction, userData1);
	await restAdvice(interaction, userData1, profileData1);
	await drinkAdvice(interaction, userData1, profileData1);
	await eatAdvice(interaction, userData1, profileData1);

	if (playedTogether && userData2 !== null && quidData2 !== null) { await addFriendshipPoints(botReply, userData1, quidData1._id, userData2, quidData2._id); }
}

function isEligableForPlaying(
	uuid: string,
	quid: Quid,
	guildId: string,
): boolean {

	const p = quid.profiles[guildId];
	return quid.name !== '' && quid.species !== '' && p !== undefined && p.currentRegion === CurrentRegionType.Prairie && p.energy > 0 && p.health > 0 && p.hunger > 0 && p.thirst > 0 && p.injuries.cold === false && cooldownMap.get(uuid + guildId) !== true && !p.isResting;
}