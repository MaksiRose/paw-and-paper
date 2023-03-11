import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, InteractionResponse, Message, SlashCommandBuilder, Snowflake, SnowflakeUtil } from 'discord.js';
import { Op } from 'sequelize';
import { speciesInfo } from '../..';
import DiscordUser from '../../models/discordUser';
import Quid from '../../models/quid';
import QuidToServer from '../../models/quidToServer';
import Server from '../../models/server';
import User from '../../models/user';
import UserToServer from '../../models/userToServer';
import { CurrentRegionType, RankType } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { SpeciesHabitatType } from '../../typings/main';
import { coloredButtonsAdvice, drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { userFindsQuest, changeCondition, infectWithChance, addExperience } from '../../utils/changeCondition';
import { updateAndGetMembers } from '../../utils/checkRoleRequirements';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { hasFullInventory, isInteractable, isInvalid, isPassedOut } from '../../utils/checkValidity';
import { disableCommandComponent } from '../../utils/componentDisabling';
import { constructCustomId, deconstructCustomId } from '../../utils/customId';
import { addFriendshipPoints } from '../../utils/friendshipHandling';
import { accessiblePlantEmojis, createFightGame, createPlantGame, plantEmojis } from '../../utils/gameBuilder';
import { getDisplayname, getDisplayspecies, pronoun, pronounAndPlural } from '../../utils/getQuidInfo';
import { capitalize, getArrayElement, respond, setCooldown } from '../../utils/helperFunctions';
import { checkLevelUp } from '../../utils/levelHandling';
import { missingPermissions } from '../../utils/permissionHandler';
import { getRandomNumber, pullFromWeightedTable } from '../../utils/randomizers';
import { pickPlant } from '../../utils/simulateItemUse';
import { isResting } from '../gameplay_maintenance/rest';
import { remindOfAttack } from './attack';
import { sendQuestMessage } from './start-quest';

type CustomIdArgs = ['new'] | ['new', string];

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
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer, server, discordUser }) => {

		await executePlaying(interaction, { user, quid, userToServer, quidToServer, discordUser }, server);
	},
	async sendMessageComponentResponse(interaction, { user, quid, userToServer, quidToServer, server, discordUser }) {

		const customId = deconstructCustomId<CustomIdArgs>(interaction.customId);
		if (interaction.isButton() && customId?.args[0] === 'new') {

			await executePlaying(interaction, { user, quid, userToServer, quidToServer, discordUser }, server);
		}
	},
};

