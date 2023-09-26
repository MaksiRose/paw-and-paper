import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, Message, AnySelectMenuInteraction, SlashCommandBuilder, InteractionResponse } from 'discord.js';
import { serverActiveUsersMap } from '../../events/interactionCreate';
import Quid from '../../models/quid';
import QuidToServer from '../../models/quidToServer';
import Server from '../../models/server';
import User from '../../models/user';
import UserToServer from '../../models/userToServer';
import { RankType } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { coloredButtonsAdvice, drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { changeCondition } from '../../utils/changeCondition';
import { updateAndGetMembers } from '../../utils/checkRoleRequirements';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid, isPassedOut } from '../../utils/checkValidity';
import { constructCustomId, deconstructCustomId } from '../../utils/customId';
import { createFightGame } from '../../utils/gameBuilder';
import { getDisplayname, pronounAndPlural, pronoun, getDisplayspecies } from '../../utils/getQuidInfo';
import { deepCopy, getMessageId, now, respond, sendErrorMessage, setCooldown } from '../../utils/helperFunctions';
import { checkLevelUp } from '../../utils/levelHandling';
import { missingPermissions } from '../../utils/permissionHandler';
import { getRandomNumber, pullFromWeightedTable } from '../../utils/randomizers';
const { default_color } = require('../../../config.json');

type serverMapInfo = { startsTimestamp: number | null, idleHumans: number, endingTimeout: NodeJS.Timeout | null, ongoingFights: number, stealInterval: NodeJS.Timer | null }
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
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer, server }) => {

		await executeAttacking(interaction, user, quid, userToServer, quidToServer, server);
	},
	async sendMessageComponentResponse(interaction, { user, quid, userToServer, quidToServer, server }) {

		const customId = deconstructCustomId<CustomIdArgs>(interaction.customId);
		if (interaction.isButton() && customId?.args[0] === 'new') {

			await executeAttacking(interaction, user, quid, userToServer, quidToServer, server);
		}
	},
};


