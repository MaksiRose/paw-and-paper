// @ts-check
const profileModel = require('../../models/profileModel');
const { error_color } = require('../../config.json');
const { hasNoName } = require('../../utils/checkAccountCompletion');
const { readFileSync, writeFileSync } = require('fs');
const sendNoDM = require('../../utils/sendNoDM');

module.exports.name = 'say';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {import('../../typedef').ServerSchema} serverData
 * @param {Array<import('discord.js').MessageEmbedOptions>} embedArray
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData, serverData, embedArray) => {

	if (await sendNoDM(message)) {

		return;
	}

	/** the userData.currentCharacter gets modified in messageCreate if the proxy is from an inactive account.
	 * It is not permanently saved though, making the account practically still inactive. */
	const characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild?.id]];

	if (await hasNoName(message, characterData)) {

		return;
	}

	const webHook = (await /** @type {import('discord.js').TextChannel} */ (message.channel)
		.fetchWebhooks()
		.catch((error) => {
			if (error.httpStatus === 403) {
				message.channel.send({ content: 'Please give me permission to create webhooks 😣' }).catch((err) => { throw new Error(err); });
			}
			throw new Error(error);
		})
	).find(webhook => webhook.name === 'PnP Profile Webhook') || await /** @type {import('discord.js').TextChannel} */ (message.channel)
		.createWebhook('PnP Profile Webhook')
		.catch((error) => {
			if (error.httpStatus === 403) {
				message.channel.send({ content: 'Please give me permission to create webhooks 😣' }).catch((err) => { throw new Error(err); });
			}
			throw new Error(error);
		});

	const userText = argumentsArray.join(' ');

	if (!userText) {

		await message
			.reply({
				embeds: [...embedArray, {
					color: /** @type {`#${string}`} */ (error_color),
					title: 'This is a way for you to send a message as though it was coming from your character, with their name and avatar. Here is how to use the command:',
					description: '\n\nrp say "text"\nReplace "text" with your text.',
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	message
		.delete()
		.catch((error) => {
			if (error.httpStatus !== 404) {
				throw new Error(error);
			}
		});

	if (characterData.profiles[message.guild.id] !== undefined) {

		await profileModel.findOneAndUpdate(
			{ uuid: userData.uuid },
			(/** @type {import('../../typedef').ProfileSchema} */ p) => {
				p.characters[characterData._id].profiles[message.guild.id].experience += 1;
				p.characters[characterData._id].profiles[message.guild.id].currentRegion = 'ruins';
			},
		);
	}

	/** @type {import('../../typedef').WebhookMessages} */
	const webhookCache = JSON.parse(readFileSync('./database/webhookCache.json', 'utf-8'));
	/** @type {Array<import('discord.js').MessageEmbedOptions>} */
	let embeds = [];

	if (message.reference !== null) {

		const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
		const member = referencedMessage.member;
		const user = referencedMessage.author;

		embeds = [{
			author: { name: member?.displayName || user.username, icon_url: member?.displayAvatarURL() || user.avatarURL() },
			color: member?.displayColor || user.accentColor || 'WHITE',
			description: referencedMessage.content,
		}];
	}

	const botMessage = await webHook
		.send({
			username: characterData.name,
			avatarURL: characterData.avatarURL,
			content: userText || undefined,
			files: Array.from(message.attachments.values()) || undefined,
			embeds: embeds,
		})
		.catch((error) => { throw new Error(error); });

	webhookCache[botMessage.id] = message.author.id + (characterData?._id !== undefined ? `_${characterData?._id}` : '');

	writeFileSync('./database/webhookCache.json', JSON.stringify(webhookCache, null, '\t'));

	return;
};