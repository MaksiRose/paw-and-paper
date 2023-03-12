import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import DiscordUser from '../../models/discordUser';
import Quid from '../../models/quid';
import QuidToServer from '../../models/quidToServer';
import User from '../../models/user';
import UserToServer from '../../models/userToServer';
import { RankType } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid } from '../../utils/checkValidity';
import { getArrayElement, respond } from '../../utils/helperFunctions';
import { sendStoreMessage } from './store';
const { error_color } = require('../../../config.json');

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('stats')
		.setDescription('Quick view of your quids condition.')
		.addUserOption(option =>
			option.setName('user')
				.setDescription('A user that you want to look up the stats of.')
				.setRequired(false))
		.setDMPermission(false)
		.toJSON(),
	category: 'page3',
	position: 0,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer, discordUser, server }) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (!isInGuild(interaction) || !server) { return; } // This is always a reply

		const mentionedUser = interaction.options.getUser('user');

		discordUser = (!mentionedUser || mentionedUser.id === interaction.user.id) ? discordUser : await DiscordUser.findByPk(interaction.user.id, {
			include: [{ model: User, as: 'user' }],
		}) ?? undefined;

		const isYourself = (user?.id === discordUser?.user.id);
		user = discordUser?.user;

		userToServer = isYourself ? userToServer : (user && server)
			? (await UserToServer.findOne({
				where: { userId: user.id, serverId: server.id },
				include: [{ model: Quid, as: 'activeQuid' }],
			})) ?? undefined
			: undefined;

		quid = isYourself ? quid : (user && !server)
			? (user.lastGlobalActiveQuidId ? ((await Quid.findByPk(user.lastGlobalActiveQuidId)) ?? undefined) : undefined)
			: (userToServer?.activeQuid ?? undefined);

		quidToServer = isYourself ? quidToServer : (quid && interaction.inGuild())
			? (await QuidToServer.findOne({
				where: { quidId: quid.id, serverId: interaction.guildId },
			})) ?? undefined
			: undefined;


		if (mentionedUser) {

			if (!user || !discordUser) {

				// This is always a reply
				await respond(interaction, {
					embeds: [new EmbedBuilder()
						.setColor(error_color)
						.setTitle('There is nothing to show here :('),
					],
					ephemeral: true,
				});
				return;
			}
			else if (!hasNameAndSpecies(quid)) {

				// This is always a reply
				await respond(interaction, {
					embeds: [new EmbedBuilder()
						.setColor(error_color)
						.setTitle('The selected quid has no profile :('),
					],
					ephemeral: true,
				});
				return;
			}
		}
		else if (!hasNameAndSpecies(quid, { interaction, hasQuids: false })) { return; } // This is always a reply

		if (!quidToServer) { throw new TypeError('quidToServer is undefined'); }
		await sendStatsMessage(interaction, quid, quidToServer, interaction.user.id, isYourself);
	},
	async sendMessageComponentResponse(interaction, { user, quid, userToServer, quidToServer, server }) {

		if (!interaction.isButton()) { return; }
		/* This ensures that the user is in a guild and has a completed account. */
		if (server === null) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction)) { return; } // This is always a reply

		if (interaction.customId.includes('refresh')) {

			const quidId = getArrayElement(interaction.customId.split('_'), 2);
			const creatorUserId = getArrayElement(interaction.customId.split('_'), 3).replace('@', '');

			quid = await Quid.findByPk(quidId, { rejectOnEmpty: true });
			const isYourself = (quid.userId === creatorUserId);

			quidToServer = await QuidToServer.findOne({
				where: { quidId: quid.id, serverId: interaction.guildId },
				rejectOnEmpty: true,
			});

			await sendStatsMessage(interaction, quid, quidToServer, creatorUserId, isYourself);
			return;
		}

		if (interaction.customId.includes('store')) {

			if (!server) { throw new TypeError('server is undefined'); }
			if (!isInGuild(interaction) || !hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (user !== undefined && (await Quid.count({ where: { userId: user.id } })) > 0) })) { return; } // This is always a reply
			if (!user) { throw new TypeError('user is undefined'); }
			if (!userToServer) { throw new TypeError('userToServer is undefined'); }
			if (!quidToServer) { throw new TypeError('quidToServer is undefined'); }

			const restEmbed = await isInvalid(interaction, user, userToServer, quid, quidToServer);
			if (restEmbed === false) { return; }

			await sendStoreMessage(interaction, user, quid, userToServer, quidToServer, server, restEmbed);
		}
	},
};

