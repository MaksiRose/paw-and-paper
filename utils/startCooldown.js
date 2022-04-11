// @ts-check
const { profileModel } = require('../models/profileModel');

/**
 * Sets `hasCooldown` for an account to `true`.
 * @param {import('discord.js').Message} message
 * @param {import('../typedef').ProfileSchema} profileData
 * @returns {Promise<import('../typedef').ProfileSchema>} profileData
 */
async function startCooldown(message, profileData) {

	if (profileData.hasCooldown !== true) {

		profileData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { hasCooldown: true } },
		));
	}

	return profileData;
}

module.exports = startCooldown;