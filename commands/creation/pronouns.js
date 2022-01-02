const config = require('../../config.json');
const profileModel = require('../../models/profileSchema');
const checkAccountCompletion = require('../../utils/checkAccountCompletion');

module.exports = {
	name: 'pronouns',
	async sendMessage(client, message, argumentsArray, profileData) {

		if (await checkAccountCompletion.hasNotCompletedAccount(message, profileData)) {

			return;
		}

		argumentsArray = await argumentsArray.join(' ').replace(/\/ /g, '/').replace(/ \//g, '/').split('/');
		const [subjectPronoun, objectPronoun, possessiveAdjective, possessivePronoun, reflexivePronoun, pronounNumber] = argumentsArray.map(arg => arg.toLowerCase());

		if (argumentsArray.length == 6 && (pronounNumber == 'plural' || pronounNumber == 'singular')) {
			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { pronounArray: [subjectPronoun, objectPronoun, possessiveAdjective, possessivePronoun, reflexivePronoun, pronounNumber] } },
				{ upsert: true, new: true },
			);

			return await message.reply({
				embeds: [{
					color: config.default_color,
					author: { name: `${message.guild.name}`, icon_url: message.guild.iconURL() },
					title: `You set ${profileData.name}'s pronouns to ${subjectPronoun}/${objectPronoun}/${possessiveAdjective}/${possessivePronoun}/${reflexivePronoun} (${pronounNumber})!`,
				}],
			});
		}

		return await message.reply({
			embeds: [{
				color: config.default_color,
				author: { name: `${message.guild.name}`, icon_url: message.guild.iconURL() },
				title: 'Use this command to set the pronouns of your character. Caution: you can only have one set of pronouns. Here is how to use it:',
				description: '\n\nrp pronouns [subject pronoun]/[object pronoun]/[possessive adjective]/[possessive pronoun] [reflexive pronoun]/[singular/plural]\n**The brackets are just for readability, don\'t type them out in the command! Make sure though to use "/" to separate each pronoun.**\n\nReplace the fields with the desired pronouns.\n\n*Examples:*\nrp pronouns they/them/their/theirs/themselves/plural\nrp pronouns she/her/her/hers/herself/singular\nrp pronouns he/him/his/his/himself/singular\n\n*Examples in sentences:*\n**They** are in the car.\nI am with **them**.\nThis is **their** car.\nThe car is **theirs**.\nThey bought it for **themselves**.\nSingular/Plural is for the verbs following the pronouns, so "they **are**" versus "he/she **is**".',
			}],
		});
	},
};