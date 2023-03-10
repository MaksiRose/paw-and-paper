import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Guild, StringSelectMenuBuilder, SlashCommandBuilder, Collection } from 'discord.js';
import { respond } from '../../utils/helperFunctions';
import { isInGuild } from '../../utils/checkUserState';
import { SlashCommand } from '../../typings/handle';
import { RankType } from '../../typings/data/user';
import QuidToServer from '../../models/quidToServer';
import { Op } from 'sequelize';
import Quid from '../../models/quid';
import DiscordUser from '../../models/discordUser';
import DiscordUserToServer from '../../models/discordUserToServer';
import UserToServer from '../../models/userToServer';
import { generateId } from 'crystalid';
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
		await respond(interaction, await getProfilesMessage(interaction.user.id, 0, interaction.guild, [RankType.Youngling]));
	},
	async sendMessageComponentResponse(interaction) {

		if (!interaction.inCachedGuild()) { throw new Error('Interaction is not in cached guild.'); }

		if (interaction.isStringSelectMenu() && interaction.customId.startsWith('profilelist_rank_options')) {

			const rankName = (interaction.values[0] === 'profilelist_elderlies') ?
				[RankType.Elderly] :
				(interaction.values[0] === 'profilelist_younglings') ?
					[RankType.Youngling] :
					(interaction.values[0] === 'profilelist_apprentices') ?
						[RankType.Apprentice] :
						[RankType.Hunter, RankType.Healer];

			const profilesText = await getProfilesTexts(interaction.guild, rankName);

			// This is always an update to the message with the select menu
			await respond(interaction, await getProfilesMessage(interaction.user.id, 0, interaction.guild, rankName, profilesText), 'update', interaction.message.id);
			return;
		}

		const rankName = interaction.customId.includes(RankType.Elderly) ?
			[RankType.Elderly] :
			interaction.customId.includes(RankType.Youngling) ?
				[RankType.Youngling] :
				interaction.customId.includes(RankType.Apprentice) ?
					[RankType.Apprentice] :
					[RankType.Hunter, RankType.Healer];

		const profilesText = await getProfilesTexts(interaction.guild, rankName);

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
		await respond(interaction, await getProfilesMessage(interaction.user.id, page, interaction.guild, rankName, profilesText), 'update', interaction.message.id);
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
	rankTypes: RankType[],
): Promise<string[]> {

	const usersToServer = await UserToServer.findAll({ where: { serverId: guild.id } });
	const rankTexts: string[] = [];

	for (const uts of usersToServer) {

		const quids = await Quid.findAll({ where: { userId: uts.userId } });
		const quidsToServer = await QuidToServer.findAll({
			where: {
				serverId: guild.id,
				quidId: { [Op.in]: quids.map(q => q.id) },
				rank: { [Op.in]: rankTypes },
			},
		});

		const discordUsers = await DiscordUser.findAll({ where: { userId: uts.userId } });
		const discordUsersToServer = (await DiscordUserToServer.findAll({
			where: {
				serverId: guild.id,
				discordUserId: { [Op.in]: discordUsers.map(du => du.id) },
			},
		}));

		const sortedDiscordUsersToServer = new Collection(discordUsers
			.map(du => [du.id, discordUsersToServer.find(duts => duts.discordUserId === du.id)]))
			.sort((duts1, duts2) => ((duts2?.lastUpdatedTimestamp ?? 0) - (duts1?.lastUpdatedTimestamp ?? 0))); // This sorts the userIds in such a way that the one with the newest update is first and the one with the oldest update (or undefined) is last. In the for loop, it will therefore do as little tests and fetches as possible.

		userIdLoop: for (let [discordUserId, discordUserToServer] of sortedDiscordUsersToServer) {

			/* It's checking if there is no cache or if the cache is more than one week old. If it is, get new cache. If there is still no cache or the member is not in the guild, continue. */
			const timeframe = discordUserToServer?.isMember ? oneWeekInMs : oneMonthInMs; // If a person is supposedly in a guild, we want to be really sure they are actually in the guild since assuming wrongly can lead to unwanted behavior, and these checks are the only way of finding out when they left. On the contrary, when they are supposedly not in the guild, we might find out anyways through them using the bot in the server, so we don't need to check that often.
			if (!discordUserToServer || discordUserToServer.lastUpdatedTimestamp < Date.now() - timeframe) {

				const member = await guild.members.fetch(discordUserId).catch(() => { return null; });

				if (!discordUserToServer) {

					discordUserToServer = await DiscordUserToServer.create({
						id: generateId(),
						discordUserId: discordUserId,
						serverId: guild.id,
						isMember: member !== null,
						lastUpdatedTimestamp: Date.now(),
					});
				}
				else if (discordUserToServer) { await discordUserToServer.update({ isMember: member !== null, lastUpdatedTimestamp: Date.now() }); }
			}
			if (!discordUserToServer || !discordUserToServer.isMember) { continue; }

			/* For each quid, check if there is a profile, and if there is, add that profile to the rankTexts. */
			for (const qts of quidsToServer) {

				const q = quids.find(q => q.id === qts.quidId);
				if (q !== undefined) { rankTexts.push(`${q.name} (\`${qts.health}/${qts.maxHealth} HP\`) - <@${discordUserId}>`); }
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
 * @param rankType - The rank that is currently being displayed.
 * @param [profilesText] - An array of strings for all the profiles with that rank.
 * @returns An object with two properties: embeds and components.
 */
async function getProfilesMessage(
	_id: string,
	page: number,
	guild: Guild,
	rankType: RankType[],
	profilesText?: string[],
): Promise<{
	embeds: EmbedBuilder[];
	components: ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[];
}> {

	/* Getting an array of strings for all the profiles with that rank. */
	if (!profilesText) { profilesText = await getProfilesTexts(guild, rankType); }

	enum DisplayedRankType {
		Younglings = 'Younglings',
		Apprentices = 'Apprentices',
		HuntersHealers = 'Hunters/Healers',
		Elderlies = 'Elderlies'
	}

	const displayedRank: DisplayedRankType = rankType.includes(RankType.Elderly) ?
		DisplayedRankType.Elderlies :
		rankType.includes(RankType.Healer) || rankType.includes(RankType.Hunter) ?
			DisplayedRankType.HuntersHealers :
			rankType.includes(RankType.Apprentice) ?
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
						.setCustomId(`profilelist_left_${rankType}_${page}_@${_id}`)
						.setEmoji('⬅️')
						.setStyle(ButtonStyle.Secondary),
					new ButtonBuilder()
						.setCustomId(`profilelist_right_${rankType}_${page}_@${_id}`)
						.setEmoji('➡️')
						.setStyle(ButtonStyle.Secondary),
				])] : []),
		],
	};
}