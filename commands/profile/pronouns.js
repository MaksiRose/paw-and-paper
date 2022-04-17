// @ts-check
const { error_color, default_color } = require('../../config.json');
const { profileModel } = require('../../models/profileModel');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const startCooldown = require('../../utils/startCooldown');

module.exports.name = 'pronouns';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} profileData
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, profileData) => {

	if (await hasNotCompletedAccount(message, profileData)) {

		return;
	}

	profileData = await startCooldown(message, profileData);

	const pronounList = argumentsArray.join(' ').replace(/\/ /g, '/').replace(/ \//g, '/').split(' & ');
	/** @type {Array<Array<string>>} */
	const pronounSets = [];

	for (let index = pronounList.length - 1; index >= 0; index--) {

		if (pronounList[index] === 'none') {

			pronounList[index] = `${profileData.name}/${profileData.name}/${profileData.name}'s/${profileData.name}'s/${profileData.name}/singular`;
		}

		pronounSets[index] = pronounList[index].split('/');

		if (pronounSets[index].length !== 6 || (pronounSets[index][5] !== 'singular' && pronounSets[index][5] !== 'plural')) {

			pronounSets.splice(index, 1);
			continue;
		}

		for (const pronoun of pronounSets[index]) {

			if (pronoun.length > 25) {

				await message
					.reply({
						embeds: [{
							color: /** @type {`#${string}`} */ (error_color),
							author: { name: message.guild.name, icon_url: message.guild.iconURL() },
							title: 'The longest pronoun can only be up to 25 characters long.',
						}],
						failIfNotExists: false,
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
				return;
			}
		}
	}

	if (pronounSets.length > 0) {

		await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { pronounSets: pronounSets } },
		);

		await message
			.reply({
				embeds: [{
					color: profileData.color,
					author: { name: `${message.guild.name}`, icon_url: message.guild.iconURL() },
					title: `You set ${profileData.name}'s pronouns to ${pronounSets.map(pronounSet => `${pronounSet[0]}/${pronounSet[1]} (${pronounSet[2]}/${pronounSet[3]}/${pronounSet[4]})`).join(' and ')}!`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	await message
		.reply({
			embeds: [{
				color: /** @type {`#${string}`} */ (default_color),
				author: { name: `${message.guild.name}`, icon_url: message.guild.iconURL() },
				title: 'Use this command to set the pronouns of your character. Here is how to use it:',
				description: '__*Examples:*__\nrp pronouns she/her/her/hers/herself/singular\nrp pronouns he/him/his/his/himself/singular\nrp pronouns they/them/their/theirs/themselves/plural & it/its/its/its/itself/singular\nrp pronouns none\n\n__*Examples in sentences:*__\n**They** are in the car.\nI am with **them**.\nThis is **their** car.\nThe car is **theirs**.\nThey bought it for **themselves**.\nSingular/Plural is for the verbs following the pronouns, so "they **are**" (plural) versus "he/she **is**" (singular).',
				footer: { text: 'Formal usage: rp pronouns [none OR subject pronoun/object pronoun/possessive adjective/possessive pronoun/reflexive pronoun/singular OR plural] & (optional additional sets of pronouns)\n\nThe brackets are just for readability, don\'t type them out in the command! Make sure though to use "/" to separate each pronoun AND the singular/plural.' },
			}],
			failIfNotExists: false,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});
	return;
};
