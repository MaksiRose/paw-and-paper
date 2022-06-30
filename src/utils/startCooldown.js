// @ts-check
const profileModel = require('../models/profileModel');

/**
 * Sets `hasCooldown` for an account to `true`.
 * @param {import('discord.js').Message} message
 * @returns {Promise<import('../typedef').ProfileSchema>} userData
 */
async function startCooldown(message) {

	return /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
		{ userId: message.author.id },
		(/** @type {import('../typedef').ProfileSchema} */ p) => {
			if (message.inGuild() && p?.characters?.[p?.currentCharacter?.[message.guild.id]]?.profiles?.[message.guild.id]?.hasCooldown !== undefined) {
				p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].hasCooldown = true;
			}
		},
	));
}

module.exports = startCooldown;