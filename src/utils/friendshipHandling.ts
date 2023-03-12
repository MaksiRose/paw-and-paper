import { generateId } from 'crystalid';
import { ChannelType, EmbedBuilder, TextBasedChannel } from 'discord.js';
import { Op } from 'sequelize';
import Friendship from '../models/friendship';
import Quid from '../models/quid';
import { getDisplayname } from './getQuidInfo';
import { deepCopy, now } from './helperFunctions';

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
	displaynameOptions: Parameters<typeof getDisplayname>[1],
): Promise<void> {

	let friendship = await Friendship.findOne({
		where: {
			quidId1: { [Op.in]: [quid1.id, quid2.id] },
			quidId2: { [Op.in]: [quid1.id, quid2.id] },
		},
	});
	if (!friendship) {
		friendship = await Friendship.create({ id: generateId(), quidId1: quid1.id, quidId2: quid2.id });
	}

	/* Based on current friendship, the friendship points are calculated. */
	const previousFriendshipPoints = getFriendshipPoints(friendship.quid1_mentions, friendship.quid2_mentions);

	/* It's updating the database with the new mention, and then grabbing the updated data from the database. */
	checkOldMentions(friendship);

	// MAKE SURE TO NOT CHANGE THIS CODE! sequelize is janky, man. You need to deepCopy the array before pushing to it
	const quidMentions = quid1.id === friendship.quidId1 ? 'quid1_mentions' : 'quid2_mentions';
	const newMentionsArr = deepCopy(friendship[quidMentions]);
	newMentionsArr.push(Math.round(message.createdTimestamp / 1000));
	await friendship.update({ [quidMentions]: newMentionsArr }, { logging: false });

	const newFriendshipPoints = getFriendshipPoints(friendship.quid1_mentions, friendship.quid2_mentions);

	/* A message is sent to the users if the friendship has more hearts now than it had before. */
	const newFriendshipHearts = getFriendshipHearts(newFriendshipPoints);
	if (getFriendshipHearts(previousFriendshipPoints) < newFriendshipHearts) {
		if (message.channel.type === ChannelType.GuildStageVoice) { throw new Error('discord.js is janky'); }

		await message.channel
			.send({ // Because of this, everything that calls addFriendshipPoints needs to be permission guarded
				embeds: [new EmbedBuilder()
					.setColor(quid1.color)
					.setAuthor({
						name: await getDisplayname(quid1, displaynameOptions),
						iconURL: quid1.avatarURL,
					})
					.setTitle(`The friendship between ${quid1.name} and ${quid2.name} grew 💗`)
					.setDescription('❤️'.repeat(newFriendshipHearts) + '🖤'.repeat(10 - newFriendshipHearts))
					.setFooter(newFriendshipHearts === 6 ? { text: 'You can now adventure together using the "adventure" command!' } : null)],
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
	friendship: Friendship,
): Promise<void> {

	const oneWeekInS = 604_800;
	friendship.quid1_mentions = friendship.quid1_mentions.filter(ts => ts > (now() - oneWeekInS));
	friendship.quid2_mentions = friendship.quid2_mentions.filter(ts => ts > (now() - oneWeekInS));
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