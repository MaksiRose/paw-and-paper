import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Guild, SlashCommandBuilder } from 'discord.js';
import { respond } from '../../utils/helperFunctions';
import { hasNameAndSpecies } from '../../utils/checkUserState';
import { checkOldMentions, getFriendshipHearts, getFriendshipPoints } from '../../utils/friendshipHandling';
import { SlashCommand } from '../../typings/handle';
import Quid from '../../models/quid';
import Friendship from '../../models/friendship';
import { Op } from 'sequelize';
import { updateAndGetMembers } from '../../utils/checkRoleRequirements';
import DiscordUser from '../../models/discordUser';
import { getDisplayname } from '../../utils/getQuidInfo';
import User from '../../models/user';
import UserToServer from '../../models/userToServer';
import QuidToServer from '../../models/quidToServer';

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('friendships')
		.setDescription('View a list of all the friendships that you have with other players.')
		.toJSON(),
	category: 'page4',
	position: 6,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer }) => {

		if (!hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (user !== undefined && (await Quid.count({ where: { userId: user.id } })) > 0) })) { return; } // This is always a reply
		if (!user) { throw new TypeError('user is undefined'); }

		/* Creating a message with up to 25 friendships and buttons to go back and fourth a page if the quid has more than 25 friends. */
		await respond(interaction, await getFriendshipMessage(user, quid, userToServer, quidToServer, interaction.guild, 0)); // This is always a reply
	},
	async sendMessageComponentResponse(interaction, { user, quid, userToServer, quidToServer }) {

		if (!interaction.isButton()) { return; }
		if (!hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (user !== undefined && (await Quid.count({ where: { userId: user.id } })) > 0) })) { return; } // This is always a reply
		if (!user) { throw new TypeError('user is undefined'); }

		/* Get the page number of the friendship list.  */
		let page = Number(interaction.customId.split('_')[2] ?? 0);

		/* Get a list of friendship texts for all the friendships this quid has */
		const friendshipTexts = await getFriendshipTexts(quid, interaction.guild);

		/* Checking if the user clicked on the left or right button and then it is changing the page number accordingly. */
		if (interaction.customId.includes('left')) {

			page -= 1;
			if (page < 0) { page = Math.ceil(friendshipTexts.length / 25) - 1; }
		}
		else if (interaction.customId.includes('right')) {

			page += 1;
			if (page >= Math.ceil(friendshipTexts.length / 25)) { page = 0; }
		}

		// This is always an update to the message with the button
		await respond(interaction, await getFriendshipMessage(user, quid, userToServer, quidToServer, interaction.guild, page, friendshipTexts), 'update', interaction.message.id);
	},
};

/**
 * It gets an array of texts for all the friendships of the quid of the user who executed the command
 * @param userData - The userData of the user who executed the command.
 * @param quid - The quid data of the user who executed the command.
 * @returns An array of strings.
 */
async function getFriendshipTexts(
	quid: Quid<true>,
	guild: Guild | null,
): Promise<string[]> {

	/** An array of users with quids who are friends with the user who executed the command. */
	const friendships = await Friendship.findAll({
		where: {
			[Op.or]: [ { quidId1: quid.id }, { quidId2: quid.id } ],
		},
	});

	const friendshipTexts: string[] = [];
	for (const friendship of friendships) {

		/* Getting the userData of the other user. Skips to next iteration if there is no data */
		const otherQuid = await Quid.findByPk(friendship.quidId1 === quid.id ? friendship.quidId2 : friendship.quidId1);
		if (!hasNameAndSpecies(otherQuid)) { continue; }
		const otherUserId = await async function() {
			const otherUserMembers = guild ? await updateAndGetMembers(otherQuid.userId, guild) : [];
			return otherUserMembers[0]?.id ?? (await DiscordUser.findOne({ where: { userId: otherQuid.userId } }))?.id;
		}();

		/* Updating the mentions and extracting them from the new userData. */
		await checkOldMentions(friendship);

		/* Getting the current friendship points and hearts. Skips to the next iteration if there is no friendship hearts. */
		const friendshipPoints = getFriendshipPoints(friendship.quid1_mentions, friendship.quid2_mentions);
		const friendshipHearts = getFriendshipHearts(friendshipPoints);
		if (friendshipHearts <= 0) { continue; }

		friendshipTexts.push(`${otherQuid.name} (<@${otherUserId}>) - ${'❤️'.repeat(friendshipHearts) + '🖤'.repeat(10 - friendshipHearts)}`);
	}

	return friendshipTexts;
}

/**
 * It returns an embed and a component for the friendship command
 * @param userData - The user data of the user who executed the command.
 * @param quid - The quid data of the user who executed the command.
 * @param page - The page number of the friendship list.
 * @param [friendshipTexts] - An array of strings that contain the friendship texts.
 * @returns An object with two properties: embeds and components.
 */
async function getFriendshipMessage(
	user: User,
	quid: Quid<true>,
	userToServer: UserToServer | undefined,
	quidToServer: QuidToServer | undefined,
	guild: Guild | null,
	page: number,
	friendshipTexts?: string[],
): Promise<{
	embeds: EmbedBuilder[];
	components: ActionRowBuilder<ButtonBuilder>[];
}> {

	/* Getting an array of texts for all the friendships of the quid of the user who executed the command. */
	if (!friendshipTexts) { friendshipTexts = await getFriendshipTexts(quid, guild); }

	return {
		embeds: [new EmbedBuilder()
			.setColor(quid.color)
			.setAuthor({
				name: await getDisplayname(quid, { serverId: guild?.id, userToServer, quidToServer, user }),
				iconURL: quid.avatarURL,
			})
			.setTitle(`${quid.name}'s friendships - Page ${page + 1}`)
			.setDescription(friendshipTexts.length > 0 ?
				friendshipTexts.slice(page * 25, (page + 1) * 25).join('\n') :
				'You have not formed any friendships yet :(')],
		components: friendshipTexts.length > 25 ?
			[new ActionRowBuilder<ButtonBuilder>()
				.setComponents([
					new ButtonBuilder()
						.setCustomId(`friendships_left_${page}_@${user.id}`)
						.setEmoji('⬅️')
						.setStyle(ButtonStyle.Secondary),
					new ButtonBuilder()
						.setCustomId(`friendships_right_${page}_@${user.id}`)
						.setEmoji('➡️')
						.setStyle(ButtonStyle.Secondary),
				])] :
			[],
	};
}