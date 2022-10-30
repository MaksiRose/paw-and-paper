import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, Message, SelectMenuInteraction, SlashCommandBuilder } from 'discord.js';
import { serverActiveUsersMap } from '../../events/interactionCreate';
import serverModel from '../../models/serverModel';
import { Inventory } from '../../typings/data/general';
import { ServerSchema } from '../../typings/data/server';
import { RankType, UserData } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { coloredButtonsAdvice, drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { changeCondition } from '../../utils/changeCondition';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid, isPassedOut } from '../../utils/checkValidity';
import { disableCommandComponent } from '../../utils/componentDisabling';
import { constructCustomId, deconstructCustomId } from '../../utils/customId';
import { createFightGame } from '../../utils/gameBuilder';
import { getMapData, getSmallerNumber, KeyOfUnion, respond, sendErrorMessage, setCooldown, unsafeKeys, update, ValueOf, widenValues } from '../../utils/helperFunctions';
import { checkLevelUp } from '../../utils/levelHandling';
import { missingPermissions } from '../../utils/permissionHandler';
import { getRandomNumber, pullFromWeightedTable } from '../../utils/randomizers';
const { default_color } = require('../../../config.json');

type serverMapInfo = { startsTimestamp: number | null, idleHumans: number, endingTimeout: NodeJS.Timeout | null, ongoingFights: number; }
const serverMap: Map<string, serverMapInfo > = new Map();

type CustomIdArgs = ['new'] | ['new', string]

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('attack')
		.setDescription('If humans are attacking the pack, you can fight back using this command.')
		.setDMPermission(false)
		.toJSON(),
	category: 'page2',
	position: 5,
	disablePreviousCommand: true,
	modifiesServerProfile: true,
	sendCommand: async (interaction, userData, serverData) => {

		await executeAttacking(interaction, userData, serverData);
	},
	async sendMessageComponentResponse(interaction, userData, serverData) {

		const customId = deconstructCustomId<CustomIdArgs>(interaction.customId);
		if (interaction.isButton() && customId?.args[0] === 'new') {

			await executeAttacking(interaction, userData, serverData);
		}
	},
};


