// @ts-check
const { MessageEmbed } = require('discord.js');
const { hasNoName } = require('../../utils/checkAccountCompletion');
const { error_color } = require('../../config.json');

module.exports.name = 'proxy';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} profileData
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, profileData) => {

	/* Checking if the user has a name set. If they don't, it will send a message telling them to set a
	name. */
	if (await hasNoName(message, profileData)) {

		return;
	}

	const setDescription = 'This command is used to set a proxy for your character. That means that you set a certain set of characters (the proxy), and whenever you use this set of characters in a normal text message, your message will be replaced by one that has the name and avatar of this character. A proxy is set by putting the wanted character or set of characters in front of and/or behind the word "text". In a real message, "text" would be replaced by the text that you want the character to say.\n\nExamples:\n`rp proxy set <text>`\n`rp proxy set P: text`\n`rp proxy set text -p`\n\nThis is case-sensitive (meaning that upper and lowercase matters).';
	const alwaysDescription = 'This command is used to toggle whether you want every message that you sent to be replaced by one that has the name and avatar of this character.\nYou can either follow this up by the word "everywhere", which will replace every message you send anywhere in the server, or the mention of a channel, which will replace every message that you send in that channel.\nRepeating the command will toggle the setting off for that channel/for the server.\nIt remembers all the channels that you have set, even when you toggle "everywhere" on, meaning that when you toggle "everywhere" off again, it will continue to replace your messages in those channels that you have toggled it on for previously.';

	const subcommand = argumentsArray.splice(0, 1)[0];

	if (subcommand === 'set') {

		const proxy = argumentsArray.join(' ');

		if (proxy.includes('text')) {

			// set proxy
		}
		else {

			await message
				.reply({
					embeds: [ new MessageEmbed({
						color: /** @type {`#${string}`} */ (error_color),
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						title: 'Here is how to use the set subcommand:',
						description: setDescription,
					})],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
		}

		return;
	}

	if (subcommand === 'always') {

		const autoproxy = message.mentions.channels.size > 0 ? message.mentions.channels.first().id : argumentsArray.join(' ');

		if (message.mentions.channels.size > 0 || autoproxy.includes('everywhere')) {

			// add or remove autoproxy
		}
		else {

			await message
				.reply({
					embeds: [ new MessageEmbed({
						color: /** @type {`#${string}`} */ (error_color),
						author: { name: message.guild.name, icon_url: message.guild.iconURL() },
						title: 'Here is how to use the always subcommand:',
						description: alwaysDescription + `\n\nHere is a list of all the channels that you have turned this on for:\n${'I still need something here' || 'something else'}`,
					})],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
		}

		return;
	}

	await message
		.reply({
			embeds: [ new MessageEmbed({
				color: /** @type {`#${string}`} */ (error_color),
				author: { name: message.guild.name, icon_url: message.guild.iconURL() },
				title: 'This command has two subcommands. Here is how to use them:',
				fields: [
					{
						name: 'rp proxy set',
						value: setDescription,
					},
					{
						name: 'rp proxy always ["everywhere"/#channel]',
						value: alwaysDescription + '\n\nTo see a list of all the channels that you have turned this on for, type `rp proxy always` without anything after it.',
					},
				],
			})],
			failIfNotExists: false,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});


	// check if it is "set" and if they followed up with a text that contains the word "text". if they did, continue with that subcommand
	// the subcommand will set the current profiles proxy object to {text: (full text), beginsWith: (everything before "text"), endsWith: (everything after "text")}

	// check if it is "always" and if they followed up with either "everywhere" or the mention of a channel. if they did, continue with that subcommand
	// the subcommand will add or remove a value from the autoproxy array. just writing rp proxy always without a channel will list the values of the array.

	// if they didn't do either, send a message explaininng how the command works
};