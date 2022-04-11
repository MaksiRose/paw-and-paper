// @ts-check
const serverModel = require('../models/serverModel');
const { pronounAndPlural } = require('./getPronouns');
const { generateRandomNumber } = require('./randomizers');

/**
 * Sends message informing the user that the entrance is blocked off.
 * @param {import('discord.js').Message} message
 * @param {null | string} messageContent
 * @param {import('../typedef').ProfileSchema} profileData
 * @param {import('../typedef').ServerSchema} serverData
 * @param {'sleeping dens' | 'medicine den' | 'food den'} den
 * @returns
 */
async function blockEntrance(message, messageContent, profileData, serverData, den) {

	const possibleBlockages = ['vines', 'burrow', 'tree trunk', 'boulder'];
	const block = serverData.blockedEntranceObject.blockedKind === null ? possibleBlockages[generateRandomNumber(possibleBlockages.length, 0)] : serverData.blockedEntranceObject.blockedKind;

	if (serverData.blockedEntranceObject.den === null) {

		await serverModel.findOneAndUpdate(
			{ serverId: message.guild.id },
			{ $set: { blockedEntranceObject: { den: den, blockedKind: block } } },
		);
	}

	/** @type {null | string} */
	let blockText = null;
	if (block === 'vines') blockText = 'thick vines appear to have grown over';
	if (block === 'burrow') blockText = 'someone seems to have built a big burrow right under';
	if (block === 'tree trunk') blockText = 'a rotten tree trunk has fallen in front of';
	if (block === 'boulder') blockText = 'a boulder has rolled in front of';

	return await message
		.reply({
			content: messageContent,
			embeds: [{
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} is about to enter the ${den}, when ${pronounAndPlural(profileData, 0, 'notice')} that ${blockText} the entrance to the ${den}, making it impossible to enter safely. That will take a lot of strength to dispose of!*`,
			}],
			failIfNotExists: false,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});
}
module.exports = blockEntrance;