export async function executeAttacking(
	interaction: ChatInputCommandInteraction | ButtonInteraction,
	userData: UserData<undefined, ''> | null,
	serverData: ServerSchema | null,
): Promise<void> {

	if (await missingPermissions(interaction, [
		'ViewChannel', interaction.channel?.isThread() ? 'SendMessagesInThreads' : 'SendMessages', 'EmbedLinks', // Needed for channel.send call in remainingHumans
	]) === true) { return; }

	/* This ensures that the user is in a guild and has a completed account. */
	if (serverData === null) { throw new Error('serverData is null'); }
	if (!isInGuild(interaction) || !hasNameAndSpecies(userData, interaction)) { return; }

	/* It's disabling all components if userData exists and the command is set to disable a previous command. */
	if (command.disablePreviousCommand) { await disableCommandComponent(userData); }

	/* Checks if the profile is resting, on a cooldown or passed out. */
	const restEmbed = await isInvalid(interaction, userData);
	if (restEmbed === false) { return; }

	const serverAttackInfo = serverMap.get(interaction.guild.id);
	if (!serverAttackInfo || serverAttackInfo.startsTimestamp !== null) {

		await respond(interaction, {
			embeds: [
				...restEmbed,
				new EmbedBuilder()
					.setColor(userData.quid.color)
					.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
					.setDescription(`*${userData.quid.name} is ready to attack any intruder. But no matter how far ${userData.quid.pronounAndPlural(0, 'look')}, ${userData.quid.pronoun(0)} can't see anyone. It seems that the pack is not under attack at the moment.*`),
			],
		}, true);
		return;
	}

	if (serverAttackInfo.idleHumans <= 0) {

		await respond(interaction, {
			embeds: [
				...restEmbed,
				new EmbedBuilder()
					.setColor(userData.quid.color)
					.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
					.setDescription(`*${userData.quid.name} looks around, searching for a human to attack. It looks like everyone is already being attacked by other pack members. The ${userData.quid.getDisplayspecies()} better not interfere before ${userData.quid.pronounAndPlural(0, 'hurt')} ${userData.quid.pronoun(2)} friends.*`),
			],
		}, true);
		return;
	}

	await setCooldown(userData, interaction.guildId, true);
	serverAttackInfo.idleHumans -= 1;
	serverAttackInfo.ongoingFights += 1;

	const experiencePoints = getRandomNumber(10, 11);
	const changedCondition = await changeCondition(userData, experiencePoints);

	const embed = new EmbedBuilder()
		.setColor(userData.quid.color)
		.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL });

	let totalCycles: 0 | 1 | 2 = 0;
	let winLoseRatio = 0;
	let botReply: Message;

	botReply = await interactionCollector(interaction, userData, serverData, serverAttackInfo, restEmbed);

	async function interactionCollector(
		interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>,
		userData: UserData<never, never>,
		serverData: ServerSchema,
		serverAttackInfo: serverMapInfo,
		restEmbed: EmbedBuilder[],
		newInteraction?: ButtonInteraction | SelectMenuInteraction,
		previousFightComponents?: ActionRowBuilder<ButtonBuilder>,
		lastRoundCycleIndex?: number,
	): Promise<Message> {

		const fightGame = createFightGame(totalCycles, lastRoundCycleIndex);

		if (fightGame.cycleKind === '_attack') {

			embed.setDescription(`⏫ *The human gets ready to attack. ${userData.quid.name} must think quickly about how ${userData.quid.pronounAndPlural(0, 'want')} to react.*`);
			embed.setFooter({ text: 'Click the button that wins against your opponent\'s move (⏫ Attack).' });
		}
		else if (fightGame.cycleKind === 'dodge') {

			embed.setDescription(`↪️ *Looks like the human is preparing a maneuver for ${userData.quid.name}'s next move. The ${userData.quid.getDisplayspecies()} must think quickly about how ${userData.quid.pronounAndPlural(0, 'want')} to react.*`);
			embed.setFooter({ text: 'Click the button that wins against your opponent\'s move (↪️ Dodge).' });
		}
		else if (fightGame.cycleKind === 'defend') {

			embed.setDescription(`⏺️ *The human gets into position to oppose an attack. ${userData.quid.name} must think quickly about how ${userData.quid.pronounAndPlural(0, 'want')} to react.*`);
			embed.setFooter({ text: 'Click the button that wins against your opponent\'s move (⏺️ Defend).' });
		}
		else { throw new Error('cycleKind is not attack, dodge or defend'); }
		embed.setFooter({ text: 'You will be presented three buttons: Attack, dodge and defend. Your opponent chooses one of them, and you have to choose which button is the correct response.' });

		botReply = await (async function(messageContent) { return newInteraction ? await update(newInteraction, messageContent) : await respond(interaction, messageContent, true); })({
			embeds: [...restEmbed, embed],
			components: [...previousFightComponents ? [previousFightComponents] : [], fightGame.fightComponent],
		});

		/* Here we are making sure that the correct button will be blue by default. If the player choses the correct button, this will be overwritten. */
		fightGame.fightComponent = fightGame.correctButtonOverwrite();

		newInteraction = await botReply
			.awaitMessageComponent({
				componentType: ComponentType.Button,
				filter: i => i.user.id === interaction.user.id,
				time: userData.quid.profile.rank === RankType.Elderly ? 3_000 : userData.quid.profile.rank === RankType.Hunter || userData.quid.profile.rank === RankType.Healer ? 4_000 : userData.quid.profile.rank === RankType.Apprentice ? 5_000 : 10_000,
			})
			.then(async i => {

				/* Here we make the button the player choses red, this will apply always except if the player choses the correct button, then this will be overwritten. */
				fightGame.fightComponent = fightGame.chosenWrongButtonOverwrite(i.customId);

				if ((i.customId.includes('_attack') && fightGame.cycleKind === 'dodge')
						|| (i.customId.includes('defend') && fightGame.cycleKind === '_attack')
						|| (i.customId.includes('dodge') && fightGame.cycleKind === 'defend')) {

					winLoseRatio -= 1;
				}
				else if ((i.customId.includes('_attack') && fightGame.cycleKind === 'defend')
						|| (i.customId.includes('defend') && fightGame.cycleKind === 'dodge')
						|| (i.customId.includes('dodge') && fightGame.cycleKind === '_attack')) {

					/* The button the player choses is overwritten to be green here, only because we are sure that they actually chose corectly. */
					fightGame.fightComponent = fightGame.chosenRightButtonOverwrite(i.customId);

					winLoseRatio += 1;
				}
				return i;
			})
			.catch(() => {

				winLoseRatio -= 1;
				return newInteraction;
			});

		fightGame.fightComponent.setComponents(fightGame.fightComponent.components.map(c => c.setDisabled(true)));

		totalCycles += 1;

		if (totalCycles < 5) {

			botReply = await interactionCollector(interaction, userData, serverData, serverAttackInfo, restEmbed, newInteraction, fightGame.fightComponent, fightGame.thisRoundCycleIndex);
			return botReply;
		}

		await setCooldown(userData, interaction.guildId, false);

		let minusItemText = '';
		let injuryText = '';
		if (winLoseRatio < 0) { winLoseRatio = 0; }
		winLoseRatio = pullFromWeightedTable({ 0: 5 - winLoseRatio, 1: 5, 2: winLoseRatio });

		if (winLoseRatio === 2) {

			embed.setDescription(`*For a moment it looks like the human might get the upper hand before ${userData.quid.name} jumps on them with a big hop. The human falls to the ground and crawls away with a terrified look on their face. It looks like they're not coming back.*`);
		}
		else {

			const inventory_ = widenValues(serverData.inventory);
			const { itemType, itemName } = getHighestItem(inventory_);
			if (itemType && itemName) {

				const minusAmount = Math.ceil(inventory_[itemType][itemName] / 10);
				minusItemText += `\n-${minusAmount} ${itemName} for ${interaction.guild.name}`;
				inventory_[itemType][itemName] -= minusAmount;
			}

			serverData = await serverModel.update(
				serverData,
				(s) => s.inventory = inventory_,
			);

			embed.setDescription(`*The battle between the human and ${userData.quid.name} is intense. Both are putting up a good fight and it doesn't look like either of them can get the upper hand. The ${userData.quid.getDisplayspecies()} tries to jump at them, but the human manages to dodge. Quickly they run in the direction of the food den. They escaped from ${userData.quid.pronoun(1)}!*`);

			if (winLoseRatio == 0) {

				const healthPoints = getSmallerNumber(userData.quid.profile.health, getRandomNumber(5, 3));

				if (pullFromWeightedTable({ 0: 1, 1: 1 }) === 0) {

					userData.quid.profile.injuries.wounds += 1;

					embed.setDescription(`*The battle between the human and ${userData.quid.name} is intense. Both are putting up a good fight and it doesn't look like either of them can get the upper hand. The ${userData.quid.getDisplayspecies()} tries to jump at them, but the human manages to dodge. Unfortunately, a rock is directly in ${userData.quid.name}'s jump line. A sharp pain runs through ${userData.quid.pronoun(2)} hip. A red spot slowly spreads where ${userData.quid.pronoun(0)} hit the rock. Meanwhile, the human runs into the food den.*`);
					injuryText = `-${healthPoints} HP (from wound)\n`;
				}
				else {

					userData.quid.profile.injuries.sprains += 1;

					embed.setDescription(`*The battle between the human and ${userData.quid.name} is intense. Both are putting up a good fight and it doesn't look like either of them can get the upper hand. The ${userData.quid.getDisplayspecies()} tries to jump at them, but the human manages to dodge. ${userData.quid.name} is not prepared for the fall. A sharp pain runs through ${userData.quid.pronoun(2)} arm as it bends in the fall. Meanwhile, the human runs into the food den.*`);
					injuryText = `-${healthPoints} HP (from sprain)\n`;
				}

				await userData.update(
					(u) => {
						const p = getMapData(getMapData(u.quids, userData.quid._id).profiles, interaction.guildId);
						p.health -= healthPoints;
						p.injuries = userData.quid.profile.injuries;
					},
				);
			}

			serverAttackInfo.idleHumans += 1;
		}
		embed.setFooter({ text: injuryText + changedCondition.statsUpdateText + '\n' + minusItemText + `\n${serverAttackInfo.idleHumans} humans remaining` });

		const levelUpEmbed = await checkLevelUp(interaction, userData, serverData);

		botReply = await (async function(messageContent) { return newInteraction ? await update(newInteraction, messageContent) : await respond(interaction, messageContent, true); })({
			embeds: [
				...restEmbed,
				embed,
				...changedCondition.injuryUpdateEmbed,
				...levelUpEmbed,
			],
			components: [fightGame.fightComponent,
				new ActionRowBuilder<ButtonBuilder>()
					.setComponents(new ButtonBuilder()
						.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData._id, ['new']))
						.setLabel('Attack again')
						.setStyle(ButtonStyle.Primary))],
		});

		await isPassedOut(interaction, userData, true);

		await coloredButtonsAdvice(interaction, userData);
		await restAdvice(interaction, userData);
		await drinkAdvice(interaction, userData);
		await eatAdvice(interaction, userData);

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
		}, false);

		if (serverAttackInfo.endingTimeout) { clearTimeout(serverAttackInfo.endingTimeout); }
		serverMap.delete(interaction.guild.id);

		serverData = await serverModel.update(
			serverData,
			(s) => s.nextPossibleAttack = Date.now() + 86_400_000, // 24 hours
		);
	}
	else if (serverAttackInfo.endingTimeout == null && serverAttackInfo.ongoingFights <= 0) {

		remainingHumans(interaction, botReply, serverAttackInfo);
	}
}

