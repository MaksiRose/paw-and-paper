// @ts-check
const { error_color } = require('../config.json');
const { profileModel, otherProfileModel } = require('../models/profileModel');

/**
 * Checks if there is an account and if the account has a name, returns false if they do, and if not, sends a message telling the user to create an account and return true.
 * @param {import('discord.js').Message} message
 * @param {import('../typedef').ProfileSchema} profileData
 * @returns {Promise<boolean>}
 */
async function hasNoName(message, profileData) {

	if (!profileData || profileData?.name === '') {

		await message.channel
			.sendTyping()
			.catch((error) => {
				throw new Error(error);
			});

		const allAccounts = [
			.../** @type {Array<import('../typedef').ProfileSchema>} */ (await profileModel.find({ userId: message.author.id, serverId: { $nin: [message.guild.id] } })),
			.../** @type {Array<import('../typedef').ProfileSchema>} */ (await otherProfileModel.find({ userId: message.author.id, serverId: { $nin: [message.guild.id] } })),
		];

		await message
			.reply({
				embeds: [{
					color: /** @type {`#${string}`} */ (error_color),
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: 'Please type "rp name [name]" to begin setting up your account!',
					description: allAccounts.length > 0 ? 'I see that you already have a profile on another server. You can copy it over using `rp copy`!' : null,
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
 * @param {import('../typedef').ProfileSchema} profileData
 * @returns {Promise<boolean>}
 */
async function hasNoSpecies(message, profileData) {

	if (!profileData || profileData?.species === '') {

		await message.channel
			.sendTyping()
			.catch((error) => {
				throw new Error(error);
			});

		await message
			.reply({
				embeds: [{
					color: /** @type {`#${string}`} */ (error_color),
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: `Please choose ${profileData.name}'s species!!`,
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
 * @param {import('../typedef').ProfileSchema} profileData
 * @returns {Promise<boolean>}
 */
async function hasNotCompletedAccount(message, profileData) {

	if (await hasNoName(message, profileData)) {
		return true;
	}

	if (await hasNoSpecies(message, profileData)) {

		return true;
	}

	return false;
}

module.exports = {
	hasNoName,
	hasNoSpecies,
	hasNotCompletedAccount,
};