import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, Guild, SelectMenuBuilder, SelectMenuInteraction, SlashCommandBuilder } from 'discord.js';
import { respond, update } from '../../utils/helperFunctions';
import userModel from '../../models/userModel';
import { RankType, SlashCommand } from '../../typedef';
import { isInGuild } from '../../utils/checkUserState';
import { getMapData } from '../../utils/helperFunctions';
const { default_color } = require('../../../config.json');

const guildCache: Map<string, Map<string, {
	cachedAt: number;
	isInGuild: boolean;
}>> = new Map();
const oneWeekInMs = 604_800_000;

const name: SlashCommand['name'] = 'profilelist';
const description: SlashCommand['description'] = 'View a list of all the profiles that exist on this server.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.setDMPermission(false)
		.toJSON(),
	disablePreviousCommand: false,
	sendCommand: async (client, interaction) => {

		if (!isInGuild(interaction)) { return; }

		/* Creating a message with up to 25 profiles of a certain rank, a select menu to select another rank and buttons to go back and fourth a page if the rank as more than 25 profiles. */
		await respond(interaction, await getProfilesMessage(0, interaction.guild, RankType.Youngling), true);
	},
};

export async function profilelistInteractionCollector(
	interaction: ButtonInteraction | SelectMenuInteraction,
): Promise<void> {

	if (!interaction.inCachedGuild()) { throw new Error('Interaction is not in cached guild.'); }

	if (interaction.isSelectMenu() && interaction.customId === 'profilelist_rank_options') {

		const rankName = (interaction.values[0] === 'profilelist_elderlies') ?
			RankType.Elderly :
			(interaction.values[0] === 'profilelist_younglings') ?
				RankType.Youngling :
				(interaction.values[0] === 'profilelist_apprentices') ?
					RankType.Apprentice :
					RankType.Hunter;

		const profilesText = await getProfilesTexts(interaction.guild, rankName, rankName === RankType.Hunter ? RankType.Healer : undefined);

		await update(interaction, await getProfilesMessage(0, interaction.guild, rankName, profilesText));
		return;
	}

	const rankName = interaction.customId.includes(RankType.Elderly) ?
		RankType.Elderly :
		interaction.customId.includes(RankType.Youngling) ?
			RankType.Youngling :
			interaction.customId.includes(RankType.Apprentice) ?
				RankType.Apprentice :
				RankType.Hunter;

	const profilesText = await getProfilesTexts(interaction.guild, rankName, rankName === RankType.Hunter ? RankType.Healer : undefined);

	/* Get the page number of the friendship list.  */
	let page = Number(interaction.customId.split('_')[3] ?? 0);

	/* Checking if the user clicked on the left or right button and then it is changing the page number accordingly. */
	if (interaction.customId.includes('left')) {

		page -= 1;
		if (page < 0) { page = Math.ceil(profilesText.length / 25) - 1; }
	}
	else if (interaction.customId.includes('right')) {

		page += 1;
		if (page >= Math.ceil(profilesText.length / 25)) { page = 0; }
	}

	await respond(interaction, await getProfilesMessage(page, interaction.guild, rankName, profilesText), true);
	return;
}

/**
 * It gets all the users that have a profile in the guild, and then for each user, it gets the cache of the user in the guild, and if the user is in the guild, it gets the profile of each quid of the user and adds it to the rankTexts
 * @param guild - The guild that the command is being used in.
 * @param rankName1 - The name of the rank you want to get the profiles of.
 * @param [rankName2] - The name of the second rank you want to get the profiles of.
 * @returns An array of strings for all the profiles with that rank.
 */