/**
 * Starts a timeout of 60 seconds after which an attack starts.
 * @param {import('discord.js').Message} message
 * @param {number} humanCount
 * @returns {void}
 */
export async function startAttack(
	interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>,
	humanCount: number,
): Promise<void> {

	if (await missingPermissions(interaction, [
		'ViewChannel', interaction.channel?.isThread() ? 'SendMessagesInThreads' : 'SendMessages', 'EmbedLinks', // Needed for channel.send call in remainingHumans
	]) === true) { return; }

	serverMap.set(interaction.guildId, { startsTimestamp: Date.now() + 120_000, idleHumans: humanCount, endingTimeout: null, ongoingFights: 0 });
	setTimeout(async function() {
		try {

			const serverAttackInfo = serverMap.get(interaction.guildId);
			if (!serverAttackInfo) { return; }

			const botReply = await respond(interaction, {
				content: serverActiveUsersMap.get(interaction.guildId)?.map(user => `<@!${user}>`).join(' '),
				embeds: [new EmbedBuilder()
					.setColor(/** @type {`#${string}`} */(default_color))
					.setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined })
					.setDescription(`*The packmates get ready as ${serverAttackInfo.idleHumans} humans run over the borders. Now it is up to them to defend their land.*`)
					.setFooter({ text: 'You have 5 minutes to defeat all the humans. Type \'/attack\' to attack one.' })],
			}, false);

			serverAttackInfo.startsTimestamp = null;
			serverAttackInfo.endingTimeout = setTimeout(async function() {
				try {

					const serverAttackInfo = serverMap.get(interaction.guildId);
					if (!serverAttackInfo) { return; }
					serverAttackInfo.endingTimeout = null;
					if (serverAttackInfo.ongoingFights <= 0) { await remainingHumans(interaction, botReply, serverAttackInfo); }
				}
				catch (error) {

					await sendErrorMessage(interaction, error)
						.catch(e => { console.error(e); });
				}
			}, 300_000);
		}
		catch (error) {

			await sendErrorMessage(interaction, error)
				.catch(e => { console.error(e); });
		}
	}, 120_000);
}

