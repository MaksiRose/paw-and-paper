// @ts-check
const { MessageEmbed } = require('discord.js');
const profileModel = require('../models/profileModel');

const requiredPoints = [1, 3, 6, 9, 15, 24, 39, 63, 99, 162];

/**
 * Creates a friendship or adds friendship points to an existing friendship. Sends a message if they have more hearts than before.
 * @param {import('discord.js').Message} message
 * @param {import('../typedef').ProfileSchema} userData
 * @param {string} characterId
 * @param {import('../typedef').ProfileSchema} partnerUserData
 * @param {string} partnerCharacterId
 */
async function addFriendshipPoints(message, userData, characterId, partnerUserData, partnerCharacterId) {

	let characterData = userData.characters[characterId];
	let partnerCharacterData = partnerUserData.characters[partnerCharacterId];

	/* Based on current friendship, the friendship points are calculated. */
	const previousFriendshipPoints = getFriendshipPoints(characterData.mentions[partnerCharacterId], partnerCharacterData.mentions[characterId]);

	/* It's updating the database with the new mention, and then grabbing the updated data from the
	database. */
	userData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
		{ uuid: userData.uuid },
		(/** @type {import('../typedef').ProfileSchema} */ p) => {
			if (p.characters[characterId].mentions[partnerCharacterId] === undefined) {
				p.characters[characterId].mentions[partnerCharacterId] = [message.createdTimestamp];
			}
			else { p.characters[characterId].mentions[partnerCharacterId].push(message.createdTimestamp); }
		},
	));

	[userData, partnerUserData] = await checkOldMentions(userData, characterData._id, partnerUserData, partnerCharacterData._id);
	characterData = userData.characters[characterId];
	partnerCharacterData = partnerUserData.characters[partnerCharacterId];
	const newFriendshipPoints = getFriendshipPoints(characterData.mentions[partnerCharacterId], partnerCharacterData.mentions[characterId]);

	/* A message is sent to the users if the friendship has more hearts now than it had before. */
	if (getFriendshipHearts(previousFriendshipPoints) < getFriendshipHearts(newFriendshipPoints)) {

		await message.channel
			.send({
				embeds: [new MessageEmbed({
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					title: `The friendship between ${characterData.name} and ${partnerCharacterData.name} grew 💗`,
					description: '❤️'.repeat(getFriendshipHearts(newFriendshipPoints)) + '🖤'.repeat(10 - getFriendshipHearts(newFriendshipPoints)),
					footer: { text: getFriendshipHearts(newFriendshipPoints) === 6 ? 'You can now adventure together using the "adventure" command!' : null },
				})],
			})
			.catch((newError) => { throw new Error(newError); });
	}
}

/**
 * Checks if any mentions stored in a friendship are older than a week, and if they are, remove them.
 * @param {import('../typedef').ProfileSchema} userData
 * @param {string} characterId
 * @param {import('../typedef').ProfileSchema} partnerUserData
 * @param {string} partnerCharacterId
 * @returns {Promise<Array<import('../typedef').ProfileSchema>>}
 */
async function checkOldMentions(userData, characterId, partnerUserData, partnerCharacterId) {

	userData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
		{ uuid: userData.uuid },
		(/** @type {import('../typedef').ProfileSchema} */ p) => {
			if (p.characters[characterId].mentions[partnerCharacterId] !== undefined) {
				p.characters[characterId].mentions[partnerCharacterId] = p.characters[characterId].mentions[partnerCharacterId].filter(ts => ts > Date.now() - 604800000);
			}
		},
	));

	partnerUserData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
		{ uuid: partnerUserData.uuid },
		(/** @type {import('../typedef').ProfileSchema} */ p) => {
			if (p.characters[partnerCharacterId].mentions[characterId] !== undefined) {
				p.characters[partnerCharacterId].mentions[characterId] = p.characters[partnerCharacterId].mentions[characterId].filter(ts => ts > Date.now() - 604800000);
			}
		},
	));

	return [userData, partnerUserData];
}

/**
 * Calculates the amount of points a friendship has an returns it.
 * @param {Array<number>} array1
 * @param {Array<number>} array2
 * @returns {number}
 */
function getFriendshipPoints(array1, array2) {

	if (!Array.isArray(array1)) { array1 = []; }
	if (!Array.isArray(array2)) { array2 = []; }

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
	getFriendshipPoints,
	getFriendshipHearts,
};