async function getProfilesTexts(
	guild: Guild,
	rankName1: RankType,
	rankName2?: RankType,
): Promise<string[]> {

	if (!guildCache.has(guild.id)) { guildCache.set(guild.id, new Map()); }
	const guildMemberCache = guildCache.get(guild.id);
	if (guildMemberCache === undefined) { throw new TypeError('guildMemberCache is undefined'); }

	const allRankUsersList = await userModel.find(
		u => {
			return Object.values(u.quids)
				.filter(q => q.profiles[guild.id] !== undefined)
				.map(q => getMapData(q.profiles, guild.id))
				.filter(p => p.rank === rankName1 || p.rank === rankName2)
				.length > 0;
		});
	const rankTexts: string[] = [];

	for (const u of Object.values(allRankUsersList)) {

		userIdLoop: for (const userId of u.userId) {

			/* It's getting the cache of the user in the guild. */
			if (!guildMemberCache.has(userId)) { guildMemberCache.set(userId, { cachedAt: 0, isInGuild: false }); }
			let guildMember = guildMemberCache.get(userId);

			/* It's checking if there is no cache or if the cache is more than one week old. If it is, get new cache. If there is still no cache or the member is not in the guild, continue. */
			if (!guildMember || guildMember.cachedAt < Date.now() - oneWeekInMs) {

				const member = await guild.members.fetch(userId).catch(() => { return null; });
				guildMemberCache.set(userId, { cachedAt: Date.now(), isInGuild: member !== null });
				guildMember = guildMemberCache.get(userId);
			}
			if (!guildMember || !guildMember.isInGuild) { continue; }

			/* For each quid, check if there is a profile, and if there is, add that profile to the rankTexts. */
			for (const q of Object.values(u.quids)) {

				const p = q.profiles[guild.id];
				if (p !== undefined && (p.rank === rankName1 || p.rank === rankName2)) { rankTexts.push(`${q.name} (\`${p.health}/${p.maxHealth} HP\`) - <@${userId}>`); }
			}
			break userIdLoop;
		}
	}
	return rankTexts;
}

/**
 * It returns an object with two properties, `embeds` and `components`. The `embeds` property is an array of embeds that will be sent to the user. The `components` property is an array of action rows, which are rows of buttons and select menus that will be displayed to the user.
 * @param page - The page number of the profiles list.
 * @param guild - The guild where the command was executed.
 * @param rank - The rank that is currently being displayed.
 * @param [profilesText] - An array of strings for all the profiles with that rank.
 * @returns An object with two properties: embeds and components.
 */
async function getProfilesMessage(
	page: number,
	guild: Guild,
	rank: RankType,
	profilesText?: string[],
): Promise<{
	embeds: EmbedBuilder[];
	components: ActionRowBuilder<ButtonBuilder | SelectMenuBuilder>[];
}> {

	/* Getting an array of strings for all the profiles with that rank. */
	if (!profilesText) { profilesText = await getProfilesTexts(guild, rank); }

	enum DisplayedRankType {
		Younglings = 'Younglings',
		Apprentices = 'Apprentices',
		HuntersHealers = 'Hunters/Healers',
		Elderlies = 'Elderlies'
	}

	const displayedRank: DisplayedRankType = rank === RankType.Elderly ?
		DisplayedRankType.Elderlies :
		rank === RankType.Healer || rank === RankType.Hunter ?
			DisplayedRankType.HuntersHealers :
			rank === RankType.Apprentice ?
				DisplayedRankType.Apprentices :
				DisplayedRankType.Younglings;

	return {
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setAuthor({ name: guild.name, iconURL: guild.iconURL() || undefined })
			.setTitle(`Profiles - ${displayedRank}`)
			.setDescription(profilesText.length > 0 ?
				profilesText.slice(page * 25, (page + 1) * 25).join('\n') :
				'There are no profiles with this rank on this server :(')],
		components: [
			new ActionRowBuilder<SelectMenuBuilder>()
				.setComponents(new SelectMenuBuilder()
					.setCustomId('profilelist_rank_options')
					.setPlaceholder('Select a rank')
					.setOptions([
						{ label: DisplayedRankType.Younglings, value: 'profilelist_younglings' },
						{ label: DisplayedRankType.Apprentices, value: 'profilelist_apprentices' },
						{ label: DisplayedRankType.HuntersHealers, value: 'profilelist_huntershealers' },
						{ label: DisplayedRankType.Elderlies, value: 'profilelist_elderlies' },
					])),
			...(profilesText.length > 25 ? [new ActionRowBuilder<ButtonBuilder>()
				.setComponents([
					new ButtonBuilder()
						.setCustomId(`profilelist_left_${rank}_${page}`)
						.setEmoji('⬅️')
						.setStyle(ButtonStyle.Secondary),
					new ButtonBuilder()
						.setCustomId(`profilelist_right_${rank}_${page}`)
						.setEmoji('➡️')
						.setStyle(ButtonStyle.Secondary),
				])] : []),
		],
	};
}