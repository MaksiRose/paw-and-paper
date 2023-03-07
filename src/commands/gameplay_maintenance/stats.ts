import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { userModel, getUserData } from '../../oldModels/userModel';
import { RankType, UserData } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid } from '../../utils/checkValidity';
import { getArrayElement, getMapData, respond } from '../../utils/helperFunctions';
import { calculateInventorySize } from '../../utils/simulateItemUse';
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
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer }) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (!isInGuild(interaction)) { return; } // This is always a reply

		const mentionedUser = interaction.options.getUser('user');
		if (mentionedUser) {

			const _userData = (() => {
				try { return userModel.findOne(u => Object.keys(u.userIds).includes(mentionedUser.id)); }
				catch { return null; }
			})();
			if (!_userData) {

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

			userData = getUserData(_userData, interaction.guildId, getMapData(_quids, getMapData(_userData.servers, interaction.guildId).currentQuid ?? ''));
			if (!hasNameAndSpecies(userData)) {

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
		else if (!hasNameAndSpecies(userData, interaction)) { return; } // This is always a reply

		await sendStatsMessage(interaction, userData, interaction.user.id);
	},
	async sendMessageComponentResponse(interaction, { user, quid, userToServer, quidToServer, server }) {

		if (!interaction.isButton()) { return; }
		/* This ensures that the user is in a guild and has a completed account. */
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction)) { return; } // This is always a reply

		if (interaction.customId.includes('refresh')) {

			const quidId = getArrayElement(interaction.customId.split('_'), 2);
			const creatorUserId = getArrayElement(interaction.customId.split('_'), 3).replace('@', '');

			const _userData = await userModel.findOne(u => Object.keys(u.quids).includes(quidId));
			userData = getUserData(_userData, interaction.guildId, getMapData(_quids, quidId));
			if (!hasNameAndSpecies(userData)) { throw Error('quid.species is empty string'); }
			await sendStatsMessage(interaction, userData, creatorUserId);
			return;
		}

		if (interaction.customId.includes('store')) {

			if (!hasNameAndSpecies(userData, interaction)) { return; }
			const restEmbed = await isInvalid(interaction, userData);
			if (restEmbed === false) { return; }

			await sendStoreMessage(interaction, userData, serverData, restEmbed);
		}

	},
};

async function sendStatsMessage(
	interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>,
	userData: UserData<never, never>,
	creatorUserId: string,
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

	if (calculateInventorySize(quidToServer.inventory) === 0 || !Object.keys(userData.userIds).includes(creatorUserId)) {

		components.components.pop();
	}

	// "item" needs to be == and not === in order to catch the booleans as well
	let injuryText = '';

	for (const [injuryKind, injuryAmount] of Object.entries(quidToServer.injuries)) {

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
			(quidToServer.sapling.exists === false ? '' : `\n🌱 Ginkgo Sapling: ${quidToServer.sapling.waterCycles} days alive - ${quidToServer.sapling.health} health - Next watering <t:${Math.floor((quidToServer.sapling.nextWaterTimestamp || 0) / 1000)}:R>`) +
			(quidToServer.hasQuest ? `\n${quid.name} has one open quest!` : '') + (canRankUp ? `\n${quid.name} can rank up!` : ''),
		components: [components],
	}, 'update', interaction.isMessageComponent() ? interaction.message.id : undefined);
}