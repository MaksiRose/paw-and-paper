// @ts-check
const { MessageEmbed } = require('discord.js');
const { readFileSync, writeFileSync } = require('fs');

const requiredPoints = [1, 3, 6, 9, 15, 24, 39, 63, 99, 162];

/**
 * Creates a friendship or adds friendship points to an existing friendship. Sends a message if they have more hearts than before.
 * @param {import('discord.js').Message} message
 * @param {import('../typedef').ProfileSchema} profileData
 * @param {import('../typedef').ProfileSchema} partnerProfileData
 */
async function addFriendshipPoints(message, profileData, partnerProfileData) {

	/** @type {import('../typedef').FriendsList} */
	let friendshipList = JSON.parse(readFileSync('./database/friendshipList.json', 'utf-8'));

	/* Friendship-key and friendship are first initialized. If there is no key, an empty friendship is created. */
	let friendshipKey = getFriendshipKey(friendshipList, profileData, partnerProfileData);
	let friendship = friendshipKey !== null ? friendshipList[friendshipKey] : { [profileData.uuid]: [], [partnerProfileData.uuid]: [] };

	/* Based on current friendship, the friendship points are calculated. */
	const previousFriendshipPoints = getFriendshipPoints(friendship[profileData.uuid], friendship[partnerProfileData.uuid]);

	/* This mention is being pushed to the friendship, and the friendship is pushed to the friendship list. */
	friendship[profileData.uuid].push(message.createdTimestamp);
	friendshipList[friendshipKey !== null ? friendshipKey : `${profileData.uuid}_${partnerProfileData.uuid}`] = friendship;

	/* The friendship list is saved, and then updated to remove old mentions. The old mentions are only removed now, because they need to count towards the previous friendship points. As far as the user is concerned, that was the last existing state of the friendship. */
	writeFileSync('./database/friendshipList.json', JSON.stringify(friendshipList, null, '\t'));
	friendshipList = checkOldMentions(profileData, partnerProfileData);

	/* The friendship-key is grabbed again in case it was just created and was null before, as well as the friendship being checked again since it might've changed from the updated friendshipList that excludes old mentions. Based on this updated friendship, the new friendship points are calculated. */
	friendshipKey = getFriendshipKey(friendshipList, profileData, partnerProfileData);
	friendship = friendshipKey !== null ? friendshipList[friendshipKey] : { [profileData.uuid]: [], [partnerProfileData.uuid]: [] };
	const newFriendshipPoints = getFriendshipPoints(friendship[profileData.uuid], friendship[partnerProfileData.uuid]);

	/* A message is sent to the users if the friendship has more hearts now than it had before. */
	if (getFriendshipHearts(previousFriendshipPoints) < getFriendshipHearts(newFriendshipPoints)) {

		await message.channel
			.send({
				embeds: [new MessageEmbed({
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					title: `The friendship between ${profileData.name} and ${partnerProfileData.name} grew 💗`,
					description: '❤️'.repeat(getFriendshipHearts(newFriendshipPoints)) + '🖤'.repeat(10 - getFriendshipHearts(newFriendshipPoints)),
					footer: { text: getFriendshipHearts(newFriendshipPoints) === 6 ? 'You can now adventure together using the "adventure" command!' : null },
				})],
			})
			.catch((newError) => { throw new Error(newError); });
	}
}

/**
 * Checks if any mentions stored in a friendship are older than a week, and if they are, remove them.
 * @param {import('../typedef').ProfileSchema} profileData
 * @param {import('../typedef').ProfileSchema} partnerProfileData
 * @returns {import('../typedef').FriendsList}
 */
function checkOldMentions(profileData, partnerProfileData) {

	/** @type {import('../typedef').FriendsList} */
	const friendshipList = JSON.parse(readFileSync('./database/friendshipList.json', 'utf-8'));

	const friendshipKey = getFriendshipKey(friendshipList, profileData, partnerProfileData);
	const friendship = friendshipKey !== null ? friendshipList[friendshipKey] : { [profileData.uuid]: [], [partnerProfileData.uuid]: [] };

	for (const key of Object.keys(friendship)) {

		friendship[key] = friendship[key].filter(mentionTimestamp => mentionTimestamp > Date.now() - 604800000);
	}

	friendshipList[friendshipKey !== null ? friendshipKey : `${profileData.uuid}_${partnerProfileData.uuid}`] = friendship;

	writeFileSync('./database/friendshipList.json', JSON.stringify(friendshipList, null, '\t'));

	return friendshipList;
}

/**
 * Finds a friendship key in the friendship list and returns it. If
 * @param {import('../typedef').FriendsList} friendshipList
 * @param {import('../typedef').ProfileSchema} profileData
 * @param {import('../typedef').ProfileSchema} partnerProfileData
 * @returns {string | null}
 */
function getFriendshipKey(friendshipList, profileData, partnerProfileData) {

	return Object.hasOwn(friendshipList, `${profileData.uuid}_${partnerProfileData.uuid}`) ? `${profileData.uuid}_${partnerProfileData.uuid}` : Object.hasOwn(friendshipList, `${partnerProfileData.uuid}_${profileData.uuid}`) ? `${partnerProfileData.uuid}_${profileData.uuid}` : null;
}

/**
 * Calculates the amount of points a friendship has an returns it.
 * @param {Array<number>} array1
 * @param {Array<number>} array2
 * @returns {number}
 */
function getFriendshipPoints(array1, array2) {

	const higherPoints = array1?.length >= array2?.length ? array1?.length : array2?.length;
	const lowerPoints = array1?.length < array2?.length ? array1?.length : array2?.length;

	return (lowerPoints * 3) + (higherPoints - lowerPoints) || 0;
}

/**
 * Checks how many hearts a friendship has based on its points and returns the amount of hearts
 * @param {number} points
 * @returns {number}
 */
function getFriendshipHearts(points) {

	for (let index = requiredPoints.length - 1; index >= 0; index--) {

		if (requiredPoints[index] <= points) {

			return index + 1;
		}
	}

	return 0;
}

module.exports = {
	addFriendshipPoints,
	checkOldMentions,
	getFriendshipKey,
	getFriendshipPoints,
	getFriendshipHearts,
};