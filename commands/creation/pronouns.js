const config = require('../../config.json');
const profileModel = require('../../models/profileModel');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const startCooldown = require('../../utils/startCooldown');

module.exports = {
	name: 'pronouns',
	async sendMessage(client, message, argumentsArray, profileData) {

		if (await hasNotCompletedAccount(message, profileData)) {

			return;
		}

		profileData = await startCooldown(message, profileData);

		const pronounSets = argumentsArray.join(' ').replace(/\/ /g, '/').replace(/ \//g, '/').split(' & ');

		for (let index = pronounSets.length - 1; index >= 0; index--) {

			if (pronounSets[index] === 'none') {

				pronounSets[index] = `${profileData.name}/${profileData.name}/${profileData.name}'s/${profileData.name}'s/${profileData.name}/singular`;
			}

			pronounSets[index] = pronounSets[index].split('/');

			if (pronounSets[index].length !== 6 || (pronounSets[index][5] !== 'singular' && pronounSets[index][5] !== 'plural')) {

				pronounSets.splice(index, 1);
				continue;
			}

			for (const pronoun of pronounSets[index]) {

				if (pronoun.length > 25) {

					return await message
						.reply({
							embeds: [{
								color: config.error_color,
								author: { name: message.guild.name, icon_url: message.guild.iconURL() },
								title: 'The longest pronoun can only be up to 25 characters long.',
							}],
							failIfNotExists: false,
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});
				}
			}
		}

		if (pronounSets.length > 0) {

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { pronounSets: pronounSets } },
			);

			return await message
				.reply({
					embeds: [{
						color: profileData.color,
						author: { name: `${message.guild.name}`, icon_url: message.guild.iconURL() },
						title: `You set ${profileData.name}'s pronouns to ${pronounSets.map(pronounSet => `${pronounSet[0]}/${pronounSet[1]} (${pronounSet[2]}/${pronounSet[3]}/${pronounSet[4]})`).join(' and ')}!`,
					}],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		return await message
			.reply({
				embeds: [{
					color: config.default_color,
					author: { name: `${message.guild.name}`, icon_url: message.guild.iconURL() },
					title: 'Use this command to set the pronouns of your character. Caution: you can only have one set of pronouns. Here is how to use it:',
					description: '\n\nrp pronouns [subject pronoun]/[object pronoun]/[possessive adjective]/[possessive pronoun] [reflexive pronoun]/[singular/plural]\n**The brackets are just for readability, don\'t type them out in the command! Make sure though to use "/" to separate each pronoun.**\n\nReplace the fields with the desired pronouns. If you want several sets of pronouns, separate the sets with an `&`.\n\n*Examples:*\nrp pronouns she/her/her/hers/herself/singular\nrp pronouns he/him/his/his/himself/singular\nrp pronouns they/them/their/theirs/themselves/plural & it/its/its/its/itself/singular\n\n*Examples in sentences:*\n**They** are in the car.\nI am with **them**.\nThis is **their** car.\nThe car is **theirs**.\nThey bought it for **themselves**.\nSingular/Plural is for the verbs following the pronouns, so "they **are**" versus "he/she **is**".',
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});
	},
};