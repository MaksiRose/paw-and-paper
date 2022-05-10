// @ts-check
const profileModel = require('../../models/profileModel');
const { default_color } = require('../../config.json');
const { hasNoName } = require('../../utils/checkAccountCompletion');
const { readFileSync, writeFileSync } = require('fs');

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

	const characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];

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
					color: /** @type {`#${string}`} */ (default_color),
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
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
				p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].experience += 1;
				p.characters[p.currentCharacter[message.guild.id]].profiles[message.guild.id].currentRegion = 'ruins';
			},
		);
	}

	/** @type {import('../../typedef').WebhookMessages} */
	const webhookCache = JSON.parse(readFileSync('./database/webhookCache.json', 'utf-8'));
	/** @type {Array<import('discord.js').MessageEmbedOptions>} */
	let embeds = [];

	if (message.reference !== null) {

		const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);

		if (webhookCache[referencedMessage.id] !== undefined) {

			const user = await client.users.fetch(webhookCache[referencedMessage.id]);
			referencedMessage.author = user;
		}

		embeds = [{
			author: { name: referencedMessage.member.displayName, icon_url: referencedMessage.member.displayAvatarURL() },
			color: referencedMessage.member.displayColor,
			description: referencedMessage.content,
		}];
	}

	const botMessage = await webHook
		.send({
			username: `${characterData.name} (${message.author.tag})`,
			avatarURL: characterData.avatarURL,
			content: userText || undefined,
			files: Array.from(message.attachments.values()) || undefined,
			embeds: embeds,
		})
		.catch((error) => { throw new Error(error); });

	webhookCache[botMessage.id] = message.author.id;

	writeFileSync('./database/webhookCache.json', JSON.stringify(webhookCache, null, '\t'));

	return;
};