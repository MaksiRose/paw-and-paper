// @ts-check
const { error_color } = require('../config.json');
const profileModel = require('../models/profileModel');

/**
 * Checks if there is an account and if the account has a name, returns false if they do, and if not, sends a message telling the user to create an account and return true.
 * @param {import('discord.js').Message} message
 * @param {import('../typedef').Character} characterData
 * @returns {Promise<boolean>}
 */
async function hasNoName(message, characterData) {

	if (!characterData || characterData?.name === '') {

		await message.channel
			.sendTyping()
			.catch((error) => {
				throw new Error(error);
			});

		const userData = /** @type {import('../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: message.author.id }));

		await message
			.reply({
				embeds: [{
					color: /** @type {`#${string}`} */ (error_color),
					title: 'Please type "rp name [name]" to begin setting up your account!',
					description: Object.keys(userData?.characters || {}).length > 0 ? 'I see that you already have a character. You can switch to it using `rp profile`! If you played the RPG on a different server, server-specific information like stats, levels, rank etc. will not transfer over to prevent cheating.' : null,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		return true;
	}

	return false;
}

/**
 * Checks if the account has a species, returns false if they do, and if not, sends a message telling the user to create an account and returns true.
 * @param {import('discord.js').Message} message
 * @param {import('../typedef').Character} characterData
 * @returns {Promise<boolean>}
 */
async function hasNoSpecies(message, characterData) {

	if (!characterData || characterData?.species === '') {

		await message.channel
			.sendTyping()
			.catch((error) => {
				throw new Error(error);
			});

		await message
			.reply({
				embeds: [{
					color: /** @type {`#${string}`} */ (error_color),
					title: `To access this command, you need to choose ${characterData.name}'s species!`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		return true;
	}

	return false;
}

/**
 * Checks if the user has a name and a species, returns false if they do, and if they don't, sends the appropriate message and returns true.
 * @param {import('discord.js').Message} message
 * @param {import('../typedef').Character} characterData
 * @returns {Promise<boolean>}
 */
async function hasNotCompletedAccount(message, characterData) {

	if (await hasNoName(message, characterData)) {
		return true;
	}

	if (await hasNoSpecies(message, characterData)) {

		return true;
	}

	return false;
}

module.exports = {
	hasNoName,
	hasNoSpecies,
	hasNotCompletedAccount,
};