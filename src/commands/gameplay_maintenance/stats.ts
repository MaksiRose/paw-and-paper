import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { userModel, getUserData } from '../../models/userModel';
import { RankType, UserData } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid } from '../../utils/checkValidity';
import { getArrayElement, getMapData, respond, update } from '../../utils/helperFunctions';
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
	sendCommand: async (interaction, userData) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (!isInGuild(interaction)) { return; }

		const mentionedUser = interaction.options.getUser('user');
		if (mentionedUser) {

			const _userData = (() => {
				try { return userModel.findOne(u => u.userId.includes(mentionedUser.id)); }
				catch { return null; }
			})();
			if (!_userData) {

				await respond(interaction, {
					embeds: [new EmbedBuilder()
						.setColor(error_color)
						.setTitle('There is nothing to show here :('),
					],
					ephemeral: true,
				}, false);
				return;
			}

			userData = getUserData(_userData, interaction.guildId, getMapData(_userData.quids, getMapData(_userData.currentQuid, interaction.guildId)));
			if (!hasNameAndSpecies(userData)) {

				await respond(interaction, {
					embeds: [new EmbedBuilder()
						.setColor(error_color)
						.setTitle('The selected quid has no profile :('),
					],
					ephemeral: true,
				}, false);
				return;
			}
		}
		else if (!hasNameAndSpecies(userData, interaction)) { return; }

		await sendStatsMessage(interaction, userData, interaction.user.id);
	},
	async sendMessageComponentResponse(interaction, userData, serverData) {

		if (!interaction.isButton()) { return; }
		/* This ensures that the user is in a guild and has a completed account. */
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction)) { return; }

		if (interaction.customId.includes('refresh')) {

			const quidId = getArrayElement(interaction.customId.split('_'), 2);
			const creatorUserId = getArrayElement(interaction.customId.split('_'), 3).replace('@', '');

			const _userData = await userModel.findOne(u => Object.keys(u.quids).includes(quidId));
			userData = getUserData(_userData, interaction.guildId, getMapData(_userData.quids, quidId));
			if (!hasNameAndSpecies(userData)) { throw Error('userData.quid.species is empty string'); }
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
			.setCustomId(`stats_refresh_${userData.quid._id}_@${creatorUserId}`)
			.setEmoji('🔁')
			.setStyle(ButtonStyle.Secondary),
		new ButtonBuilder()
			.setCustomId(`stats_store_@${creatorUserId}`)
			.setLabel('Store items away')
			.setStyle(ButtonStyle.Secondary),
		]);

	if (calculateInventorySize(userData.quid.profile.inventory) === 0 || !userData.userId.includes(creatorUserId)) {

		components.components.pop();
	}

	// "item" needs to be == and not === in order to catch the booleans as well
	let injuryText = '';

	for (const [injuryKind, injuryAmount] of Object.entries(userData.quid.profile.injuries)) {

		if (injuryAmount > 0) {

			if (typeof injuryAmount === 'number') {

				injuryText += `, ${injuryAmount} ${(injuryAmount < 2) ? injuryKind.slice(0, -1) : injuryKind}`;
			}
			else {

				injuryText += `, ${injuryKind}: yes`;
			}
		}
	}

	const canRankUp = userData.quid.profile.unlockedRanks > { [RankType.Youngling]: 0, [RankType.Apprentice]: 1, [RankType.Hunter]: 2, [RankType.Healer]: 2, [RankType.Elderly]: 3 }[userData.quid.profile.rank];

	await (async function(messageObject) { return interaction.isButton() ? await update(interaction, messageObject) : await respond(interaction, messageObject, true); })({
		content: `🚩 Levels: \`${userData.quid.profile.levels}\` - 🏷️ Rank: ${userData.quid.profile.rank}\n` +
			`✨ XP: \`${userData.quid.profile.experience}/${userData.quid.profile.levels * 50}\` - 🗺️ Region: ${userData.quid.profile.currentRegion}\n` +
			`❤️ HP: \`${userData.quid.profile.health}/${userData.quid.profile.maxHealth}\` - ⚡ Energy: \`${userData.quid.profile.energy}/${userData.quid.profile.maxEnergy}\`\n` +
			`🍗 Hunger: \`${userData.quid.profile.hunger}/${userData.quid.profile.maxHunger}\` - 🥤 Thirst: \`${userData.quid.profile.thirst}/${userData.quid.profile.maxThirst}\`` +
			(injuryText ? `\n🩹 Injuries/Illnesses: ${injuryText.slice(2)}` : injuryText) +
			(userData.quid.profile.sapling.exists === false ? '' : `\n🌱 Ginkgo Sapling: ${userData.quid.profile.sapling.waterCycles} days alive - ${userData.quid.profile.sapling.health} health - Next watering <t:${Math.floor((userData.quid.profile.sapling.nextWaterTimestamp || 0) / 1000)}:R>`) +
			(userData.quid.profile.hasQuest ? `\n${userData.quid.name} has one open quest!` : '') + (canRankUp ? `\n${userData.quid.name} can rank up!` : ''),
		components: [components],
	});
}