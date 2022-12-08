import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Collection, EmbedBuilder, Guild, StringSelectMenuBuilder, SlashCommandBuilder } from 'discord.js';
import { respond } from '../../utils/helperFunctions';
import { isInGuild } from '../../utils/checkUserState';
import { getMapData } from '../../utils/helperFunctions';
import { SlashCommand } from '../../typings/handle';
import { RankType } from '../../typings/data/user';
import { userModel } from '../../models/userModel';
const { default_color } = require('../../../config.json');

const oneWeekInMs = 604_800_000;
const oneMonthInMs = 2_629_746_000;

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('profilelist')
		.setDescription('View a list of all the profiles that exist on this server.')
		.setDMPermission(false)
		.toJSON(),
	category: 'page4',
	position: 5,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (interaction) => {

		if (!isInGuild(interaction)) { return; } // This is always a reply

		/* Creating a message with up to 25 profiles of a certain rank, a select menu to select another rank and buttons to go back and fourth a page if the rank as more than 25 profiles. */
		// This is always a reply
		await respond(interaction, await getProfilesMessage(interaction.user.id, 0, interaction.guild, RankType.Youngling));
	},
	async sendMessageComponentResponse(interaction) {

		if (!interaction.inCachedGuild()) { throw new Error('Interaction is not in cached guild.'); }

		if (interaction.isStringSelectMenu() && interaction.customId.startsWith('profilelist_rank_options')) {

			const rankName = (interaction.values[0] === 'profilelist_elderlies') ?
				RankType.Elderly :
				(interaction.values[0] === 'profilelist_younglings') ?
					RankType.Youngling :
					(interaction.values[0] === 'profilelist_apprentices') ?
						RankType.Apprentice :
						RankType.Hunter;

			const profilesText = await getProfilesTexts(interaction.guild, rankName, rankName === RankType.Hunter ? RankType.Healer : undefined);

			// This is always an update to the message with the select menu
			await respond(interaction, await getProfilesMessage(interaction.user.id, 0, interaction.guild, rankName, profilesText), 'update', '@original');
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

		// This is always an update to the message with the component
		await respond(interaction, await getProfilesMessage(interaction.user.id, page, interaction.guild, rankName, profilesText), 'update', '@original');
		return;

	},
};

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

	const allRankUsersList = await userModel.find(
		u => {
			return Object.values(u.quids)
				.filter(q => q.profiles[guild.id] !== undefined)
				.map(q => getMapData(q.profiles, guild.id))
				.filter(p => p.rank === rankName1 || p.rank === rankName2)
				.length > 0;
		});
	const rankTexts: string[] = [];

	for (const user of Object.values(allRankUsersList)) {

		const userIds = new Collection(Object.entries(user.userIds)).sort((userId1, userId2) => ((userId2[guild.id]?.lastUpdatedTimestamp ?? 0) - (userId1[guild.id]?.lastUpdatedTimestamp ?? 0))); // This sorts the userIds in such a way that the one with the newest update is first and the one with the oldest update (or undefined) is last. In the for loop, it will therefore do as little tests and fetches as possible.
		userIdLoop: for (const [userId, data] of userIds) {

			/* It's getting the cache of the user in the guild. */
			let guildMember = data[guild.id];

			/* It's checking if there is no cache or if the cache is more than one week old. If it is, get new cache. If there is still no cache or the member is not in the guild, continue. */
			const timeframe = guildMember?.isMember ? oneWeekInMs : oneMonthInMs; // If a person is supposedly in a guild, we want to be really sure they are actually in the guild since assuming wrongly can lead to unwanted behavior, and these checks are the only way of finding out when they left. On the contrary, when they are supposedly not in the guild, we might find out anyways through them using the bot in the server, so we don't need to check that often.
			if (!guildMember || guildMember.lastUpdatedTimestamp < Date.now() - timeframe) {

				const member = await guild.members.fetch(userId).catch(() => { return null; });
				guildMember = { isMember: member !== null, lastUpdatedTimestamp: Date.now() };
				await userModel.findOneAndUpdate(
					u => u._id === user._id,
					(u => u.userIds[userId] = {
						...(u.userIds[userId] ?? {}),
						[guild.id]: guildMember!,
					}),
				);
			}
			if (!guildMember || !guildMember.isMember) { continue; }

			/* For each quid, check if there is a profile, and if there is, add that profile to the rankTexts. */
			for (const q of Object.values(user.quids)) {

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
	_id: string,
	page: number,
	guild: Guild,
	rank: RankType,
	profilesText?: string[],
): Promise<{
	embeds: EmbedBuilder[];
	components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[];
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
			new ActionRowBuilder<StringSelectMenuBuilder>()
				.setComponents(new StringSelectMenuBuilder()
					.setCustomId(`profilelist_rank_options_@${_id}`)
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
						.setCustomId(`profilelist_left_${rank}_${page}_@${_id}`)
						.setEmoji('⬅️')
						.setStyle(ButtonStyle.Secondary),
					new ButtonBuilder()
						.setCustomId(`profilelist_right_${rank}_${page}_@${_id}`)
						.setEmoji('➡️')
						.setStyle(ButtonStyle.Secondary),
				])] : []),
		],
	};
}