/**
 * Checks if there is an attack that is going to start soon or currently running, and returns the appropriate string.
 */
export function remindOfAttack(
	guildId: string,
): string {

	const serverAttackInfo = serverMap.get(guildId);
	if (serverAttackInfo && serverAttackInfo.startsTimestamp !== null) {

		return `Humans will attack in ${Math.floor((serverAttackInfo.startsTimestamp - Date.now()) / 1000)} seconds!`;
	}
	else if (serverAttackInfo && serverAttackInfo.startsTimestamp == null) {

		return 'Humans are attacking the pack! Type `/attack` to attack.';
	}

	return '';
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

	let serverData = await serverModel.findOne(s => s.serverId === interaction.guildId);

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

	serverData = await serverModel.update(
		serverData,
		(s) => {
			s.inventory = inventory_,
			s.nextPossibleAttack = Date.now() + 86_400_000; // 24 hours
		},
	);

	await botReply.channel.send({ embeds: [embed] });

	serverMap.delete(interaction.guild.id);
}


/**
 * Finds whichever item there is most of, and returns its type and name.
 */
export function getHighestItem(
	inventoryObject: Inventory,
) {

	let itemType: keyof Inventory| null = null;
	let itemName: KeyOfUnion<ValueOf<Inventory>> | null = null;
	let itemAmount = 0;

	const inventory_ = widenValues(inventoryObject);
	for (const itype of unsafeKeys(inventory_)) {

		for (const item of unsafeKeys(inventory_[itype])) {

			if (inventory_[itype][item] > itemAmount) {
				itemAmount = inventory_[itype][item];
				itemType = itype;
				itemName = item;
			}
		}
	}

	return { itemType, itemName };
}