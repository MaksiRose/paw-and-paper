import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, Message, SelectMenuInteraction, SlashCommandBuilder } from 'discord.js';
import { cooldownMap, serverActiveUsersMap } from '../../events/interactionCreate';
import serverModel from '../../models/serverModel';
import userModel from '../../models/userModel';
import { Inventory, RankType, ServerSchema, SlashCommand, SpecialPlantNames, UserSchema } from '../../typedef';
import { drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { changeCondition } from '../../utils/changeCondition';
import { hasCompletedAccount, isInGuild } from '../../utils/checkUserState';
import { isInvalid, isPassedOut } from '../../utils/checkValidity';
import { pronoun, pronounAndPlural } from '../../utils/getPronouns';
import { getMapData, getSmallerNumber, keyInObject, KeyOfUnion, respond, unsafeKeys, update, ValueOf, widenValues } from '../../utils/helperFunctions';
import { checkLevelUp } from '../../utils/levelHandling';
import { generateRandomNumber, generateRandomNumberWithException, pullFromWeightedTable } from '../../utils/randomizers';
const { default_color } = require('../../../config.json');

type serverMapInfo = { startsTimestamp: number | null, idleHumans: number, endingTimeout: NodeJS.Timeout | null, ongoingFights: number; }
const serverMap: Map<string, serverMapInfo > = new Map();
const newCycleArray = ['attack', 'dodge', 'defend'] as const;

const name: SlashCommand['name'] = 'attack';
const description: SlashCommand['description'] = 'If humans are attacking the pack, you can fight back using this command.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.setDMPermission(false)
		.toJSON(),
	disablePreviousCommand: true,
	sendCommand: async (client, interaction, userData, serverData, embedArray) => {

		await executeAttacking(interaction, userData, serverData, embedArray);
	},
};


