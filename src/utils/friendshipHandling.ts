import { EmbedBuilder, TextBasedChannel } from 'discord.js';
import Quid from '../models/quid';
import { getMapData } from './helperFunctions';

/* This is the required points to get a certain amount of friendship hearts */
const requiredPoints = [1, 3, 6, 9, 15, 24, 39, 63, 99, 162] as const;

/**
 * Creates a friendship or adds friendship points to an existing friendship. Sends a message if they have more hearts than before.
 */
export async function addFriendshipPoints(
	message: { createdTimestamp: number, channel: TextBasedChannel
},
	quid1: Quid,
	quid2: Quid,
): Promise<void> {

	/* Based on current friendship, the friendship points are calculated. */
	const previousFriendshipPoints = getFriendshipPoints(quid1.mentions[quid2.id] || [], quid2.mentions[quid1.id] || []);

	/* It's updating the database with the new mention, and then grabbing the updated data from the database. */
	await userData1.update(
		(u) => {
			const q = getMapData(u.quids, quid1.id);
			const cmentions = q.mentions[quid2.id];
			if (!cmentions) { q.mentions[quid2.id] = [message.createdTimestamp]; }
			else { cmentions.push(message.createdTimestamp); }
		},
	);

	await checkOldMentions(quid1, quid2);
	const newFriendshipPoints = getFriendshipPoints(quid1.mentions[quid2.id] || [], quid2.mentions[quid1.id] || []);

	/* A message is sent to the users if the friendship has more hearts now than it had before. */
	if (getFriendshipHearts(previousFriendshipPoints) < getFriendshipHearts(newFriendshipPoints)) {

		await message.channel
			.send({ // Because of this, everything that calls addFriendshipPoints needs to be permission guarded
				embeds: [new EmbedBuilder()
					.setColor(quid1.color)
					.setAuthor({ name: quid1.getDisplayname(), iconURL: quid1.avatarURL })
					.setTitle(`The friendship between ${quid1.name} and ${quid2.name} grew 💗`)
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

	const lowerPoints = Math.min(array1.length, array2.length);
	const difference = Math.abs(array1.length - array2.length);

	return (lowerPoints * 3) + difference;
}

/**
 * Checks if any mentions stored in a friendship are older than a week, and if they are, remove them.
 */
export async function checkOldMentions(
	quid1: Quid,
	quid2: Quid,
): Promise<void> {

	const oneWeekInMs = 604_800_000;
	await userData1.update(
		(u) => {
			let cmentions = getMapData(u.quids, quid1.id).mentions[quid2.id];
			if (cmentions) { cmentions = cmentions.filter(ts => ts > Date.now() - oneWeekInMs); }
		},
	);

	await userData2.update(
		(u) => {
			let cmentions = getMapData(u.quids, quid2.id).mentions[quid1.id];
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