export async function executePlaying(
	interaction: ChatInputCommandInteraction | ButtonInteraction,
	{ user, quid, userToServer, quidToServer, discordUser }: { user?: User, quid?: Quid, userToServer?: UserToServer, quidToServer?: QuidToServer, discordUser?: DiscordUser; },
	server: Server | undefined,
	{ forceEdit = false } = {},
): Promise<void> {

	if (await missingPermissions(interaction, [
		'ViewChannel', // Needed because of createCommandComponentDisabler in sendQuestMessage
		/* 'ViewChannel',*/ interaction.channel?.isThread() ? 'SendMessagesInThreads' : 'SendMessages', 'EmbedLinks', 'EmbedLinks', // Needed for channel.send call in addFriendshipPoints
	]) === true) { return; }

	/* This ensures that the user is in a guild and has a completed account. */
	if (server === undefined) { throw new Error('server is undefined'); }
	if (!isInGuild(interaction) || !hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (user !== undefined && (await Quid.count({ where: { userId: user.id } })) > 0) })) { return; } // This is always a reply
	if (!discordUser) { throw new TypeError('discordUser is undefined'); }
	if (!user) { throw new TypeError('user is undefined'); }
	if (!userToServer) { throw new TypeError('userToServer is undefined'); }
	if (!quidToServer) { throw new TypeError('quidToServer is undefined'); }

	/* It's disabling all components if userData exists and the command is set to disable a previous command. */
	if (command.disablePreviousCommand) { await disableCommandComponent(userToServer); }

	/* Checks if the profile is resting, on a cooldown or passed out. */
	const restEmbed = await isInvalid(interaction, user, userToServer, quid, quidToServer);
	if (restEmbed === false) { return; }

	let messageContent = remindOfAttack(interaction.guildId);

	if (await hasFullInventory(interaction, user, userToServer, quid, quidToServer, restEmbed, messageContent)) { return; }

	const tutorialMapEntry = tutorialMap.get(quid.id + quidToServer.serverId);
	const mentionedUserId = tutorialMapEntry === 2 ? undefined : interaction.isChatInputCommand() ? interaction.options.getUser('user')?.id : deconstructCustomId<CustomIdArgs>(interaction.customId)?.args[1];
	if (quidToServer.tutorials_play === false && quidToServer.rank === RankType.Youngling && (tutorialMapEntry === undefined || tutorialMapEntry === 0)) {

		// This is an update when forceEdit is true, which it is only for the travel-regions command, else this is a reply
		await respond(interaction, {
			content: '*About the structure of RPG messages:*\n\n- Most messages have `Roleplay text`, which is written in cursive, and only for fun!\n- More important is the `Info text`, which is at the bottom of each message, and has the most important info like how to play a game or stat changes. **Read this part first** to avoid confusion!\n\n> Here is an example of what this might look like:',
			embeds: [new EmbedBuilder()
				.setColor(quid.color)
				.setImage('https://raw.githubusercontent.com/MaksiRose/paw-and-paper/dev/pictures/tutorials/Play.png')],
			components: [
				new ActionRowBuilder<ButtonBuilder>()
					.setComponents(new ButtonBuilder()
						.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, user.id, ['new', ...(mentionedUserId ? [mentionedUserId] : []) as [string]]))
						.setLabel('I understand, let\'s try it out!')
						.setStyle(ButtonStyle.Success)),
			],
		}, forceEdit ? 'update' : 'reply', (forceEdit && interaction.isMessageComponent()) ? interaction.message.id : undefined);
		tutorialMap.set(quid.id + quidToServer.serverId, 1);
		return;
	}

	const discordUser2 = await DiscordUser.findByPk(mentionedUserId);
	if (mentionedUserId && (discordUser.id === mentionedUserId || discordUser2?.userId === user.id)) {

		// This is an update when forceEdit is true, which it is only for the travel-regions command, else this is a reply
		await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, new EmbedBuilder()
				.setColor(quid.color)
				.setAuthor({
					name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
					iconURL: quid.avatarURL,
				})
				.setDescription(`*${quid.name} plays with ${pronoun(quid, 4)}. The rest of the pack looks away in embarrassment.*`)],
		}, forceEdit ? 'update' : 'reply', (forceEdit && interaction.isMessageComponent()) ? interaction.message.id : undefined);
		return;
	}

	let user2 = discordUser2 ? await User.findByPk(discordUser2.userId) ?? undefined : undefined;
	let userToServer2 = user2 ? await UserToServer.findOne({ where: { userId: user2.id, serverId: server.id } }) ?? undefined : undefined;
	let quid2 = userToServer2?.activeQuidId ? await Quid.findByPk(userToServer2.activeQuidId) ?? undefined : undefined;
	let quidToServer2 = quid2 ? await QuidToServer.findOne({ where: { quidId: quid2.id, serverId: server.id } }) ?? undefined : undefined;
	if (!user2) {

		const quidsToServers = await findPlayableQuidsToServers(interaction.guildId);

		if (quidsToServers.length > 0) {

			quidToServer2 = getArrayElement(quidsToServers, getRandomNumber(quidsToServers.length));
			quid2 = quidToServer2.quid;
			user2 = await User.findByPk(quid2.userId) ?? undefined;
			userToServer2 = user2 ? await UserToServer.findOne({ where: { userId: user2.id, serverId: server.id } }) ?? undefined : undefined;
		}
	}

	/* Check if the user is interactable, and if they are, define quid data and profile data. */
	if (mentionedUserId && !isInteractable(interaction, quid2, quidToServer2, user2, userToServer2, messageContent, restEmbed) || !user2 || !userToServer2 || !quidToServer2) { return; }

	await setCooldown(userToServer, true);

	const changedCondition = await changeCondition(quidToServer, quid, 0, CurrentRegionType.Prairie);

	const responseTime = quidToServer.rank === RankType.Youngling ? (tutorialMapEntry === 1 || tutorialMapEntry === 2) ? 3_600_000 : 10_000 : 5_000;
	const embed = new EmbedBuilder()
		.setColor(quid.color)
		.setAuthor({
			name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
			iconURL: quid.avatarURL,
		});
	let infectedEmbed: EmbedBuilder[] = [];
	let playComponent: ActionRowBuilder<ButtonBuilder> | null = null;
	let responseId: Snowflake;
	/** This is used in case the user is fighting or finding a plant, in order to respond to the interaction */
	let buttonInteraction: ButtonInteraction<'cached'> | null = null;

	let foundQuest = false;
	let playedTogether = false;
	// If the user is a Youngling with a level over 2 that doesn't have a quest and has not unlocked any ranks and they haven't mentioned anyone, with an at least 33% chance get a quest
	if (quidToServer.rank === RankType.Youngling
		&& !mentionedUserId
		&& await userFindsQuest(quidToServer)) { foundQuest = true; }
	// Play together either 100% of the time if someone was mentioned, or 70% of the time if either there is a userData2 or the user is a Youngling
	else if (tutorialMapEntry !== 1
		&& (mentionedUserId
			|| tutorialMapEntry === 2
			|| ((user2 || quidToServer.rank === RankType.Youngling)
				&& pullFromWeightedTable({ 0: 3, 1: 7 }) === 1))
	) {

		playedTogether = true;
		if (tutorialMapEntry === 2) {

			user2 = undefined;
			userToServer2 = undefined;
			quid2 = undefined;
			quidToServer2 = undefined;
		}

		if (hasNameAndSpecies(quid2) && quidToServer2 && (quidToServer.rank === RankType.Youngling || quidToServer.rank === RankType.Apprentice)) {

			const partnerHealthPoints = Math.min(quidToServer2.maxHealth - quidToServer2.health, getRandomNumber(5, 1));
			await quidToServer2.update({ health: quidToServer2.health + partnerHealthPoints });
			changedCondition.statsUpdateText += `\n\n+${partnerHealthPoints} HP for ${quid2.name} (${quidToServer2.health}/${quidToServer2.maxHealth})`;
		}

		let whoWinsChance = pullFromWeightedTable({ 0: 1, 1: 1 });

		if (mentionedUserId === undefined) {

			const fightGame = createFightGame();
			playComponent = fightGame.fightComponent;

			whoWinsChance = 1;

			if (fightGame.cycleKind === '_attack') {

				embed.setDescription(`⏫ *${quid2?.name || 'The Elderly'} gets ready to attack. ${quid.name} must think quickly about how ${pronounAndPlural(quid, 0, 'want')} to react.*`);
				embed.setFooter({ text: 'Click the button that wins against your opponent\'s move (⏫ Attack).\nTip: Dodging an attack surprises the opponent and puts you in the perfect position for a counterattack.' });
			}
			else if (fightGame.cycleKind === 'dodge') {

				embed.setDescription(`↪️ *Looks like ${quid2?.name || 'the Elderly'} is preparing a maneuver for ${quid.name}'s next move. The ${getDisplayspecies(quid)} must think quickly about how ${pronounAndPlural(quid, 0, 'want')} to react.*`);
				embed.setFooter({ text: 'Click the button that wins against your opponent\'s move (↪️ Dodge).\nTip: Defending a maneuver blocks it effectively, which prevents your opponent from hurting you.' });
			}
			else if (fightGame.cycleKind === 'defend') {

				embed.setDescription(`⏺️ *${quid2?.name || 'The Elderly'} gets into position to oppose an attack. ${quid.name} must think quickly about how ${pronounAndPlural(quid, 0, 'want')} to react.*`);
				embed.setFooter({ text: 'Click the button that wins against your opponent\'s move (⏺️ Defend).\nTip: Attacks come with a lot of force, making them difficult to defend against.' });
			}
			else { throw new TypeError('cycleKind is undefined'); }

			// This is an update when forceEdit is true, which it is only for the travel-regions command, else this is a reply
			const botReply = await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, embed],
				components: [playComponent],
			}, forceEdit ? 'update' : 'reply', (forceEdit && interaction.isMessageComponent()) ? interaction.message.id : undefined);

			/* Here we are making sure that the correct button will be blue by default. If the player choses the correct button, this will be overwritten. */
			playComponent = fightGame.correctButtonOverwrite();

			const i = await (botReply as Message<true> | InteractionResponse<true>)
				.awaitMessageComponent({
					filter: i => i.user.id === interaction.user.id,
					componentType: ComponentType.Button,
					time: responseTime,
				})
				.catch(() => { return null; });

			if (i !== null) {

				/* Here we make the button the player choses red, this will apply always except if the player choses the correct button, then this will be overwritten. */
				playComponent = fightGame.chosenWrongButtonOverwrite(i.customId);

				if ((i.customId.includes('_attack') && fightGame.cycleKind === 'defend')
					|| (i.customId.includes('defend') && fightGame.cycleKind === 'dodge')
					|| (i.customId.includes('dodge') && fightGame.cycleKind === '_attack')) {

					/* The button the player choses is overwritten to be green here, only because we are sure that they actually chose corectly. */
					playComponent = fightGame.chosenRightButtonOverwrite(i.customId);

					await quidToServer.update({ tutorials_play: true });

					tutorialMap.delete(quid.id + quidToServer.serverId);

					whoWinsChance = 0;

					if (quidToServer.rank === RankType.Youngling) { changedCondition.statsUpdateText = `${await addExperience(quidToServer, getRandomNumber(4, 5))}\n${changedCondition.statsUpdateText}`; }
				}
				else if (i.customId.includes(fightGame.cycleKind) && quidToServer.rank === RankType.Youngling) { changedCondition.statsUpdateText = `${await addExperience(quidToServer, getRandomNumber(2, 1))}\n${changedCondition.statsUpdateText}`; }

				buttonInteraction = i;
			}

			playComponent.setComponents(playComponent.components.map(component => component.setDisabled(true)));
		}
		else {

			messageContent = `${messageContent}\n\n<@${mentionedUserId}>`;
		}

		if (whoWinsChance === 0) { // User wins

			embed.setDescription(`*${quid.name} trails behind ${quid2?.name ?? 'an Elderly'}'s rear end, preparing for a play attack. The ${getDisplayspecies(quid)} launches forward, landing on top of ${quid2 === undefined ? 'them' : pronoun(quid2, 1)}.* "I got you${!quid2 ? '' : ', ' + quid2.name}!" *${pronounAndPlural(quid, 0, 'say')}. Both creatures bounce away from each other, laughing.*`);
			embed.setImage('https://external-preview.redd.it/iUqJpDGv2YSDitYREfnTvsUkl9GG6oPMCRogvilkIrg.gif?s=9b0ea7faad7624ec00b5f8975e2cf3636f689e27');
		}
		else { // Opponent wins

			embed.setDescription(`*${quid.name} trails behind ${quid2?.name ?? 'an Elderly'}'s rear end, preparing for a play attack. Right when the ${getDisplayspecies(quid)} launches forward, ${quid2?.name ?? 'the Elderly'} dashes sideways, followed by a precise jump right on top of ${quid.name}.* "I got you, ${quid.name}!" *${quid2 === undefined ? 'they say' : pronounAndPlural(quid2, 0, 'say')}. Both creatures bounce away from each other, laughing.*`);
			embed.setImage('https://i.pinimg.com/originals/7e/e4/01/7ee4017f0152c7b7c573a3dfe2c6673f.gif');
		}
		if (changedCondition.statsUpdateText) { embed.setFooter({ text: changedCondition.statsUpdateText }); }

		/* If user 2 had a cold, infect user 1 with a 30% chance. */
		if (hasNameAndSpecies(quid2) && quidToServer2) {

			infectedEmbed = await infectWithChance(quidToServer, quid, quidToServer2, quid2);
		}
	}
	// with a 90% chance if the user is not a youngling, find nothing
	else if (quidToServer.rank !== RankType.Youngling
		&& pullFromWeightedTable({ 0: 90, 1: 10 + quidToServer.sapling_waterCycles }) === 0) {

		embed.setDescription(`*${quid.name} bounces around camp, watching the busy hustle and blurs of hunters and healers at work. ${capitalize(pronounAndPlural(quid, 0, 'splashes', 'splash'))} into the stream that splits the pack in half, chasing the minnows with ${pronoun(quid, 2)} eyes.*`);
		if (changedCondition.statsUpdateText) { embed.setFooter({ text: changedCondition.statsUpdateText }); }
	}
	// if the user is not a youngling, and either the user is also not an apprentice or with a 90% chance, get hurt
	else if (quidToServer.rank !== RankType.Youngling
		&& (quidToServer.rank !== RankType.Apprentice
			|| pullFromWeightedTable({ 0: 10, 1: 90 + quidToServer.sapling_waterCycles }))) {

		const healthPoints = Math.min(getRandomNumber(5, 3), quidToServer.health);
		const newInjuries = { cold: quidToServer.injuries_cold, wounds: quidToServer.injuries_wounds };

		if (getRandomNumber(2) === 0 && quidToServer.injuries_cold === false) {

			newInjuries.cold = true;

			embed.setDescription(`*${quid.name} tumbles around camp, weaving through dens and packmates at work. ${capitalize(pronounAndPlural(quid, 0, 'pause'))} for a moment, having a sneezing and coughing fit. It looks like ${quid.name} has caught a cold.*`);
			embed.setFooter({ text: `-${healthPoints} HP (from cold)\n${changedCondition.statsUpdateText}` });

		}
		else {

			newInjuries.wounds += 1;

			embed.setDescription(`*${quid.name} strays from camp, playing near the pack borders. ${capitalize(pronounAndPlural(quid, 0, 'hop'))} on rocks and pebbles, trying to keep ${pronoun(quid, 2)} balance, but the rock ahead of ${pronoun(quid, 1)} is steeper and more jagged. ${capitalize(pronounAndPlural(quid, 0, 'land'))} with an oomph and a gash slicing through ${pronoun(quid, 2)} feet from the sharp edges.*`);
			embed.setFooter({ text: `-${healthPoints} HP (from wound)\n${changedCondition.statsUpdateText}` });
		}

		await quidToServer.update({ health: quidToServer.health - healthPoints, injuries_wounds: newInjuries.wounds, injuries_cold: newInjuries.cold });
	}
	// find a plant
	else {

		const replaceEmojis = user.accessibility_replaceEmojis;
		const plantGame = createPlantGame(replaceEmojis ? 'accessible' : speciesInfo[quid.species].habitat);
		const foundItem = await pickPlant(0, server);

		playComponent = plantGame.plantComponent;

		const biome = {
			[SpeciesHabitatType.Cold]: 'forest',
			[SpeciesHabitatType.Warm]: 'shrubland',
			[SpeciesHabitatType.Water]: 'river',
		}[speciesInfo[quid.species].habitat];
		const descriptionText = `*${quid.name} bounds across the den territory, chasing a bee that is just out of reach. Without looking, the ${getDisplayspecies(quid)} crashes into a Healer, loses sight of the bee, and scurries away into the ${biome}. On ${pronoun(quid, 2)} way back to the pack border, ${quid.name} sees something special on the ground. It's a ${foundItem}!*`;

		embed.setDescription(descriptionText);
		embed.setFooter({ text: `Click the button with this ${replaceEmojis ? 'character' : 'emoji'}: ${plantGame.emojiToFind}, but without the campsite (${replaceEmojis ? accessiblePlantEmojis.toAvoid : plantEmojis.toAvoid}).` });

		// This is an update when forceEdit is true, which it is only for the travel-regions command, else this is a reply
		const botReply = await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, embed],
			components: [playComponent],
		}, forceEdit ? 'update' : 'reply', (forceEdit && interaction.isMessageComponent()) ? interaction.message.id : undefined);

		/* Here we are making sure that the correct button will be blue by default. If the player choses the correct button, this will be overwritten. */
		playComponent = plantGame.correctButtonOverwrite();

		const i = await (botReply as Message<true> | InteractionResponse<true>)
			.awaitMessageComponent({
				filter: i => i.user.id === interaction.user.id,
				componentType: ComponentType.Button,
				time: responseTime,
			})
			.catch(() => { return null; });
		let isWin = false;

		if (i !== null) {

			/* Here we make the button the player choses red, this will apply always except if the player choses the correct button, then this will be overwritten. */
			playComponent = plantGame.chosenWrongButtonOverwrite(i.customId);

			if (i.customId.includes(plantGame.emojiToFind) && !i.customId.includes(replaceEmojis ? accessiblePlantEmojis.toAvoid : plantEmojis.toAvoid)) {

				/* The button the player choses is overwritten to be green here, only because we are sure that they actually chose corectly. */
				playComponent = plantGame.chosenRightButtonOverwrite(i.customId);

				if (tutorialMapEntry === 1) { tutorialMap.set(quid.id + quidToServer.serverId, 2); }

				quidToServer.inventory.push(foundItem);
				await quidToServer.update({ inventory: [...quidToServer.inventory] });
				isWin = true;

				if (quidToServer.rank === RankType.Youngling) { changedCondition.statsUpdateText = `${await addExperience(quidToServer, getRandomNumber(4, 5))}\n${changedCondition.statsUpdateText}`; }
			}
			else {

				if (!i.customId.includes(plantGame.emojiToFind) && quidToServer.rank === RankType.Youngling) { changedCondition.statsUpdateText = `${await addExperience(quidToServer, getRandomNumber(2, 1))}\n${changedCondition.statsUpdateText}`; }

				embed.setDescription(descriptionText.substring(0, descriptionText.length - 1) + ` But as the ${getDisplayspecies(quid)} tries to pick it up, it just breaks into little pieces.*`);
			}
			buttonInteraction = i;
		}

		if (changedCondition.statsUpdateText) { embed.setFooter({ text: `${changedCondition.statsUpdateText}${isWin ? `\n\n+ 1 ${foundItem}` : ''} ` }); }

		playComponent.setComponents(playComponent.components.map(c => c.setDisabled(true)));
	}

	await setCooldown(userToServer, false);

	const members = await updateAndGetMembers(user.id, interaction.guild);
	const levelUpEmbed = await checkLevelUp(interaction, quid, quidToServer, members);

	if (foundQuest) {

		await quidToServer.update({ hasQuest: true });

		// This is an update when forceEdit is true, which it is only for the travel-regions command, else this is a reply
		responseId = await sendQuestMessage(interaction, forceEdit ? 'update' : 'reply', user, quid, userToServer, quidToServer, messageContent, restEmbed, [...changedCondition.injuryUpdateEmbed, ...levelUpEmbed], changedCondition.statsUpdateText);
	}
	else {

		const tutorialMapEntry_ = tutorialMap.get(quid.id + quidToServer.serverId);
		// This is an update when forceEdit is true, which it is only for the travel-regions command, else this is a reply
		({ id: responseId } = await respond(buttonInteraction ?? interaction, {
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
						.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, user.id, ['new', ...(mentionedUserId ? [mentionedUserId] : []) as [string]]))
						.setLabel((tutorialMapEntry === 1 && tutorialMapEntry_ === 1) || (tutorialMapEntry === 2 && tutorialMapEntry_ === 2) ? 'Try again' : tutorialMapEntry === 1 && tutorialMapEntry_ === 2 ? 'Try another game' : 'Play again')
						.setStyle(ButtonStyle.Primary)),
			],
		}, (forceEdit || buttonInteraction !== null) ? 'update' : 'reply', buttonInteraction !== null ? buttonInteraction.message.id : (forceEdit && interaction.isMessageComponent()) ? interaction.message.id : undefined));

		if (tutorialMapEntry === 2 && tutorialMapEntry_ === undefined) {

			// This is always a followUp
			await respond(buttonInteraction ?? interaction, {
				content: 'Good job! You have understood the basics of how to play the RPG. From now on, there is a time limit of a few seconds for clicking the minigame-buttons. Have fun!',
			});
		}
	}

	await isPassedOut(interaction, user, userToServer, quid, quidToServer, true);

	await coloredButtonsAdvice(interaction, user);
	await restAdvice(interaction, user, quidToServer);
	await drinkAdvice(interaction, user, quidToServer);
	await eatAdvice(interaction, user, quidToServer);

	const channel = interaction.channel ?? await interaction.client.channels.fetch(interaction.channelId);
	if (channel === null || !channel.isTextBased()) { throw new TypeError('interaction.channel is null or not text based'); }
	if (playedTogether && hasNameAndSpecies(quid2)) { await addFriendshipPoints({ createdTimestamp: SnowflakeUtil.timestampFrom(responseId), channel: channel }, quid, quid2, { serverId: interaction.guildId, userToServer, quidToServer, user }); } // I have to call SnowflakeUtil since InteractionResponse wrongly misses the createdTimestamp which is hopefully added in the future
}

async function findPlayableQuidsToServers(
	guildId: string,
) {

	const rows = await QuidToServer.findAll({
		include: [{
			model: Quid,
			where: {
				name: { [Op.not]: '' },
				species: { [Op.not]: null },
			},
		}],
		where: {
			serverId: guildId,
			currentRegion: CurrentRegionType.Prairie,
			health: { [Op.gt]: 0 },
			energy: { [Op.gt]: 0 },
			hunger: { [Op.gt]: 0 },
			thirst: { [Op.gt]: 0 },
			injuries_cold: false,

		},
	});

	return await Promise.all(rows.filter(async (row) => {

		const userToServer = await UserToServer.findOne({ where: { userId: row.quid.userId, serverId: guildId } });

		return row.quid.name !== '' &&
			row.quid.species !== null &&
			userToServer?.hasCooldown !== true &&
			(userToServer == null ? false : isResting(userToServer)) !== true;
	}));
}