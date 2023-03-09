import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, InteractionReplyOptions, StringSelectMenuBuilder, SlashCommandBuilder, WebhookEditMessageOptions, ChatInputCommandInteraction, ButtonInteraction, GuildMember } from 'discord.js';
import { Op } from 'sequelize';
import { materialsInfo } from '../..';
import Den from '../../models/den';
import DiscordUser from '../../models/discordUser';
import DiscordUserToServer from '../../models/discordUserToServer';
import Quid from '../../models/quid';
import QuidToServer from '../../models/quidToServer';
import Server from '../../models/server';
import { MaterialNames } from '../../typings/data/general';
import { RankType } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { changeCondition } from '../../utils/changeCondition';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid, isPassedOut } from '../../utils/checkValidity';
import { saveCommandDisablingInfo, disableAllComponents } from '../../utils/componentDisabling';
import getInventoryElements from '../../utils/getInventoryElements';
import { getDisplayname, getDisplayspecies, pronoun } from '../../utils/getQuidInfo';
import { getArrayElement, keyInObject, respond } from '../../utils/helperFunctions';
import { checkLevelUp } from '../../utils/levelHandling';
import { missingPermissions } from '../../utils/permissionHandler';
import { getRandomNumber, pullFromWeightedTable } from '../../utils/randomizers';
import { remindOfAttack } from '../gameplay_primary/attack';

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('repair')
		.setDescription('Improve a den\'s functionality. Not available to Younglings. Less effective as Apprentice or Healer.')
		.addStringOption(option =>
			option.setName('den')
				.setDescription('The den that you want to repair')
				.addChoices({ name: 'sleeping dens', value: 'sleepingDens' }, { name: 'food den', value: 'foodDen' }, { name: 'medicine den', value: 'medicineDen' })
				.setRequired(false))
		.setDMPermission(false)
		.toJSON(),
	category: 'page3',
	position: 8,
	disablePreviousCommand: true,
	modifiesServerProfile: true,
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer, server }) => {

		if (await missingPermissions(interaction, [
			'ViewChannel', // Needed because of createCommandComponentDisabler
		]) === true) { return; }

		/* This ensures that the user is in a guild and has a completed account. */
		if (server === undefined) { throw new Error('serverData is null'); }
		if (!user) { throw new TypeError('user is undefined'); }
		if (!userToServer) { throw new TypeError('userToServer is undefined'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (await Quid.count({ where: { userId: user.id } })) > 0 })) { return; } // This is always a reply
		if (!quidToServer) { throw new TypeError('quidToServer is undefined'); }

		/* Checks if the profile is resting, on a cooldown or passed out. */
		const restEmbed = await isInvalid(interaction, user, userToServer, quid, quidToServer);
		if (restEmbed === false) { return; }

		const messageContent = remindOfAttack(interaction.guildId);

		if (quidToServer.rank === RankType.Youngling) {

			// This is always a reply
			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setDescription(`*A hunter rushes to stop the ${quidToServer.rank}.*\n"${quid.name}, you are not trained to repair dens, it is very dangerous! You should be playing on the prairie instead."\n*${quid.name} lowers ${pronoun(quid, 2)} head and leaves in shame.*`)],
			});
			return;
		}

		if (server.inventory.filter(i => keyInObject(materialsInfo, i)).length <= 0) {

			// This is always a reply
			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setDescription(`*${quid.name} goes to look if any dens need to be repaired. But it looks like the pack has nothing that can be used to repair dens in the first place. Looks like the ${getDisplayspecies(quid)} needs to go out and find materials first!*`)
					.setFooter({ text: 'Materials can be found through scavenging and adventuring.' })],
			});
			return;
		}

		const chosenDen = interaction.options.getString('den');

		// This is always a reply
		const botReply = await respond(interaction, (chosenDen !== 'sleepingDenId' && chosenDen !== 'medicineDenId' && chosenDen !== 'foodDenId') ? {
			content: messageContent,
			embeds: [...restEmbed, new EmbedBuilder()
				.setColor(quid.color)
				.setAuthor({
					name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
					iconURL: quid.avatarURL,
				})
				.setDescription(`*${quid.name} roams around the pack, looking if any dens need to be repaired.*`)],
			components: [getDenButtons(user.id)],
			fetchReply: true,
		} : await getMaterials(interaction, quid, server, chosenDen, { serverId: interaction.guildId, userToServer, quidToServer, user }, restEmbed, messageContent));

		saveCommandDisablingInfo(userToServer, interaction, interaction.channelId, botReply.id);
	},
	async sendMessageComponentResponse(interaction, { user, quid, userToServer, quidToServer, server }) {

		/* This ensures that the user is in a guild and has a completed account. */
		if (server === undefined) { throw new Error('serverData is null'); }
		if (!user) { throw new TypeError('user is undefined'); }
		if (!userToServer) { throw new TypeError('userToServer is undefined'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (await Quid.count({ where: { userId: user.id } })) > 0 })) { return; } // This is always a reply
		if (!quidToServer) { throw new TypeError('quidToServer is undefined'); }

		if (interaction.isButton()) {

			const chosenDen = getArrayElement(interaction.customId.split('_'), 1);
			if (chosenDen !== 'sleepingDenId' && chosenDen !== 'medicineDenId' && chosenDen !== 'foodDenId') { throw new Error('chosenDen is not a den'); }

			// This is always an update to the message with the button
			await respond(interaction, await getMaterials(interaction, quid, server, chosenDen, { serverId: interaction.guildId, userToServer, quidToServer, user }, [], ''), 'update', interaction.message.id);
			return;
		}

		if (interaction.isStringSelectMenu()) {

			const chosenDenId = getArrayElement(interaction.customId.split('_'), 2);
			if (chosenDenId !== 'sleepingDenId' && chosenDenId !== 'medicineDenId' && chosenDenId !== 'foodDenId') { throw new Error('chosenDen is not a den'); }

			const chosenItem = getArrayElement(interaction.values, 0) as MaterialNames;

			const repairKind = materialsInfo[chosenItem].reinforcesStructure ? 'structure' : materialsInfo[chosenItem].improvesBedding ? 'bedding' : materialsInfo[chosenItem].thickensWalls ? 'thickness' : materialsInfo[chosenItem].removesOverhang ? 'evenness' : undefined;
			if (repairKind === undefined) { throw new TypeError('repairKind is undefined'); }

			const chosenDen = await Den.findByPk(server[chosenDenId], { rejectOnEmpty: true });
			const repairAmount = Math.min(addMaterialPoints(), 100 - chosenDen[repairKind]);

			/** True when the repairAmount is bigger than zero. If the user isn't of  rank Hunter or Elderly, a weighted table decided whether they are successful. */
			const isSuccessful = repairAmount > 0 && !isUnlucky(quidToServer);

			const itemIndex = server.inventory.findIndex(i => i === chosenItem);
			if (itemIndex < 0) { throw new Error('chosenItem does not exist in server.inventory'); }

			if (isSuccessful) { await chosenDen.update({ [repairKind]: chosenDen[repairKind] + repairAmount }); }
			await server.update({ inventory: server.inventory.filter((_, idx) => idx !== itemIndex) });

			const experiencePoints = isSuccessful === false ? 0 : getRandomNumber(5, quidToServer.levels + 8);
			const changedCondition = await changeCondition(quidToServer, quid, experiencePoints);

			const discordUsers = await DiscordUser.findAll({ where: { userId: user.id } });
			const discordUserToServer = await DiscordUserToServer.findAll({
				where: {
					serverId: interaction.guildId,
					isMember: true,
					discordUserId: { [Op.in]: discordUsers.map(du => du.id) },
				},
			});

			const members = (await Promise.all(discordUserToServer
				.map(async (duts) => (await interaction.guild.members.fetch(duts.discordUserId).catch(() => {
					duts.update({ isMember: false });
					return null;
				}))))).filter(function(v): v is GuildMember { return v !== null; });

			const levelUpEmbed = await checkLevelUp(interaction, quid, quidToServer, members);

			const denName = chosenDenId.split(/(?=[A-Z])/).join(' ').toLowerCase();

			// This is always an update to the message with the select menu
			await respond(interaction, {
				embeds: [
					new EmbedBuilder()
						.setColor(quid.color)
						.setAuthor({
							name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
							iconURL: quid.avatarURL,
						})
						.setDescription(`*${quid.name} takes a ${chosenItem} and tries to ${repairKind === 'structure' ? 'tuck it into parts of the walls and ceiling that look less stable.' : repairKind === 'bedding' ? 'spread it over parts of the floor that look harsh and rocky.' : repairKind === 'thickness' ? 'cover parts of the walls that look a little thin with it.' : 'drag it over parts of the walls with bumps and material sticking out.'} ` + (isSuccessful ? `Immediately you can see the ${repairKind} of the den improving. What a success!*` : `After a few attempts, the material breaks into little pieces, rendering it useless. Looks like the ${getDisplayspecies(quid)} has to try again...*`))
						.setFooter({ text: `${changedCondition.statsUpdateText}\n\n-1 ${chosenItem} for ${interaction.guild.name}\n${isSuccessful ? `+${repairAmount}% ${repairKind} for ${denName} (${chosenDen[repairKind]}%  total)` : ''}` }),
					...changedCondition.injuryUpdateEmbed,
					...levelUpEmbed,
				],
				components: disableAllComponents(interaction.message.components),
			}, 'update', interaction.message.id);

			await isPassedOut(interaction, user, userToServer, quid, quidToServer, true);

			await restAdvice(interaction, user, quidToServer);
			await drinkAdvice(interaction, user, quidToServer);
			await eatAdvice(interaction, user, quidToServer);
		}
	},
};


