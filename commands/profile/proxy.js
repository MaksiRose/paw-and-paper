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
 * @param {import('../../typedef').ProfileSchema} userData
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData) => {

	const characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];

	/* Checking if the user has a name set. If they don't, it will send a message telling them to set a
	name. */
	if (await hasNoName(message, characterData)) {

		return;
	}

	const setDescription = 'Proxying is a way to speak as if your character was saying it. The proxy is an indicator to the bot you want your message to be proxied. You can set your proxy by putting the indicator around the word "text". In a message, "text" would be replaced by whatever you want your character to say.\n\nExamples:\n`rp proxy set <text>`\n`rp proxy set P: text`\n`rp proxy set text -p`\nThis is case-sensitive (meaning that upper and lowercase matters).';
	const alwaysDescription = 'When this feature is enabled, every message you sent will be treated as if it was proxied, even if the proxy isn\'t included.\nYou can either toggle it for the entire server (by adding the word "everywhere" to the command), or just one channel (by mentioning the channel). Repeating the command will toggle the feature off again for that channel/for the server.\n\nSo it\'s either `rp proxy always everywhere` or `rp proxy always #channel`.';

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
};