const serverModel = require('../models/serverModel');
const { generateRandomNumber } = require('./randomizers');

module.exports = async (message, messageContent, profileData, den) => {

	const possibleBlockages = ['vines', 'burrow', 'tree trunk', 'boulder'];
	const block = possibleBlockages[generateRandomNumber(possibleBlockages.length, 0)];

	await serverModel.findOneAndUpdate(
		{ serverId: message.guild.id },
		{ $set: { blockedEntranceObject: { den: den, blockedKind: block } } },
	);

	return await message
		.reply({
			content: messageContent,
			embeds: [{
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `${profileData.name} wants to enter the ${den} but the entrance is blocked. Someone needs to dispose of the ${block}! PLACEHOLDER`,
			}],
			failIfNotExists: false,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) {
				throw new Error(error);
			}
		});
};