async function executeAttacking(
	interaction: ChatInputCommandInteraction | ButtonInteraction,
	user: User | undefined,
	quid: Quid<true> | Quid<false> | undefined,
	userToServer: UserToServer | undefined,
	quidToServer: QuidToServer | undefined,
	server: Server | undefined,
): Promise<void> {

	if (await missingPermissions(interaction, [
		'ViewChannel', interaction.channel?.isThread() ? 'SendMessagesInThreads' : 'SendMessages', 'EmbedLinks', // Needed for channel.send call in remainingHumans
	]) === true) { return; }

	/* This ensures that the user is in a guild and has a completed account. */
	if (server === undefined) { throw new Error('serverData is null'); }
	if (!isInGuild(interaction) || !hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (user !== undefined && (await Quid.count({ where: { userId: user.id } })) > 0) })) { return; } // This is always a reply
	if (!user) { throw new TypeError('user is undefined'); }
	if (!userToServer) { throw new TypeError('userToServer is undefined'); }
	if (!quidToServer) { throw new TypeError('quidToServer is undefined'); }

	/* Checks if the profile is resting, on a cooldown or passed out. */
	const restEmbed = await isInvalid(interaction, user, userToServer, quid, quidToServer);
	if (restEmbed === false) { return; }

	const serverAttackInfo = serverMap.get(interaction.guild.id);
	if (!serverAttackInfo || serverAttackInfo.startsTimestamp !== null) {

		// This is always a reply
		await respond(interaction, {
			embeds: [
				...restEmbed,
				new EmbedBuilder()
					.setColor(quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setDescription(`*${quid.name} is ready to attack any intruder. But no matter how far ${pronounAndPlural(quid, 0, 'look')}, ${pronoun(quid, 0)} can't see anyone. It seems that the pack is not under attack at the moment.*`),
			],
		});
		return;
	}

	if (serverAttackInfo.idleHumans <= 0) {

		// This is always a reply
		await respond(interaction, {
			embeds: [
				...restEmbed,
				new EmbedBuilder()
					.setColor(quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setDescription(`*${quid.name} looks around, searching for a human to attack. It looks like everyone is already being attacked by other pack members. The ${getDisplayspecies(quid)} better not interfere before ${pronounAndPlural(quid, 0, 'hurt')} ${pronoun(quid, 2)} friends.*`),
			],
		});
		return;
	}

	await setCooldown(userToServer, true);
	serverAttackInfo.idleHumans -= 1;
	serverAttackInfo.ongoingFights += 1;

	const experiencePoints = quidToServer.rank === RankType.Youngling ? 0 : getRandomNumber(5, quidToServer.levels + 8);
	const changedCondition = await changeCondition(quidToServer, quid, experiencePoints);

	const embed = new EmbedBuilder()
		.setColor(quid.color)
		.setAuthor({
			name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
			iconURL: quid.avatarURL,
		});

	let totalCycles: 0 | 1 | 2 = 0;
	let winLoseRatio = 0;
	let botReply: Message | InteractionResponse;

	botReply = await interactionCollector(interaction, user, quid, userToServer, quidToServer, server, serverAttackInfo, restEmbed);

	async function interactionCollector(
		interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>,
		user: User,
		quid: Quid<true>,
		userToServer: UserToServer,
		quidToServer: QuidToServer,
		server: Server,
		serverAttackInfo: serverMapInfo,
		restEmbed: EmbedBuilder[],
		newInteraction?: ButtonInteraction | AnySelectMenuInteraction,
		previousFightComponents?: ActionRowBuilder<ButtonBuilder>,
		lastRoundCycleIndex?: number,
	): Promise<Message | InteractionResponse> {

		const fightGame = createFightGame(totalCycles, lastRoundCycleIndex);

		if (fightGame.cycleKind === '_attack') {

			embed.setDescription(`⏫ *The human gets ready to attack. ${quid.name} must think quickly about how ${pronounAndPlural(quid, 0, 'want')} to react.*`);
			embed.setFooter({ text: 'Click the button that wins against your opponent\'s move (⏫ Attack).' });
		}
		else if (fightGame.cycleKind === 'dodge') {

			embed.setDescription(`↪️ *Looks like the human is preparing a maneuver for ${quid.name}'s next move. The ${getDisplayspecies(quid)} must think quickly about how ${pronounAndPlural(quid, 0, 'want')} to react.*`);
			embed.setFooter({ text: 'Click the button that wins against your opponent\'s move (↪️ Dodge).' });
		}
		else if (fightGame.cycleKind === 'defend') {

			embed.setDescription(`⏺️ *The human gets into position to oppose an attack. ${quid.name} must think quickly about how ${pronounAndPlural(quid, 0, 'want')} to react.*`);
			embed.setFooter({ text: 'Click the button that wins against your opponent\'s move (⏺️ Defend).' });
		}
		else { throw new Error('cycleKind is not attack, dodge or defend'); }
		embed.setFooter({ text: 'You will be presented three buttons: Attack, dodge and defend. Your opponent chooses one of them, and you have to choose which button is the correct response.' });

		// This is a reply for the first time this is called (aka the original interaction hasn't been replied to), an editReply if an awaitMessageComponent event timed out (For this reason, an editMessageId is provided even when newInteraction is undefined), and an update to the message with the button every other time
		botReply = await respond(newInteraction ?? interaction, {
			embeds: [...restEmbed, embed],
			components: [...previousFightComponents ? [previousFightComponents] : [], fightGame.fightComponent],
		}, newInteraction !== undefined ? 'update' : 'reply', newInteraction?.message.id ?? (botReply ? getMessageId(botReply) : undefined));

		/* Here we are making sure that the correct button will be blue by default. If the player choses the correct button, this will be overwritten. */
		fightGame.fightComponent = fightGame.correctButtonOverwrite();

		newInteraction = await botReply
			.awaitMessageComponent({
				componentType: ComponentType.Button,
				filter: i => i.user.id === interaction.user.id,
				time: quidToServer.rank === RankType.Elderly ? 3_000 : quidToServer.rank === RankType.Hunter || quidToServer.rank === RankType.Healer ? 4_000 : quidToServer.rank === RankType.Apprentice ? 5_000 : 10_000,
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

			botReply = await interactionCollector(interaction, user, quid, userToServer, quidToServer, server, serverAttackInfo, restEmbed, newInteraction, fightGame.fightComponent, fightGame.thisRoundCycleIndex);
			return botReply;
		}

		await setCooldown(userToServer, false);

		let minusItemText = '';
		let injuryText = '';
		if (winLoseRatio < 0) { winLoseRatio = -1; }
		else { winLoseRatio = pullFromWeightedTable({ 0: 5 - winLoseRatio, 1: 5, 2: winLoseRatio }); }

		if (winLoseRatio === 2) {

			embed.setDescription(`*For a moment it looks like the human might get the upper hand before ${quid.name} jumps on them with a big hop. The human falls to the ground and crawls away with a terrified look on their face. It looks like they're not coming back.*`);
		}
		else {

			if (winLoseRatio < 1) {

				const newServer = { inventory: deepCopy(server.inventory) };
				minusItemText += removeByHighestItem(newServer, interaction.guild.name);
				await server.update({ inventory: newServer.inventory });
			}

			embed.setDescription(`*The battle between the human and ${quid.name} is intense. Both are putting up a good fight and it doesn't look like either of them can get the upper hand. The ${getDisplayspecies(quid)} tries to jump at them, but the human manages to dodge. ${winLoseRatio < 1 ? `Quickly they run in the direction of the food den. They escaped from ${pronoun(quid, 1)}!*` : 'Quickly they back off from the tricky situation.*'}`);

			if (winLoseRatio === -1) {

				const healthPoints = Math.min(quidToServer.health, getRandomNumber(5, 3));

				if (pullFromWeightedTable({ 0: 1, 1: 1 }) === 0) {

					quidToServer.injuries_wounds += 1;

					embed.setDescription(`*The battle between the human and ${quid.name} is intense. Both are putting up a good fight and it doesn't look like either of them can get the upper hand. The ${getDisplayspecies(quid)} tries to jump at them, but the human manages to dodge. Unfortunately, a rock is directly in ${quid.name}'s jump line. A sharp pain runs through ${pronoun(quid, 2)} hip. A red spot slowly spreads where ${pronoun(quid, 0)} hit the rock. Meanwhile, the human runs into the food den.*`);
					injuryText = `-${healthPoints} HP (from wound)\n`;
				}
				else {

					quidToServer.injuries_sprains += 1;

					embed.setDescription(`*The battle between the human and ${quid.name} is intense. Both are putting up a good fight and it doesn't look like either of them can get the upper hand. The ${getDisplayspecies(quid)} tries to jump at them, but the human manages to dodge. ${quid.name} is not prepared for the fall. A sharp pain runs through ${pronoun(quid, 2)} arm as it bends in the fall. Meanwhile, the human runs into the food den.*`);
					injuryText = `-${healthPoints} HP (from sprain)\n`;
				}

				await quidToServer.update({
					health: quidToServer.health - healthPoints,
					injuries_wounds: quidToServer.injuries_wounds,
					injuries_sprains: quidToServer.injuries_sprains,
				});
			}

			serverAttackInfo.idleHumans += 1;
		}
		embed.setFooter({ text: injuryText + changedCondition.statsUpdateText + '\n' + minusItemText + `\n${serverAttackInfo.idleHumans} humans remaining` });

		const members = await updateAndGetMembers(user.id, interaction.guild);
		const levelUpEmbed = await checkLevelUp(interaction, quid, quidToServer, members);

		// This is an editReply if the last awaitMessageComponent event timed out (For this reason, an editMessageId is always provided), else it is an update to the message with the button. newInteraction is undefined when every event timed out.
		botReply = await respond(newInteraction ?? interaction, {
			embeds: [
				...restEmbed,
				embed,
				...changedCondition.injuryUpdateEmbed,
				...levelUpEmbed,
			],
			components: [fightGame.fightComponent,
				new ActionRowBuilder<ButtonBuilder>()
					.setComponents(new ButtonBuilder()
						.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, user.id, ['new']))
						.setLabel('Attack again')
						.setStyle(ButtonStyle.Primary))],
		}, 'update', newInteraction?.message.id ?? getMessageId(botReply));

		await isPassedOut(interaction, user, userToServer, quid, quidToServer, true);

		await coloredButtonsAdvice(interaction, user);
		await restAdvice(interaction, user, quidToServer);
		await drinkAdvice(interaction, user, quidToServer);
		await eatAdvice(interaction, user, quidToServer);

		return botReply;
	}

	serverAttackInfo.ongoingFights -= 1;

	if (serverAttackInfo.idleHumans <= 0 && serverAttackInfo.ongoingFights <= 0) {

		// This is always a followUp
		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(default_color)
				.setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined })
				.setTitle('The attack is over!')
				.setDescription('*The packmates howl, dance and cheer as the humans run back into the woods. The battle wasn\'t easy, but they were victorious nonetheless.*')],
		});

		if (serverAttackInfo.endingTimeout) { clearTimeout(serverAttackInfo.endingTimeout); }
		serverMap.delete(interaction.guild.id);

		await server.update({ nextPossibleAttackTimestamp: now() + 86_400 /* 24 hours */ });
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

	serverMap.set(interaction.guildId, { startsTimestamp: now() + 120, idleHumans: humanCount, endingTimeout: null, ongoingFights: 0, stealInterval: null });
	setTimeout(async function() {
		try {

			const serverAttackInfo = serverMap.get(interaction.guildId);
			if (!serverAttackInfo) { return; }

			// This is always a followUp
			const botReply = await respond(interaction, {
				content: serverActiveUsersMap.get(interaction.guildId)?.map(user => `<@!${user}>`).join(' '),
				embeds: [new EmbedBuilder()
					.setColor(/** @type {`#${string}`} */(default_color))
					.setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined })
					.setDescription(`*The packmates get ready as ${serverAttackInfo.idleHumans} humans run over the borders. Now it is up to them to defend their land.*`)
					.setFooter({ text: 'You have 5 minutes to defeat all the humans. Type \'/attack\' to attack one.' })],
			});

			serverAttackInfo.startsTimestamp = null;

			const interval = setInterval(async function() {
				try {
					const serverAttackInfo = serverMap.get(interaction.guildId);
					if (!serverAttackInfo) {

						clearInterval(interval);
						return;
					}
					if (serverAttackInfo.idleHumans <= 0) { return; }

					const embed = new EmbedBuilder()
						.setColor(default_color)
						.setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined })
						.setTitle('The humans are stealing items!')
						.setDescription(`*Before anyone could stop them, ${serverAttackInfo.idleHumans} humans run into the food den, and take whatever they can grab.*`);

					const server = await Server.findByPk(interaction.guildId, { rejectOnEmpty: true });

					let footerText = '';
					const newServer = { inventory: deepCopy(server.inventory) };
					for (let i = 0; i < serverAttackInfo.idleHumans; i++) {

						footerText += removeByHighestItem(newServer, interaction.guild.name);
					}
					if (footerText.length > 0) { embed.setFooter({ text: footerText }); }
					await server.update({ inventory: newServer.inventory });

					try {

						const fifteenMinutesInS = 900;
						if (Math.round(interaction.createdTimestamp / 1000) < now() - fifteenMinutesInS) { throw new Error('Interaction is older than 15 minutes'); }
						await respond(interaction, { embeds: [embed] });
					}
					catch {

						const channel = botReply instanceof Message ? botReply.channel : botReply.interaction.channel ?? (botReply.interaction.isRepliable() ? (await botReply.interaction.fetchReply()).channel : null);
						if (!channel) { throw new TypeError('channel is null'); }
						await channel.send({ embeds: [embed] });
					}
				}
				catch (error) {

					await sendErrorMessage(interaction, error)
						.catch(e => { console.error(e); });
				}
			}, 60_000);
			serverAttackInfo.stealInterval = interval;

			serverAttackInfo.endingTimeout = setTimeout(async function() {
				try {

					const serverAttackInfo = serverMap.get(interaction.guildId);
					if (!serverAttackInfo) { return; }

					serverAttackInfo.endingTimeout = null;
					if (serverAttackInfo.stealInterval) { clearInterval(serverAttackInfo.stealInterval); }

					if (serverAttackInfo.ongoingFights <= 0) { await remainingHumans(interaction, botReply, serverAttackInfo); }
				}
				catch (error) {

					await sendErrorMessage(interaction, error)
						.catch(e => { console.error(e); });
				}
			}, 300_500); // 500 ms delay to allow for the 5th stealInterval to play out first
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

		return `Humans will attack in ${serverAttackInfo.startsTimestamp - now()} seconds!`;
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
	botReply: Message | InteractionResponse,
	serverAttackInfo: serverMapInfo,
): Promise<void> {

	const embed = new EmbedBuilder()
		.setColor(default_color)
		.setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined })
		.setTitle('The attack is over!')
		.setDescription(`*Before anyone could stop them, the last ${serverAttackInfo.idleHumans	} humans run into the food den, take whatever they can grab and run away. The battle wasn't easy, but it is over at last.*`);

	const server = await Server.findByPk(interaction.guildId, { rejectOnEmpty: true });

	let footerText = '';
	const newServer = { inventory: deepCopy(server.inventory) };
	while (serverAttackInfo.idleHumans > 0) {

		footerText += removeByHighestItem(newServer, interaction.guild.name);
		serverAttackInfo.idleHumans -= 1;
	}
	if (footerText.length > 0) { embed.setFooter({ text: footerText }); }

	await server.update({ inventory: newServer.inventory, nextPossibleAttackTimestamp: now() + 86_400 /* 24 hours */ });

	serverMap.delete(interaction.guild.id);

	try {

		const fifteenMinutesInS = 900;
		if (Math.round(interaction.createdTimestamp / 1000) < now() - fifteenMinutesInS) { throw new Error('Interaction is older than 15 minutes'); }
		await respond(interaction, { embeds: [embed] });
	}
	catch {

		const channel = botReply instanceof Message ? botReply.channel : botReply.interaction.channel ?? (botReply.interaction.isRepliable() ? (await botReply.interaction.fetchReply()).channel : null);
		if (!channel) { throw new TypeError('channel is null'); }
		await channel.send({ embeds: [embed] });
	}
}


/**
 * Finds whichever item there is most of, and returns its type and name.
 */
function removeByHighestItem(
	server: { inventory: string[]; },
	name: string,
): string {

	const arr = server.inventory;
	if (arr.length <= 0) { return ''; }

	const obj: Record<string, number> = {};
	let maxStr: string = arr[0]!;
	let maxVal = 1;
	for (const v of arr) {

		obj[v] = ++obj[v] || 1;

		if (obj[v]! > maxVal) {

			maxStr = v;
			maxVal = obj[v]!;
		}
	}

	const minusAmount = Math.ceil(maxVal / 10);
	let foundCount = 0;
	server.inventory = server.inventory.filter((item) => {
		if (item === maxStr && foundCount < minusAmount) {
			foundCount++;
			return false;
		}
		return true;
	});

	return `\n-${minusAmount} ${maxStr} for ${name}`;
}