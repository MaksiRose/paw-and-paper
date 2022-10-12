import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import userModel from '../../models/userModel';
import { RankType, ServerSchema, SlashCommand, UserSchema } from '../../typedef';
import { hasName, hasSpecies, isInGuild } from '../../utils/checkUserState';
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
	sendCommand: async (client, interaction, userData) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (!isInGuild(interaction)) { return; }

		const mentionedUser = interaction.options.getUser('user');
		if (mentionedUser) {

			userData = await userModel.findOne(u => u.userId.includes(mentionedUser.id)).catch(() => { return null; });
		}
		else if (!hasName(interaction, userData) || !hasSpecies(interaction, getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId)))) { return; }

		/* Gets the current active quid and the server profile from the account */
		const quidData = userData?.quids[userData?.currentQuid[interaction.guildId] || ''];
		const profileData = quidData?.profiles[interaction.guildId];

		if (!userData || !quidData || !profileData) {

			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('There is nothing to show here :('),
				],
				ephemeral: true,
			}, false);
			return;
		}

		await sendStatsMessage(interaction, userData, quidData._id, interaction.user.id);
	},
};

async function sendStatsMessage(
	interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>,
	userData: UserSchema,
	quidId: string,
	creatorUserId: string,
): Promise<void> {

	/* Gets the current active quid and the server profile from the account */
	const quidData = getMapData(userData.quids, quidId);
	const profileData = getMapData(quidData.profiles, interaction.guildId);

	const components = new ActionRowBuilder<ButtonBuilder>()
		.setComponents([new ButtonBuilder()
			.setCustomId(`stats_refresh_${quidId}_${creatorUserId}`)
			.setEmoji('🔁')
			.setStyle(ButtonStyle.Secondary),
		new ButtonBuilder()
			.setCustomId(`stats_store_${creatorUserId}`)
			.setLabel('Store items away')
			.setStyle(ButtonStyle.Secondary),
		]);

	if (calculateInventorySize(profileData.inventory) === 0 || !userData.userId.includes(creatorUserId)) {

		components.components.pop();
	}

	// "item" needs to be == and not === in order to catch the booleans as well
	let injuryText = '';

	for (const [injuryKind, injuryAmount] of Object.entries(profileData.injuries)) {

		if (injuryAmount > 0) {

			if (typeof injuryAmount === 'number') {

				injuryText += `, ${injuryAmount} ${(injuryAmount < 2) ? injuryKind.slice(0, -1) : injuryKind}`;
			}
			else {

				injuryText += `, ${injuryKind}: yes`;
			}
		}
	}

	const canRankUp = profileData.unlockedRanks > { [RankType.Youngling]: 0, [RankType.Apprentice]: 1, [RankType.Hunter]: 2, [RankType.Healer]: 2, [RankType.Elderly]: 3 }[profileData.rank];

	await (async function(messageObject) { return interaction.isButton() ? await update(interaction, messageObject) : await respond(interaction, messageObject, true); })({
		content: `🚩 Levels: \`${profileData.levels}\` - 🏷️ Rank: ${profileData.rank}\n` +
			`✨ XP: \`${profileData.experience}/${profileData.levels * 50}\` - 🗺️ Region: ${profileData.currentRegion}\n` +
			`❤️ HP: \`${profileData.health}/${profileData.maxHealth}\` - ⚡ Energy: \`${profileData.energy}/${profileData.maxEnergy}\`\n` +
			`🍗 Hunger: \`${profileData.hunger}/${profileData.maxHunger}\` - 🥤 Thirst: \`${profileData.thirst}/${profileData.maxThirst}\`` +
			(injuryText ? `\n🩹 Injuries/Illnesses: ${injuryText.slice(2)}` : injuryText) +
			(profileData.sapling.exists === false ? '' : `\n🌱 Ginkgo Sapling: ${profileData.sapling.waterCycles} days alive - ${profileData.sapling.health} health - Next watering <t:${Math.floor((profileData.sapling.nextWaterTimestamp || 0) / 1000)}:R>`) +
			(profileData.hasQuest ? `\n${quidData.name} has one open quest!` : '') + (canRankUp ? `\n${quidData.name} can rank up!` : ''),
		components: [components],
	});
}

export async function statsInteractionCollector(
	interaction: ButtonInteraction,
	userData: UserSchema | null,
	serverData: ServerSchema | null,
): Promise<void> {

	if (!interaction.inCachedGuild()) { throw new Error('Interaction is not in cached guild'); }

	if (interaction.customId.includes('refresh')) {

		const quidId = getArrayElement(interaction.customId.split('_'), 2);
		const creatorUserId = getArrayElement(interaction.customId.split('_'), 3);

		const userData1 = await userModel.findOne(u => Object.keys(u.quids).includes(quidId));
		await sendStatsMessage(interaction, userData1, quidId, creatorUserId);
		return;
	}

	if (interaction.customId.includes('store')) {

		if (userData === null) { throw new TypeError('userData is null'); }
		if (serverData === null) { throw new TypeError('serverData is null'); }

		const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId));
		const profileData = getMapData(quidData.profiles, interaction.guildId);

		await sendStoreMessage(interaction, userData, quidData, profileData, serverData, []);
	}
}