import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { respond } from '../../utils/helperFunctions';
import { hasNameAndSpecies } from '../../utils/checkUserState';
import { checkOldMentions, getFriendshipHearts, getFriendshipPoints } from '../../utils/friendshipHandling';
import { SlashCommand } from '../../typings/handle';
import { UserData } from '../../typings/data/user';
import { userModel, getUserData } from '../../oldModels/userModel';

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

		if (!hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (await Quid.count({ where: { userId: user.id } })) > 0 })) { return; } // This is always a reply

		/* Creating a message with up to 25 friendships and buttons to go back and fourth a page if the quid has more than 25 friends. */
		await respond(interaction, await getFriendshipMessage(userData, interaction.guildId ?? '', 0)); // This is always a reply
	},
	async sendMessageComponentResponse(interaction, userData) {

		if (!interaction.isButton()) { return; }
		if (!hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (await Quid.count({ where: { userId: user.id } })) > 0 })) { return; } // This is always a reply

		/* Get the page number of the friendship list.  */
		let page = Number(interaction.customId.split('_')[2] ?? 0);

		/* Get a list of friendship texts for all the friendships this quid has */
		const friendshipTexts = await getFriendshipTexts(userData);

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
		await respond(interaction, await getFriendshipMessage(userData, interaction.guildId ?? '', page, friendshipTexts), 'update', interaction.message.id);
	},
};

/**
 * It gets an array of texts for all the friendships of the quid of the user who executed the command
 * @param userData - The userData of the user who executed the command.
 * @param quid - The quid data of the user who executed the command.
 * @returns An array of strings.
 */
async function getFriendshipTexts(
	userData: UserData<never, never>,
): Promise<string[]> {

	/** An array of users with quids who are friends with the user who executed the command. */
	const allFriendedUsersList = await userModel.find(
		u => {
			return Object.values(u.quids).filter(q => {
				return Object.keys(quid.mentions).includes(q.id) || Object.keys(q.mentions).includes(quid.id);
			}).length > 0;
		},
	);

	/** An array of quids who are friends with the user who executed the command by their quid ID. */
	const friendshipList = [...new Set([
		...Object.keys(quid.mentions),
		...allFriendedUsersList.map(u => Object.values(u.quids).filter(q => Object.keys(q.mentions).includes(quid.id)).map(q => q.id)).flat(),
	])];

	const friendshipTexts: string[] = [];
	for (const _id of friendshipList) {

		/* Getting the userData of the other user. Skips to next iteration if there is no data */
		const _otherUserData = allFriendedUsersList.find(u => u.quids[_id] !== undefined);
		const otherUserData = _otherUserData === undefined ? undefined : getUserData(_otherUserData, quidToServer.serverId, _otherUserData.quids[_id]);
		if (!hasNameAndSpecies(otherUserData)) { continue; }

		/* Updating the mentions and extracting them from the new userData. */
		await checkOldMentions(userData, otherUserData);
		const userDataMentions = quids.get(quid.id)?.mentions[_id] ?? [];
		const otherUserDataMentions = otherUserData.quids.get(_id)?.mentions[quid.id] ?? [];

		/* Getting the current friendship points and hearts. Skips to the next iteration if there is no friendship hearts. */
		const friendshipPoints = getFriendshipPoints(userDataMentions, otherUserDataMentions);
		const friendshipHearts = getFriendshipHearts(friendshipPoints);
		if (friendshipHearts <= 0) { continue; }

		friendshipTexts.push(`${otherUserData.quids.get(_id)?.name} (<@${Object.keys(otherUserData.userIds)[0]}>) - ${'❤️'.repeat(friendshipHearts) + '🖤'.repeat(10 - friendshipHearts)}`);
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
	userData: UserData<never, never>,
	guildId: string,
	page: number,
	friendshipTexts?: string[],
): Promise<{
	embeds: EmbedBuilder[];
	components: ActionRowBuilder<ButtonBuilder>[];
}> {

	/* Getting an array of texts for all the friendships of the quid of the user who executed the command. */
	if (!friendshipTexts) { friendshipTexts = await getFriendshipTexts(userData); }

	return {
		embeds: [new EmbedBuilder()
			.setColor(quid.color)
			.setAuthor({
				name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
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
						.setCustomId(`friendships_left_${page}_@${userData.id}`)
						.setEmoji('⬅️')
						.setStyle(ButtonStyle.Secondary),
					new ButtonBuilder()
						.setCustomId(`friendships_right_${page}_@${userData.id}`)
						.setEmoji('➡️')
						.setStyle(ButtonStyle.Secondary),
				])] :
			[],
	};
}