export async function executeAttacking(
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

	const serverAttackInfo = serverMap.get(interaction.guild.id);
	if (!serverAttackInfo || serverAttackInfo.startsTimestamp !== null) {

		await respond(interaction, {
			embeds: [
				...embedArray,
				new EmbedBuilder()
					.setColor(quidData.color)
					.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL })
					.setDescription(`*${quidData.name} is ready to attack any intruder. But no matter how far ${pronounAndPlural(quidData, 0, 'look')}, ${pronoun(quidData, 0)} can't see anyone. It seems that the pack is not under attack at the moment.*`),
			],
		}, true)
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if (serverAttackInfo.idleHumans <= 0) {

		await respond(interaction, {
			embeds: [
				...embedArray,
				new EmbedBuilder()
					.setColor(quidData.color)
					.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL })
					.setDescription(`*${quidData.name} looks around, searching for a human to attack. It looks like everyone is already being attacked by other pack members. The ${quidData.displayedSpecies || quidData.species} better not interfere before ${pronounAndPlural(quidData, 0, 'hurt')} ${pronoun(quidData, 2)} friends.*`),
			],
		}, true)
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	cooldownMap.set(userData.uuid + interaction.guildId, true);
	serverAttackInfo.idleHumans -= 1;
	serverAttackInfo.ongoingFights += 1;

	const experiencePoints = generateRandomNumber(10, 11);
	const changedCondition = await changeCondition(userData, quidData, profileData, experiencePoints);
	profileData = changedCondition.profileData;

	const embed = new EmbedBuilder()
		.setColor(quidData.color)
		.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL });

	let totalCycles: 0 | 1 | 2 = 0;
	let winLoseRatio = 0;
	let botReply: Message;

	botReply = await interactionCollector(interaction, userData, serverData, serverAttackInfo);

	async function interactionCollector(
		interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>,
		userData: UserSchema,
		serverData: ServerSchema,
		serverAttackInfo: serverMapInfo,
		newInteraction?: ButtonInteraction | SelectMenuInteraction,
		previousFightComponents?: ActionRowBuilder<ButtonBuilder>,
		previousCycleIndex?: number,
	): Promise<Message> {

		const cycleKind = newCycleArray[generateRandomNumberWithException(newCycleArray.length, 0, previousCycleIndex)];

		if (cycleKind === 'attack') {

			embed.setDescription(`⏫ *The human gets ready to attack. ${quidData.name} must think quickly about how ${pronounAndPlural(quidData, 0, 'want')} to react.*`);
		}
		else if (cycleKind === 'dodge') {

			embed.setDescription(`↪️ *Looks like the human is preparing a maneuver for ${quidData.name}'s next move. The ${quidData.displayedSpecies || quidData.species} must think quickly about how ${pronounAndPlural(quidData, 0, 'want')} to react.*`);
		}
		else if (cycleKind === 'defend') {

			embed.setDescription(`⏺️ *The human gets into position to oppose an attack. ${quidData.name} must think quickly about how ${pronounAndPlural(quidData, 0, 'want')} to react.*`);
		}
		else { throw new Error('cycleKind is not attack, dodge or defend'); }
		embed.setFooter({ text: 'You will be presented three buttons: Attack, dodge and defend. Your opponent chooses one of them, and you have to choose which button is the correct response.' });

		const fightComponents = getFightComponents(totalCycles);

		botReply = await (async function(messageContent) { return newInteraction ? await update(newInteraction, messageContent) : await respond(interaction, messageContent, true); })({
			embeds: [...embedArray, embed],
			components: [...previousFightComponents ? [previousFightComponents] : [], fightComponents],
		}).catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
			return botReply;
		});

		/* Here we are making sure that the correct button will be blue by default. If the player choses the correct button, this will be overwritten. */
		fightComponents.setComponents(fightComponents.components.map(component => {

			const data = component.toJSON();

			if (data.style !== ButtonStyle.Link && data.custom_id.includes(cycleKind)) { component.setStyle(ButtonStyle.Primary); }
			return component;
		}));

		newInteraction = await botReply
			.awaitMessageComponent({
				filter: i => i.user.id === interaction.user.id,
				time: profileData.rank === RankType.Elderly ? 3_000 : profileData.rank === RankType.Hunter || profileData.rank === RankType.Healer ? 4_000 : profileData.rank === RankType.Apprentice ? 5_000 : 10_000,
			})
			.then(async i => {

				/* Here we make the button the player choses red, this will apply always except if the player choses the correct button, then this will be overwritten. */
				fightComponents.setComponents(fightComponents.components.map(component => {

					const data = component.toJSON();

					if (data.style !== ButtonStyle.Link && data.custom_id === i.customId) { component.setStyle(ButtonStyle.Danger); }
					return component;
				}));

				if ((i.customId.includes('attack') && cycleKind === 'dodge')
						|| (i.customId.includes('defend') && cycleKind === 'attack')
						|| (i.customId.includes('dodge') && cycleKind === 'defend')) {

					winLoseRatio -= 1;
				}
				else if ((i.customId.includes('attack') && cycleKind === 'defend')
						|| (i.customId.includes('defend') && cycleKind === 'dodge')
						|| (i.customId.includes('dodge') && cycleKind === 'attack')) {

					/* The button the player choses is overwritten to be green here, only because we are sure that they actually chose corectly. */
					fightComponents.setComponents(fightComponents.components.map(component => {

						const data = component.toJSON();

						if (data.style !== ButtonStyle.Link && data.custom_id === i.customId) { component.setStyle(ButtonStyle.Success); }
						return component;
					}));

					winLoseRatio += 1;
				}
				return i;
			})
			.catch(() => {

				winLoseRatio -= 1;
				return newInteraction;
			});

		fightComponents.setComponents(fightComponents.components.map(component => component.setDisabled(true)));

		totalCycles += 1;

		if (totalCycles < 5) {

			botReply = await interactionCollector(interaction, userData, serverData, serverAttackInfo, newInteraction, fightComponents, newCycleArray.findIndex(el => el === cycleKind));
			return botReply;
		}

		cooldownMap.set(userData!.uuid + interaction.guildId, false);

		let minusItemText = '';
		let injuryText = '';
		if (winLoseRatio < 0) { winLoseRatio = 0; }
		winLoseRatio = pullFromWeightedTable({ 0: 5 - winLoseRatio, 1: 5, 2: winLoseRatio });

		if (winLoseRatio === 2) {

			embed.setDescription(`*For a moment it looks like the human might get the upper hand before ${quidData.name} jumps on them with a big hop. The human falls to the ground and crawls away with a terrified look on their face. It looks like they're not coming back.*`);
		}
		else {

			const inventory_ = widenValues(serverData.inventory);
			const { itemType, itemName } = getHighestItem(inventory_);
			if (itemType && itemName) {

				const minusAmount = Math.ceil(inventory_[itemType][itemName] / 10);
				minusItemText += `\n-${minusAmount} ${itemName} for ${interaction.guild.name}`;
				inventory_[itemType][itemName] -= minusAmount;
			}

			await serverModel.findOneAndUpdate(
				s => s.serverId === serverData.serverId,
				(s) => s.inventory = inventory_,
			);

			embed.setDescription(`*The battle between the human and ${quidData.name} is intense. Both are putting up a good fight and it doesn't look like either of them can get the upper hand. The ${quidData.displayedSpecies || quidData.species} tries to jump at them, but the human manages to dodge. Quickly they run in the direction of the food den. They escaped from ${pronoun(quidData, 1)}!*`);

			if (winLoseRatio == 0) {

				const healthPoints = getSmallerNumber(profileData.health, generateRandomNumber(5, 3));

				if (pullFromWeightedTable({ 0: 1, 1: 1 }) === 0) {

					profileData.injuries.wounds += 1;

					embed.setDescription(`*The battle between the human and ${quidData.name} is intense. Both are putting up a good fight and it doesn't look like either of them can get the upper hand. The ${quidData.displayedSpecies || quidData.species} tries to jump at them, but the human manages to dodge. Unfortunately, a rock is directly in ${quidData.name}'s jump line. A sharp pain runs through ${pronoun(quidData, 2)} hip. A red spot slowly spreads where ${pronoun(quidData, 0)} hit the rock. Meanwhile, the human runs into the food den.*`);
					injuryText = `-${healthPoints} HP (from wound)\n`;
				}
				else {

					profileData.injuries.sprains += 1;

					embed.setDescription(`*The battle between the human and ${quidData.name} is intense. Both are putting up a good fight and it doesn't look like either of them can get the upper hand. The ${quidData.displayedSpecies || quidData.species} tries to jump at them, but the human manages to dodge. ${quidData.name} is not prepared for the fall. A sharp pain runs through ${pronoun(quidData, 2)} arm as it bends in the fall. Meanwhile, the human runs into the food den.*`);
					injuryText = `-${healthPoints} HP (from sprain)\n`;
				}

				await userModel.findOneAndUpdate(
					u => u.uuid === userData.uuid,
					(u) => {
						const p = getMapData(getMapData(u.quids, getMapData(userData!.currentQuid, interaction.guildId)).profiles, interaction.guildId);
						p.health -= healthPoints;
						p.injuries = profileData.injuries;
					},
				);
			}

			serverAttackInfo.idleHumans += 1;
		}
		embed.setFooter({ text: injuryText + changedCondition.statsUpdateText + '\n' + minusItemText + `\n${serverAttackInfo.idleHumans} humans remaining` });

		const levelUpEmbed = (await checkLevelUp(interaction, userData, quidData, profileData, serverData)).levelUpEmbed;

		botReply = await (async function(messageContent) { return newInteraction ? await update(newInteraction, messageContent) : await respond(interaction, messageContent, true); })({
			embeds: [
				...embedArray,
				embed,
				...(changedCondition.injuryUpdateEmbed ? [changedCondition.injuryUpdateEmbed] : []),
				...(levelUpEmbed ? [levelUpEmbed] : []),
			],
			components: [fightComponents],
		}).catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
			return botReply;
		});

		await isPassedOut(interaction, userData, quidData, profileData, true);

		await restAdvice(interaction, userData, profileData);
		await drinkAdvice(interaction, userData, profileData);
		await eatAdvice(interaction, userData, profileData);

		return botReply;
	}

	serverAttackInfo.ongoingFights -= 1;

	if (serverAttackInfo.idleHumans <= 0 && serverAttackInfo.ongoingFights <= 0) {

		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(default_color)
				.setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined })
				.setTitle('The attack is over!')
				.setDescription('*The packmates howl, dance and cheer as the humans run back into the woods. The battle wasn\'t easy, but they were victorious nonetheless.*')],
		}, false)
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		if (serverAttackInfo.endingTimeout) { clearTimeout(serverAttackInfo.endingTimeout); }
		serverMap.delete(interaction.guild.id);

		await serverModel.findOneAndUpdate(
			s => s.serverId === serverData.serverId,
			(s) => s.nextPossibleAttack = Date.now() + 86_400_000, // 24 hours
		);
	}
	else if (serverAttackInfo.endingTimeout == null && serverAttackInfo.ongoingFights <= 0) {

		remainingHumans(interaction, botReply, serverAttackInfo);
	}
}