function getDenButtons(
	userId: string,
) {
	return new ActionRowBuilder<ButtonBuilder>()
		.addComponents([new ButtonBuilder()
			.setCustomId(`repair_sleepingDenId_@${userId}`)
			.setLabel('Sleeping Dens')
			.setStyle(ButtonStyle.Secondary),
		new ButtonBuilder()
			.setCustomId(`repair_foodDenId_@${userId}`)
			.setLabel('Food Den')
			.setStyle(ButtonStyle.Secondary),
		new ButtonBuilder()
			.setCustomId(`repair_medicineDenId_@${userId}`)
			.setLabel('Medicine Den')
			.setStyle(ButtonStyle.Secondary)]);
}

/**
 * Displays the condition of the currently chosen den, as well as a list of the packs materials.
 */
async function getMaterials(
	interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>,
	quid: Quid,
	server: Server,
	chosenDenType: 'sleepingDenId' | 'medicineDenId' | 'foodDenId',
	displaynameOptions: Parameters<typeof getDisplayname>[1],
	restEmbed: EmbedBuilder[],
	messageContent: string,
): Promise<Omit<InteractionReplyOptions & WebhookEditMessageOptions, 'flags'>> {

	const { selectMenuOptions, embedDescription: description } = getInventoryElements(server.inventory, 4);
	const chosenDen = await Den.findByPk(server[chosenDenType], { rejectOnEmpty: true });

	return {
		content: messageContent,
		embeds: [
			...restEmbed,
			new EmbedBuilder()
				.setColor(quid.color)
				.setAuthor({
					name: await getDisplayname(quid, displaynameOptions),
					iconURL: quid.avatarURL,
				})
				.setDescription(`*${quid.name} patrols around the den, looking for anything that has to be repaired. The condition isn't perfect, and reinforcing it would definitely improve its quality. But what would be the best way?*`)
				.setFooter({ text: `Structure: ${chosenDen.structure}%\nBedding: ${chosenDen.bedding}%\nThickness: ${chosenDen.thickness}%\nEvenness: ${chosenDen.evenness}%` }),
			new EmbedBuilder()
				.setColor(quid.color)
				.setTitle(`Inventory of ${interaction.guild.name} - Materials`)
				.setDescription(description || null)
				.setFooter({ text: 'Choose one of the materials above to repair the den with it!' }),
		],
		components: [
			getDenButtons(quid.userId),
			...selectMenuOptions.length > 0
				? [new ActionRowBuilder<StringSelectMenuBuilder>()
					.setComponents(new StringSelectMenuBuilder()
						.setCustomId(`repair_options_${chosenDen}_@${quid.userId}`)
						.setPlaceholder('Select an item to repair the den with')
						.addOptions(selectMenuOptions))]
				: [],
		],
	};
}

export function addMaterialPoints() { return getRandomNumber(5, 6); }

export function isUnlucky(
	quidToServer: QuidToServer,
): boolean { return quidToServer.rank !== RankType.Hunter && quidToServer.rank !== RankType.Elderly && pullFromWeightedTable({ 0: quidToServer.rank === RankType.Healer ? 90 : 40, 1: 60 + quidToServer.sapling_waterCycles }) === 0; }