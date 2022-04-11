// @ts-check
/** @type {Map<string, NodeJS.Timeout>} */
const restingTimeoutMap = new Map();
const { profileModel } = require('../models/profileModel');
const { pronounAndPlural } = require('./getPronouns');

/**
	 * Clears the timeout of the specific user that is resting.
	 * @param {string} userId
	 * @param {string} guildId
	 */
function stopResting(userId, guildId) {

	clearTimeout(restingTimeoutMap.get('nr' + userId + guildId));
}

/**
	 * Starts a Timeout that gives the user one energy point every 30 seconds.
	 * @param {import('discord.js').Message} message
	 * @param {import('../typedef').ProfileSchema} profileData
	 * @param {import('discord.js').Message} botReply
	 */
async function startResting(message, profileData, botReply) {

	let energyPoints = 0;
	restingTimeoutMap.set('nr' + message.author.id + message.guild.id, setTimeout(addEnergy, 30000));

	/**
		 * Gives the user an energy point, checks if they reached the maximum, and create a new Timeout if they didn't.
		 * @returns {Promise<void>}
		 */
	async function addEnergy() {

		energyPoints += 1;

		profileData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $inc: { energy: 1 } },
		));

		botReply.embeds[0].footer.text = `+${energyPoints} energy (${profileData.energy}/${profileData.maxEnergy})${(profileData.currentRegion != 'sleeping dens') ? '\nYou are now at the sleeping dens' : ''}`;

		await botReply
			.edit({
				embeds: botReply.embeds,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		if (profileData.energy >= profileData.maxEnergy) {

			await message.channel
				.sendTyping()
				.catch((error) => {
					throw new Error(error);
				});

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { isResting: false } },
			);

			await botReply
				.delete()
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			await message
				.reply({
					embeds: [{
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: `*${profileData.name}'s eyes blink open, ${pronounAndPlural(profileData, 0, 'sit')} up to stretch and then walk out into the light and buzz of late morning camp. Younglings are spilling out of the nursery, ambitious to start the day, Hunters and Healers are traveling in and out of the camp border. It is the start of the next good day!*`,
					}],
					allowedMentions: {
						repliedUser: true,
					},
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		restingTimeoutMap.set('nr' + message.author.id + message.guild.id, setTimeout(addEnergy, 30000));
		return;
	}
}

module.exports = {
	stopResting,
	startResting,
};