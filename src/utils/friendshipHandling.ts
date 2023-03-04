import { EmbedBuilder, TextBasedChannel } from 'discord.js';
import { UserData } from '../typings/data/user';
import { getMapData } from './helperFunctions';

/* This is the required points to get a certain amount of friendship hearts */
const requiredPoints = [1, 3, 6, 9, 15, 24, 39, 63, 99, 162] as const;

/**
 * Creates a friendship or adds friendship points to an existing friendship. Sends a message if they have more hearts than before.
 */
export async function addFriendshipPoints(
	message: { createdTimestamp: number, channel: TextBasedChannel
},
	userData1: UserData<never, never>,
	userData2: UserData<never, never>,
): Promise<void> {

	/* Based on current friendship, the friendship points are calculated. */
	const previousFriendshipPoints = getFriendshipPoints(userData1.quid.mentions[userData2.quid.id] || [], userData2.quid.mentions[userData1.quid.id] || []);

	/* It's updating the database with the new mention, and then grabbing the updated data from the database. */
	await userData1.update(
		(u) => {
			const q = getMapData(u.quids, userData1.quid.id);
			const cmentions = q.mentions[userData2.quid.id];
			if (!cmentions) { q.mentions[userData2.quid.id] = [message.createdTimestamp]; }
			else { cmentions.push(message.createdTimestamp); }
		},
	);

	await checkOldMentions(userData1, userData2);
	const newFriendshipPoints = getFriendshipPoints(userData1.quid.mentions[userData2.quid.id] || [], userData2.quid.mentions[userData1.quid.id] || []);

	/* A message is sent to the users if the friendship has more hearts now than it had before. */
	if (getFriendshipHearts(previousFriendshipPoints) < getFriendshipHearts(newFriendshipPoints)) {

		await message.channel
			.send({ // Because of this, everything that calls addFriendshipPoints needs to be permission guarded
				embeds: [new EmbedBuilder()
					.setColor(userData1.quid.color)
					.setAuthor({ name: userData1.quid.getDisplayname(), iconURL: userData1.quid.avatarURL })
					.setTitle(`The friendship between ${userData1.quid.name} and ${userData2.quid.name} grew 💗`)
					.setDescription('❤️'.repeat(getFriendshipHearts(newFriendshipPoints)) + '🖤'.repeat(10 - getFriendshipHearts(newFriendshipPoints)))
					.setFooter(getFriendshipHearts(newFriendshipPoints) === 6 ? { text: 'You can now adventure together using the "adventure" command!' } : null)],
			});
	}
}

/**
 * Calculates the amount of points a friendship has an returns it.
 */
export function getFriendshipPoints(
	array1: number[],
	array2: number[],
): number {

	if (!Array.isArray(array1)) { array1 = []; }
	if (!Array.isArray(array2)) { array2 = []; }

	const higherPoints = array1?.length >= array2?.length ? array1?.length : array2?.length;
	const lowerPoints = array1?.length < array2?.length ? array1?.length : array2?.length;

	return (lowerPoints * 3) + (higherPoints - lowerPoints) || 0;
}

/**
 * Checks if any mentions stored in a friendship are older than a week, and if they are, remove them.
 */
export async function checkOldMentions(
	userData1: UserData<never, never>,
	userData2: UserData<never, never>,
): Promise<void> {

	const oneWeekInMs = 604_800_000;
	await userData1.update(
		(u) => {
			let cmentions = getMapData(u.quids, userData1.quid.id).mentions[userData2.quid.id];
			if (cmentions) { cmentions = cmentions.filter(ts => ts > Date.now() - oneWeekInMs); }
		},
	);

	await userData2.update(
		(u) => {
			let cmentions = getMapData(u.quids, userData2.quid.id).mentions[userData1.quid.id];
			if (cmentions) { cmentions = cmentions.filter(ts => ts > Date.now() - oneWeekInMs); }
		},
	);
}

/**
 * Checks how many hearts a friendship has based on its points and returns the amount of hearts
 */
export function getFriendshipHearts(
	points: number,
): number {

	let friendshipHearts = 0;
	for (const index of requiredPoints) {

		if (points >= index) { friendshipHearts += 1; }
		else { break; }
	}
	return friendshipHearts;
}