import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getQuidDisplayname, respond, update } from '../../utils/helperFunctions';
import userModel from '../../models/userModel';
import { Quid, SlashCommand, UserSchema } from '../../typedef';
import { hasName } from '../../utils/checkUserState';
import { checkOldMentions, getFriendshipHearts, getFriendshipPoints } from '../../utils/friendshipHandling';
import { getMapData } from '../../utils/helperFunctions';

const name: SlashCommand['name'] = 'friendships';
const description: SlashCommand['description'] = 'View a list of all the friendships that you have with other players.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.toJSON(),
	disablePreviousCommand: false,
	sendCommand: async (client, interaction, userData) => {

		if (!hasName(interaction, userData)) { return; }

		/* Get the currently active quid of the user. */
		const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId || 'DM'));

		/* Creating a message with up to 25 friendships and buttons to go back and fourth a page if the quid has more than 25 friends. */
		await respond(interaction, await getFriendshipMessage(userData, quidData, interaction.guildId ?? '', 0), true)
			.catch((error) => { throw new Error(error); });
	},
};

export async function friendshipsInteractionCollector(
	interaction: ButtonInteraction,
	userData: UserSchema | null,
): Promise<void> {

	if (userData === null) { throw new TypeError('userData is null.'); }

	/* Get the page number of the friendship list.  */
	let page = Number(interaction.customId.split('_')[2] ?? 0);

	/* Get the currently active quid of the user and a list of friendship texts for all the friendships this quid has */
	const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId || 'DM'));
	const friendshipTexts = await getFriendshipTexts(userData, quidData);

	/* Checking if the user clicked on the left or right button and then it is changing the page number accordingly. */
	if (interaction.customId.includes('left')) {

		page -= 1;
		if (page < 0) { page = Math.ceil(friendshipTexts.length / 25) - 1; }
	}
	else if (interaction.customId.includes('right')) {

		page += 1;
		if (page >= Math.ceil(friendshipTexts.length / 25)) { page = 0; }
	}

	/* Updating the message with the correct friendship texts based on the new page. */
	await update(interaction, await getFriendshipMessage(userData, quidData, interaction.guildId ?? '', page, friendshipTexts))
		.catch((error) => { throw new Error(error); });
}

/**
 * It gets an array of texts for all the friendships of the quid of the user who executed the command
 * @param userData - The userData of the user who executed the command.
 * @param quidData - The quid data of the user who executed the command.
 * @returns An array of strings.
 */
async function getFriendshipTexts(
	userData: UserSchema,
	quidData: Quid,
): Promise<string[]> {

	/** An array of users with quids who are friends with the user who executed the command. */
	const allFriendedUsersList = await userModel.find(
		u => {
			return Object.values(u.quids).filter(q => {
				return Object.keys(quidData.mentions).includes(q._id) || Object.keys(q.mentions).includes(quidData._id);
			}).length > 0;
		},
	);

	/** An array of quids who are friends with the user who executed the command by their quid ID. */
	const friendshipList = [...new Set([
		...Object.keys(quidData.mentions),
		...allFriendedUsersList.map(u => Object.values(u.quids).filter(q => Object.keys(q.mentions).includes(quidData._id)).map(q => q._id)).flat(),
	])];

	const friendshipTexts: string[] = [];
	for (const _id of friendshipList) {

		/* Getting the userData of the other user. Skips to next iteration if there is no data */
		let otherUserData = allFriendedUsersList.find(u => u.quids[_id] !== undefined);
		if (!otherUserData) { continue; }

		/* Updating the mentions and extracting them from the new userData. */
		[userData, otherUserData] = await checkOldMentions(userData, quidData._id, otherUserData, _id);
		const userDataMentions = getMapData(getMapData(userData.quids, quidData._id).mentions, _id);
		const otheUserDataMentions = getMapData(getMapData(otherUserData.quids, _id).mentions, quidData._id);

		/* Getting the current friendship points and hearts. Skips to the next iteration if there is no friendship hearts. */
		const friendshipPoints = getFriendshipPoints(userDataMentions, otheUserDataMentions);
		const friendshipHearts = getFriendshipHearts(friendshipPoints);
		if (friendshipHearts <= 0) { continue; }

		friendshipTexts.push(`${getMapData(otherUserData.quids, _id).name} (<@${otherUserData.userId[0]}>) - ${'❤️'.repeat(friendshipHearts) + '🖤'.repeat(10 - friendshipHearts)}`);
	}

	return friendshipTexts;
}

/**
 * It returns an embed and a component for the friendship command
 * @param userData - The user data of the user who executed the command.
 * @param quidData - The quid data of the user who executed the command.
 * @param page - The page number of the friendship list.
 * @param [friendshipTexts] - An array of strings that contain the friendship texts.
 * @returns An object with two properties: embeds and components.
 */
async function getFriendshipMessage(
	userData: UserSchema,
	quidData: Quid,
	guildId: string,
	page: number,
	friendshipTexts?: string[],
): Promise<{
	embeds: EmbedBuilder[];
	components: ActionRowBuilder<ButtonBuilder>[];
}> {

	/* Getting an array of texts for all the friendships of the quid of the user who executed the command. */
	if (!friendshipTexts) { friendshipTexts = await getFriendshipTexts(userData, quidData); }

	return {
		embeds: [new EmbedBuilder()
			.setColor(quidData.color)
			.setAuthor({ name: getQuidDisplayname(userData, quidData, guildId), iconURL: quidData.avatarURL })
			.setTitle(`${quidData.name}'s friendships - Page ${page + 1}`)
			.setDescription(friendshipTexts.length > 0 ?
				friendshipTexts.slice(page * 25, (page + 1) * 25).join('\n') :
				'You have not formed any friendships yet :(')],
		components: friendshipTexts.length > 25 ?
			[new ActionRowBuilder<ButtonBuilder>()
				.setComponents([
					new ButtonBuilder()
						.setCustomId(`friendships_left_${page}`)
						.setEmoji('⬅️')
						.setStyle(ButtonStyle.Secondary),
					new ButtonBuilder()
						.setCustomId(`friendships_right_${page}`)
						.setEmoji('➡️')
						.setStyle(ButtonStyle.Secondary),
				])] :
			[],
	};
}