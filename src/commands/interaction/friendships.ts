import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { respond } from '../../events/interactionCreate';
import userModel from '../../models/userModel';
import { Character, SlashCommand, UserSchema } from '../../typedef';
import { hasName } from '../../utils/checkUserState';
import { checkOldMentions, getFriendshipHearts, getFriendshipPoints } from '../../utils/friendshipHandling';
import { getMapData } from '../../utils/getInfo';

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

		/* Get the currently active character of the user. */
		const characterData = getMapData(userData.characters, getMapData(userData.currentCharacter, interaction.guildId || 'DM'));

		/* Creating a message with up to 25 friendships and buttons to go back and fourth a page if the character has more than 25 friends. */
		await respond(interaction, await getFriendshipMessage(userData, characterData, 0), true)
			.catch((error) => { throw new Error(error); });
	},
};

export const friendshipsInteractionCollector = async (
	interaction: ButtonInteraction,
	userData: UserSchema | null,
): Promise<void> => {

	if (!userData) { throw new TypeError('userData is null.'); }

	/* Get the page number of the friendship list.  */
	let page = Number(interaction.customId.split('_')[2] ?? 0);

	/* Get the currently active character of the user and a list of friendship texts for all the friendships this character has */
	const characterData = getMapData(userData.characters, getMapData(userData.currentCharacter, interaction.guildId || 'DM'));
	const friendshipTexts = await getFriendshipTexts(userData, characterData);

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
	await interaction
		.update(await getFriendshipMessage(userData, characterData, page, friendshipTexts))
		.catch((error) => { throw new Error(error); });
};

/**
 * It gets an array of texts for all the friendships of the character of the user who executed the command
 * @param userData - The userData of the user who executed the command.
 * @param characterData - The character data of the user who executed the command.
 * @returns An array of strings.
 */
const getFriendshipTexts = async (
	userData: UserSchema,
	characterData: Character,
): Promise<string[]> => {

	/** An array of users with characters who are friends with the user who executed the command. */
	const allFriendedUsersList = await userModel.find(
		u => {
			return Object.values(u.characters).filter(c => {
				return Object.keys(characterData.mentions).includes(c._id) || Object.keys(c.mentions).includes(characterData._id);
			}).length > 0;
		},
	);

	/** An array of characters who are friends with the user who executed the command by their character ID. */
	const friendshipList = [...new Set([
		...Object.keys(characterData.mentions),
		...allFriendedUsersList.map(u => Object.values(u.characters).filter(c => Object.keys(c.mentions).includes(characterData._id)).map(c => c._id)).flat(),
	])];

	const friendshipTexts: string[] = [];
	for (const _id of friendshipList) {

		/* Getting the userData of the other user. Skips to next iteration if there is no data */
		let otherUserData = allFriendedUsersList.find(u => u.characters[_id] !== undefined);
		if (!otherUserData) { continue; }

		/* Updating the mentions and extracting them from the new userData. */
		[userData, otherUserData] = await checkOldMentions(userData, characterData._id, otherUserData, _id);
		const userDataMentions = getMapData(getMapData(userData.characters, characterData._id).mentions, _id);
		const otheUserDataMentions = getMapData(getMapData(otherUserData.characters, _id).mentions, characterData._id);

		/* Getting the current friendship points and hearts. Skips to the next iteration if there is no friendship hearts. */
		const friendshipPoints = getFriendshipPoints(userDataMentions, otheUserDataMentions);
		const friendshipHearts = getFriendshipHearts(friendshipPoints);
		if (friendshipHearts <= 0) { continue; }

		friendshipTexts.push(`${getMapData(otherUserData.characters, _id).name} (<@${otherUserData.userId[0]}>) - ${'❤️'.repeat(friendshipHearts) + '🖤'.repeat(10 - friendshipHearts)}`);
	}

	return friendshipTexts;
};

/**
 * It returns an embed and a component for the friendship command
 * @param userData - The user data of the user who executed the command.
 * @param characterData - The character data of the user who executed the command.
 * @param page - The page number of the friendship list.
 * @param [friendshipTexts] - An array of strings that contain the friendship texts.
 * @returns An object with two properties: embeds and components.
 */
const getFriendshipMessage = async (
	userData: UserSchema,
	characterData: Character,
	page: number,
	friendshipTexts?: string[],
): Promise<{
	embeds: EmbedBuilder[];
	components: ActionRowBuilder<ButtonBuilder>[];
}> => {

	/* Getting an array of texts for all the friendships of the character of the user who executed the command. */
	if (!friendshipTexts) { friendshipTexts = await getFriendshipTexts(userData, characterData); }

	return {
		embeds: [new EmbedBuilder()
			.setColor(characterData.color)
			.setAuthor({ name: characterData.name, iconURL: characterData.avatarURL })
			.setTitle(`${characterData.name}'s friendships - Page ${page + 1}`)
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
};