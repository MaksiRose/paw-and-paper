import { EmbedBuilder, Message } from 'discord.js';
import userModel from '../models/userModel';
import { UserSchema } from '../typedef';
import { getMapData } from './helperFunctions';

/* This is the required points to get a certain amount of friendship hearts */
const requiredPoints = [1, 3, 6, 9, 15, 24, 39, 63, 99, 162] as const;

/**
 * Creates a friendship or adds friendship points to an existing friendship. Sends a message if they have more hearts than before.
 */
export const addFriendshipPoints = async (
	message: Message,
	userData: UserSchema,
	quidId: string,
	partnerUserData: UserSchema,
	partnerQuidId: string,
): Promise<void> => {

	let quidData = getMapData(userData.quids, quidId);
	let partnerQuidData = getMapData(partnerUserData.quids, partnerQuidId);

	/* Based on current friendship, the friendship points are calculated. */
	const previousFriendshipPoints = getFriendshipPoints(quidData.mentions[partnerQuidId] || [], partnerQuidData.mentions[quidId] || []);

	/* It's updating the database with the new mention, and then grabbing the updated data from the database. */
	userData = await userModel.findOneAndUpdate(
		(u => u.uuid === userData.uuid),
		(u) => {
			let cmentions = getMapData(u.quids, quidId).mentions[partnerQuidId];
			if (!cmentions) {
				cmentions = [message.createdTimestamp];
			}
			else { cmentions.push(message.createdTimestamp); }
		},
	);

	[userData, partnerUserData] = await checkOldMentions(userData, quidData._id, partnerUserData, partnerQuidData._id);
	quidData = getMapData(userData.quids, quidId);
	partnerQuidData = getMapData(partnerUserData.quids, partnerQuidId);
	const newFriendshipPoints = getFriendshipPoints(quidData.mentions[partnerQuidId] || [], partnerQuidData.mentions[quidId] || []);

	/* A message is sent to the users if the friendship has more hearts now than it had before. */
	if (getFriendshipHearts(previousFriendshipPoints) < getFriendshipHearts(newFriendshipPoints)) {

		await message.channel
			.send({
				embeds: [new EmbedBuilder()
					.setColor(quidData.color)
					.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL })
					.setTitle(`The friendship between ${quidData.name} and ${partnerQuidData.name} grew 💗`)
					.setDescription('❤️'.repeat(getFriendshipHearts(newFriendshipPoints)) + '🖤'.repeat(10 - getFriendshipHearts(newFriendshipPoints)))
					.setFooter(getFriendshipHearts(newFriendshipPoints) === 6 ? { text: 'You can now adventure together using the "adventure" command!' } : null)],
			})
			.catch((newError) => { throw new Error(newError); });
	}
};

/**
 * Calculates the amount of points a friendship has an returns it.
 */
export const getFriendshipPoints = (
	array1: number[],
	array2: number[],
): number => {

	if (!Array.isArray(array1)) { array1 = []; }
	if (!Array.isArray(array2)) { array2 = []; }

	const higherPoints = array1?.length >= array2?.length ? array1?.length : array2?.length;
	const lowerPoints = array1?.length < array2?.length ? array1?.length : array2?.length;

	return (lowerPoints * 3) + (higherPoints - lowerPoints) || 0;
};

/**
 * Checks if any mentions stored in a friendship are older than a week, and if they are, remove them.
 */
export const checkOldMentions = async (
	userData: UserSchema,
	quidId: string,
	partnerUserData: UserSchema,
	partnerQuidId: string,
): Promise<readonly [UserSchema, UserSchema]> => {

	const oneWeekInMs = 604_800_000;
	userData = await userModel.findOneAndUpdate(
		(u => u.uuid === userData.uuid),
		(u) => {
			let cmentions = getMapData(u.quids, quidId).mentions[partnerQuidId];
			if (cmentions) { cmentions = cmentions.filter(ts => ts > Date.now() - oneWeekInMs); }
		},
	);

	partnerUserData = await userModel.findOneAndUpdate(
		(u => u.uuid === partnerUserData.uuid),
		(u) => {
			let cmentions = getMapData(u.quids, partnerQuidId).mentions[quidId];
			if (cmentions) { cmentions = cmentions.filter(ts => ts > Date.now() - oneWeekInMs); }
		},
	);

	return [userData, partnerUserData] as const;
};

/**
 * Checks how many hearts a friendship has based on its points and returns the amount of hearts
 */
export const getFriendshipHearts = (
	points: number,
): number => {

	let friendshipHearts = 0;
	for (const index of requiredPoints) {

		if (points >= index) { friendshipHearts += 1; }
		else { break; }
	}
	return friendshipHearts;
};