import { EmbedBuilder, Message } from 'discord.js';
import userModel from '../models/userModel';
import { UserSchema } from '../typedef';
import { getMapData } from './getInfo';

/* This is the required points to get a certain amount of friendship hearts */
const requiredPoints = [1, 3, 6, 9, 15, 24, 39, 63, 99, 162] as const;

/**
 * Creates a friendship or adds friendship points to an existing friendship. Sends a message if they have more hearts than before.
 */
export async function addFriendshipPoints(message: Message, userData: UserSchema, characterId: string, partnerUserData: UserSchema, partnerCharacterId: string): Promise<void> {

	let characterData = getMapData(userData.characters, characterId);
	let partnerCharacterData = getMapData(partnerUserData.characters, partnerCharacterId);

	/* Based on current friendship, the friendship points are calculated. */
	const previousFriendshipPoints = getFriendshipPoints(characterData.mentions[partnerCharacterId] || [], partnerCharacterData.mentions[characterId] || []);

	/* It's updating the database with the new mention, and then grabbing the updated data from the database. */
	userData = await userModel.findOneAndUpdate(
		(u => u.uuid === userData.uuid),
		(u) => {
			let cmentions = getMapData(u.characters, characterId).mentions[partnerCharacterId];
			if (!cmentions) {
				cmentions = [message.createdTimestamp];
			}
			else { cmentions.push(message.createdTimestamp); }
		},
	);

	[userData, partnerUserData] = await checkOldMentions(userData, characterData._id, partnerUserData, partnerCharacterData._id);
	characterData = getMapData(userData.characters, characterId);
	partnerCharacterData = getMapData(partnerUserData.characters, partnerCharacterId);
	const newFriendshipPoints = getFriendshipPoints(characterData.mentions[partnerCharacterId] || [], partnerCharacterData.mentions[characterId] || []);

	/* A message is sent to the users if the friendship has more hearts now than it had before. */
	if (getFriendshipHearts(previousFriendshipPoints) < getFriendshipHearts(newFriendshipPoints)) {

		await message.channel
			.send({
				embeds: [new EmbedBuilder()
					.setColor(characterData.color)
					.setAuthor({ name: characterData.name, iconURL: characterData.avatarURL })
					.setTitle(`The friendship between ${characterData.name} and ${partnerCharacterData.name} grew 💗`)
					.setDescription('❤️'.repeat(getFriendshipHearts(newFriendshipPoints)) + '🖤'.repeat(10 - getFriendshipHearts(newFriendshipPoints)))
					.setFooter(getFriendshipHearts(newFriendshipPoints) === 6 ? { text: 'You can now adventure together using the "adventure" command!' } : null)],
			})
			.catch((newError) => { throw new Error(newError); });
	}
}

/**
 * Calculates the amount of points a friendship has an returns it.
 */
export function getFriendshipPoints(array1: number[], array2: number[]): number {

	if (!Array.isArray(array1)) { array1 = []; }
	if (!Array.isArray(array2)) { array2 = []; }

	const higherPoints = array1?.length >= array2?.length ? array1?.length : array2?.length;
	const lowerPoints = array1?.length < array2?.length ? array1?.length : array2?.length;

	return (lowerPoints * 3) + (higherPoints - lowerPoints) || 0;
}

/**
 * Checks if any mentions stored in a friendship are older than a week, and if they are, remove them.
 */
export async function checkOldMentions(userData: UserSchema, characterId: string, partnerUserData: UserSchema, partnerCharacterId: string): Promise<readonly [UserSchema, UserSchema]> {

	const oneWeekInMs = 604_800_000;
	userData = await userModel.findOneAndUpdate(
		(u => u.uuid === userData.uuid),
		(u) => {
			let cmentions = getMapData(u.characters, characterId).mentions[partnerCharacterId];
			if (cmentions) { cmentions = cmentions.filter(ts => ts > Date.now() - oneWeekInMs); }
		},
	);

	partnerUserData = await userModel.findOneAndUpdate(
		(u => u.uuid === partnerUserData.uuid),
		(u) => {
			let cmentions = getMapData(u.characters, partnerCharacterId).mentions[characterId];
			if (cmentions) { cmentions = cmentions.filter(ts => ts > Date.now() - oneWeekInMs); }
		},
	);

	return [userData, partnerUserData] as const;
}

/**
 * Checks how many hearts a friendship has based on its points and returns the amount of hearts
 */
export function getFriendshipHearts(points: number): number {

	let friendshipHearts = 0;
	for (const index of requiredPoints) {

		if (points >= index) { friendshipHearts += 1; }
		else { break; }
	}
	return friendshipHearts;
}