function getFightComponents(
	roundNumber: 0 | 1 | 2,
): ActionRowBuilder<ButtonBuilder> {

	return new ActionRowBuilder<ButtonBuilder>()
		.setComponents([
			new ButtonBuilder()
				.setCustomId(`attack_attack_${roundNumber}`)
				.setLabel('Attack')
				.setEmoji('⏫')
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId(`attack_defend_${roundNumber}`)
				.setLabel('Defend')
				.setEmoji('⏺️')
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId(`attack_dodge_${roundNumber}`)
				.setLabel('Dodge')
				.setEmoji('↪️')
				.setStyle(ButtonStyle.Secondary),
		].sort(() => Math.random() - 0.5));
}

/**
 * Starts a timeout of 60 seconds after which an attack starts.
 * @param {import('discord.js').Message} message
 * @param {number} humanCount
 * @returns {void}
 */
export function startAttack(
	interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>,
	humanCount: number,
): void {

	serverMap.set(interaction.guildId, { startsTimestamp: Date.now() + 120_000, idleHumans: humanCount, endingTimeout: null, ongoingFights: 0 });
	setTimeout(async function() {

		const serverAttackInfo = serverMap.get(interaction.guildId);
		if (!serverAttackInfo) { return; }

		const botReply = await respond(interaction, {
			content: serverActiveUsersMap.get(interaction.guildId)?.map(user => `<@!${user}>`).join(' '),
			embeds: [new EmbedBuilder()
				.setColor(/** @type {`#${string}`} */(default_color))
				.setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined })
				.setDescription(`*The packmates get ready as ${serverAttackInfo.idleHumans} humans run over the borders. Now it is up to them to defend their land.*`)
				.setFooter({ text: 'You have 5 minutes to defeat all the humans. Type \'rp attack\' to attack one.' })],
		}, false)
			.catch((error) => { throw new Error(error); });

		serverAttackInfo.startsTimestamp = null;
		serverAttackInfo.endingTimeout = setTimeout(async function() {

			const serverAttackInfo = serverMap.get(interaction.guildId);
			if (!serverAttackInfo) { return; }
			serverAttackInfo.endingTimeout = null;
			if (serverAttackInfo.ongoingFights <= 0) {

				remainingHumans(interaction, botReply, serverAttackInfo);
			}
		}, 300_000);
	}, 120_000);
}