async function sendStatsMessage(
	interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>,
	quid: Quid,
	quidToServer: QuidToServer,
	creatorUserId: string,
	isYourself: boolean,
): Promise<void> {

	const components = new ActionRowBuilder<ButtonBuilder>()
		.setComponents([new ButtonBuilder()
			.setCustomId(`stats_refresh_${quid.id}_@${creatorUserId}`)
			.setEmoji('🔁')
			.setStyle(ButtonStyle.Secondary),
		new ButtonBuilder()
			.setCustomId(`stats_store_@${creatorUserId}`)
			.setLabel('Store items away')
			.setStyle(ButtonStyle.Secondary),
		]);

	if (quidToServer.inventory.length === 0 || !isYourself) {

		components.components.pop();
	}

	// "item" needs to be == and not === in order to catch the booleans as well
	let injuryText = '';

	const injuries: [string, number | boolean][] = [
		['wounds', quidToServer.injuries_wounds],
		['infections', quidToServer.injuries_infections],
		['cold', quidToServer.injuries_cold],
		['sprains', quidToServer.injuries_sprains],
		['poison', quidToServer.injuries_poison],
	];
	for (const [injuryKind, injuryAmount] of injuries) {

		if (injuryAmount > 0) {

			if (typeof injuryAmount === 'number') {

				injuryText += `, ${injuryAmount} ${(injuryAmount < 2) ? injuryKind.slice(0, -1) : injuryKind}`;
			}
			else {

				injuryText += `, ${injuryKind}: yes`;
			}
		}
	}

	const canRankUp = quidToServer.unlockedRanks > { [RankType.Youngling]: 0, [RankType.Apprentice]: 1, [RankType.Hunter]: 2, [RankType.Healer]: 2, [RankType.Elderly]: 3 }[quidToServer.rank];

	// This is a reply if the interaction is a ChatInputCommand, or an update to the message with the button if the refresh button was clicked
	await respond(interaction, {
		content: `🚩 Levels: \`${quidToServer.levels}\` - 🏷️ Rank: ${quidToServer.rank}\n` +
			`✨ XP: \`${quidToServer.experience}/${quidToServer.levels * 50}\` - 🗺️ Region: ${quidToServer.currentRegion}\n` +
			`❤️ HP: \`${quidToServer.health}/${quidToServer.maxHealth}\` - ⚡ Energy: \`${quidToServer.energy}/${quidToServer.maxEnergy}\`\n` +
			`🍗 Hunger: \`${quidToServer.hunger}/${quidToServer.maxHunger}\` - 🥤 Thirst: \`${quidToServer.thirst}/${quidToServer.maxThirst}\`` +
			(injuryText ? `\n🩹 Injuries/Illnesses: ${injuryText.slice(2)}` : injuryText) +
			(quidToServer.sapling_exists === false ? '' : `\n🌱 Ginkgo Sapling: ${quidToServer.sapling_waterCycles} days alive - ${quidToServer.sapling_health} health - Next watering <t:${quidToServer.sapling_nextWaterTimestamp || 0}:R>`) +
			(quidToServer.hasQuest ? `\n${quid.name} has one open quest!` : '') + (canRankUp ? `\n${quid.name} can rank up!` : ''),
		components: [components],
	}, 'update', interaction.isMessageComponent() ? interaction.message.id : undefined);
}