/**
 * Checks if there is an attack that is going to start soon or currently running, and returns the appropriate string.
 */
export function remindOfAttack(
	guildId: string,
): string | null {

	const serverAttackInfo = serverMap.get(guildId);
	if (serverAttackInfo && serverAttackInfo.startsTimestamp !== null) {

		return `Humans will attack in ${Math.floor((serverAttackInfo.startsTimestamp - Date.now()) / 1000)} seconds!`;
	}
	else if (serverAttackInfo && serverAttackInfo.startsTimestamp == null) {

		return 'Humans are attacking the pack! Type `/attack` to attack.';
	}

	return null;
}

/**
 * Checks if any humans are undefeated and removes items for each that is left.
 */
async function remainingHumans(
	interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>,
	botReply: Message,
	serverAttackInfo: serverMapInfo,
): Promise<void> {

	const embed = new EmbedBuilder()
		.setColor(default_color)
		.setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined })
		.setTitle('The attack is over!')
		.setDescription(`*Before anyone could stop them, the last ${serverAttackInfo.idleHumans	} humans run into the food den, take whatever they can grab and run away. The battle wasn't easy, but it is over at last.*`);

	const serverData = await serverModel.findOne(s => s.serverId === interaction.guildId);

	let footerText = '';
	const inventory_ = widenValues(serverData.inventory);
	while (serverAttackInfo.idleHumans > 0) {

		const { itemType, itemName } = getHighestItem(inventory_);

		if (itemType && itemName) {

			const minusAmount = Math.ceil(inventory_[itemType][itemName] / 10);
			footerText += `\n-${minusAmount} ${itemName} for ${interaction.guild.name}`;
			inventory_[itemType][itemName] -= minusAmount;
		}

		serverAttackInfo.idleHumans -= 1;
	}
	if (footerText.length > 0) { embed.setFooter({ text: footerText }); }

	await serverModel.findOneAndUpdate(
		s => s.serverId === serverData.serverId,
		(s) => {
			s.inventory = inventory_,
			s.nextPossibleAttack = Date.now() + 86_400_000; // 24 hours
		},
	);

	await botReply.channel
		.send({ embeds: [embed] })
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});

	serverMap.delete(interaction.guild.id);
}


/**
 * Finds whichever item there is most of, and returns its type and name.
 */
export function getHighestItem(
	inventoryObject: Inventory,
) {

	let itemType: Exclude<keyof Inventory, 'specialPlants'> | null = null;
	let itemName: Exclude<KeyOfUnion<ValueOf<Inventory>>, SpecialPlantNames> | null = null;
	const itemAmount = 0;

	const inventory_ = widenValues(inventoryObject);
	for (const itype of unsafeKeys(inventory_)) {

		if (itype === 'specialPlants') { continue; }
		for (const item of unsafeKeys(inventory_[itype])) {

			if (keyInObject(inventoryObject['specialPlants'], item)) { continue; }
			if (inventory_[itype][item] > itemAmount) {
				itemType = itype;
				itemName = item;
			}
		}
	}

	return { itemType, itemName };
}