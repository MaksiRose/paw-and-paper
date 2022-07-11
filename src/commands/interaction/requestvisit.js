// @ts-check
const { hasName } = require('../../utils/checkAccountCompletion');
const serverModel = require('../../models/serverModel');
const profileModel = require('../../models/profileModel');
const { error_color, default_color, prefix } = require('../../../config.json');
const { pronounAndPlural, pronoun, upperCasePronounAndPlural, upperCasePronoun } = require('../../utils/getPronouns');
const { readFileSync, writeFileSync } = require('fs');
const { MessageActionRow, MessageSelectMenu, MessageButton, MessageEmbed } = require('discord.js');
const disableAllComponents = require('../../utils/disableAllComponents');
const isInGuild = require('../../utils/isInGuild');

module.exports.name = 'requestvisit';
module.exports.aliases = ['visit'];

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} userDataV
 * @param {import('../../typedef').ServerSchema} serverDataV
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userDataV, serverDataV) => {

	if (!isInGuild(message)) {

		return;
	}

	const characterDataV = userDataV?.characters?.[userDataV?.currentCharacter?.[message.guild.id]];

	if (!hasName(message, characterDataV)) {

		return;
	}

	if (serverDataV.visitChannelId === null) {

		await message
			.reply({
				embeds: [{
					color: /** @type {`#${string}`} */ (error_color),
					title: 'Visits are currently turned off! Ask a server admin to turn it on via \'rp allowvisits\'',
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	if (serverDataV.currentlyVisiting !== null) {

		await message
			.reply({
				embeds: [{
					color: /** @type {`#${string}`} */ (error_color),
					title: 'You are already visiting someone!',
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	let visitableServers = /** @type {Array<import('../../typedef').ServerSchema>} */ (await serverModel.find(
		(/** @type {import('../../typedef').ServerSchema} */ s) => {
			return s.serverId !== message.guild.id && s.visitChannelId !== null && s.currentlyVisiting === null;
		}));

	if (visitableServers.length <= 0) {

		await message
			.reply({
				embeds: [{
					color: /** @type {`#${string}`} */ (error_color),
					description: `*${characterDataV.name} really wants to visit some packs in the area but no one there seems to have time. The ${characterDataV.displayedSpecies || characterDataV.species} gets back feeling a bit lonely but when ${pronounAndPlural(characterDataV, 0, 'see')} all ${pronoun(characterDataV, 2)} packmates having fun at home ${characterDataV.name} cheers up and joins them excitedly.*`,
				}],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	let packPage = 0;
	let selectMenuOptionsArray = getMenuOptions(visitableServers, packPage, []);

	let botReplyV = await message
		.reply({
			embeds: [{
				color: /** @type {`#${string}`} */ (default_color),
				author: { name: message.guild.name, icon_url: message.guild.iconURL() || undefined },
				description: `*${characterDataV.name} is looking to meet some new friends. There are other packs in the area. Who should ${pronoun(characterDataV, 0)} visit?*`,
			}],
			components: [ new MessageActionRow({
				components: [ new MessageSelectMenu({
					customId: 'visit-options',
					placeholder: 'Select a pack',
					options: selectMenuOptionsArray,
				})],
			})],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	/** @type {import('discord.js').Message} */
	let botReplyH;

	interactionCollector();

	async function interactionCollector() {

		let filter = async (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.user.id === message.author.id;

		/** @type {import('discord.js').MessageComponentInteraction | null} } */
		const interaction = await botReplyV
			.awaitMessageComponent({ filter, time: 300_000 })
			.catch(() => { return null; });

		if (interaction === null || !interaction.inCachedGuild() || !interaction.isSelectMenu()) {

			return await botReplyV
				.edit({
					components: disableAllComponents(botReplyV.components),
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
		}

		if (interaction.customId === 'visit_cancel') {

			return await declinedInvitation(message, characterDataV, botReplyV, botReplyH);
		}

		if (interaction.values[0] == 'visit_page') {

			visitableServers = /** @type {Array<import('../../typedef').ServerSchema>} */ (await serverModel.find(
				(/** @type {import('../../typedef').ServerSchema} */ s) => {
					return s.serverId !== message.guildId && s.visitChannelId !== null && s.currentlyVisiting === null;
				}));

			packPage++;
			if (packPage >= Math.ceil(visitableServers.length / 24)) {

				packPage = 0;
			}

			selectMenuOptionsArray = getMenuOptions(visitableServers, packPage, []);

			await /** @type {import('discord.js').Message} */ (interaction.message)
				.edit({
					components: [ new MessageActionRow({
						components: [ new MessageSelectMenu({
							customId: 'species-options',
							placeholder: 'Select a species',
							options: selectMenuOptionsArray,
						})],
					})],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});

			return await interactionCollector();
		}

		if (interaction.values[0].startsWith('visit-')) {

			const hostGuildId = interaction.values[0].split('-')[1];

			let serverDataH = /** @type {import('../../typedef').ServerSchema} */ (await serverModel.findOne(
				{ serverId: hostGuildId },
			));

			if (serverDataH === null || serverDataH.visitChannelId === null || serverDataH.currentlyVisiting !== null) {

				return await botReplyV
					.edit({
						embeds: [{
							color: /** @type {`#${string}`} */ (error_color),
							title: 'The chosen pack has become unavailable or is already being visited. Please pick another one.',
						}],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
			}

			serverDataV = /** @type {import('../../typedef').ServerSchema} */ (await serverModel.findOneAndUpdate(
				{ serverId: serverDataV.serverId },
				(/** @type {import('../../typedef').ServerSchema} */ s) => { s.currentlyVisiting = serverDataH.serverId; },
			));

			serverDataH = /** @type {import('../../typedef').ServerSchema} */ (await serverModel.findOneAndUpdate(
				{ serverId: serverDataH.serverId },
				(/** @type {import('../../typedef').ServerSchema} */ s) => { s.currentlyVisiting = serverDataV.serverId; },
			));

			await botReplyV
				.edit({
					components: disableAllComponents(botReplyV.components),
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});

			const visitChannelV = await client.channels.fetch(serverDataV.visitChannelId || '');
			const visitChannelH = await client.channels.fetch(serverDataH.visitChannelId || '');

			if (!visitChannelV || !visitChannelV.isText() || !visitChannelH || !visitChannelH.isText()) {

				return;
			}

			botReplyV = await visitChannelV
				.send({
					embeds: [{
						color: /** @type {`#${string}`} */ (default_color),
						author: { name: /** @type {import('discord.js').TextChannel} */ (visitChannelH).guild.name, icon_url: /** @type {import('discord.js').TextChannel} */ (visitChannelH).guild.iconURL() || undefined },
						description: `*${characterDataV.name} strolls over to ${serverDataH.name}. ${upperCasePronounAndPlural(characterDataV, 0, 'is', 'are')} waiting patiently at the pack borders to be invited in as to not invade the pack's territory without permission.*`,
						footer: { text: 'The invitation will expire in five minutes. Alternatively, you can cancel it using the button below.' },
					}],
					components: [ new MessageActionRow({
						components: [ new MessageButton({
							customId: 'visit_cancel',
							label: 'Cancel',
							style: 'DANGER',
						})],
					})],
				})
				.catch((error) => { throw new Error(error); });

			interactionCollector();

			botReplyH = await visitChannelH
				.send({
					embeds: [{
						color: /** @type {`#${string}`} */ (default_color),
						// @ts-ignore, since message must be in guild
						author: { name: message.guild.name, icon_url: message.guild.iconURL() || undefined },
						title: `Near the lake a ${characterDataV.displayedSpecies || characterDataV.species} is waiting. ${upperCasePronoun(characterDataV, 0)} came out of the direction where a pack named "${serverDataV.name}" is lying. ${upperCasePronoun(characterDataV, 0)} seems to be waiting for permission to cross the pack borders.`,
						footer: { text: 'The invitation will expire in five minutes. Alternatively, you can decline it using the button below.' },
					}],
					components: [ new MessageActionRow({
						components: [ new MessageButton({
							customId: 'visit_accept',
							label: 'Accept visit',
							style: 'SUCCESS',
						}), new MessageButton({
							customId: 'visit_decline',
							label: 'Decline visit',
							style: 'DANGER',
						})],
					})],
				})
				.catch((error) => { throw new Error(error); });


			filter = i => profileModel.findOne({ userId: i.user.id }).then(profile => profile === null ? false : true);

			await botReplyH
				.awaitMessageComponent({ filter, time: 300_000 })
				.then(async button => {

					if (button.customId === 'visit_decline') {

						return Promise.reject();
					}

					const profileDataH = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOne({ userId: button.user.id }));
					// @ts-ignore, since message must be in guild
					const characterDataH = profileDataH.characters[profileDataH.currentCharacter[button.guildId]];

					if (button.customId === 'visit_accept') {

						acceptedInvitation(client, message, botReplyV, botReplyH, serverDataV, serverDataH, characterDataV, characterDataH);
						return;
					}
				})
				.catch(async () => {return await declinedInvitation(message, characterDataV, botReplyV, botReplyH);});
		}
	}
};

/**
 *
 * @param {Array<import('../../typedef').ServerSchema>} visitableServers
 * @param {number} packPage
 * @param {Array<import('discord.js').MessageSelectOptionData>} selectMenuOptionsArray
 * @returns {Array<import('discord.js').MessageSelectOptionData>}
 */
function getMenuOptions(visitableServers, packPage, selectMenuOptionsArray) {

	for (const server of visitableServers.slice((packPage * 24), 25 + (packPage * 24))) {

		selectMenuOptionsArray.push({ label: server.name, value: `visit-${server.serverId}` });
	}

	if (visitableServers.length > 25) {

		selectMenuOptionsArray.length = 24;
		selectMenuOptionsArray.push({ label: 'Show more pack options', value: 'visit_page', description: 'You are currently on page 1', emoji: '📋' });
	}

	return selectMenuOptionsArray;
}

/**
 *
 * @param {import('discord.js').Message} message
 * @param {import('../../typedef').Character} characterData
 * @param {import('discord.js').Message} botReplyV
 * @param {import('discord.js').Message} botReplyH
 */
async function declinedInvitation(message, characterData, botReplyV, botReplyH) {

	await botReplyV
		.edit({
			components: disableAllComponents(botReplyV.components),
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});

	await botReplyV
		.reply({
			embeds: [{
				color: /** @type {`#${string}`} */ (default_color),
				// @ts-ignore, since message must be in guild
				author: { name: botReplyH.guild.name, icon_url: botReplyH.guild.iconURL() || undefined },
				// @ts-ignore, since message must be in guild
				description: `*After ${characterData.name} waited for a while, ${pronoun(characterData, 0)} couldn't deal with the boredom and left the borders of ${botReplyV.guild.name}. The ${characterData.displayedSpecies || characterData.species} gets back feeling a bit lonely but when ${pronounAndPlural(characterData, 0, 'see')} all ${pronoun(characterData, 2)} packmates having fun at home, ${characterData.name} cheers up and joins them excitedly.*`,
			}],
			failIfNotExists: false,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});

	await botReplyH
		.edit({
			components: disableAllComponents(botReplyH.components),
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});

	await botReplyH
		.reply({
			embeds: [{
				color: /** @type {`#${string}`} */ (default_color),
				// @ts-ignore, since message must be in guild
				author: { name: message.guild.name, icon_url: message.guild.iconURL() || undefined },
				// @ts-ignore, since message must be in guild
				description: `*After the ${characterData.displayedSpecies || characterData.species} waited for a while, the pack members of ${botReplyV.guild.name} can see them getting up and leaving, probably due to boredom. Everyone is too busy anyways, so it is probably for the best if ${pronoun(characterData, 0)} come back later.*`,
			}],
			failIfNotExists: false,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});

	await serverModel.findOneAndUpdate(
		{ serverId: botReplyV.guildId },
		(/** @type {import('../../typedef').ServerSchema} */ s) => { s.currentlyVisiting = null; },
	);

	await serverModel.findOneAndUpdate(
		{ serverId: botReplyH.guildId },
		(/** @type {import('../../typedef').ServerSchema} */ s) => { s.currentlyVisiting = null; },
	);
}

/**
 *
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').Message} message
 * @param {import('discord.js').Message} botReplyV
 * @param {import('discord.js').Message} botReplyH
 * @param {import('../../typedef').ServerSchema} serverDataV
 * @param {import('../../typedef').ServerSchema} serverDataH
 * @param {import('../../typedef').Character} characterDataV
 * @param {import('../../typedef').Character} characterDataH
 */
async function acceptedInvitation(client, message, botReplyV, botReplyH, serverDataV, serverDataH, characterDataV, characterDataH) {

	await botReplyV
		.edit({
			components: disableAllComponents(botReplyV.components),
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});

	await botReplyV
		.reply({
			embeds: [{
				color: /** @type {`#${string}`} */ (default_color),
				// @ts-ignore, since message must be in guild
				author: { name: botReplyH.guild.name, icon_url: botReplyH.guild.iconURL() || undefined },
				description: `*After waiting for a bit, a ${characterDataH.displayedSpecies || characterDataH.species} comes closer, inviting ${characterDataV.name} and their packmates in and leading them inside where they can talk to all these new friends.*`,
				footer: { text: 'Anyone with a completed profile can now send a message in this channel. It will be delivered to the other pack, and vice versa. Type "rp endvisit" to end the visit at any time.' },
			}],
			failIfNotExists: false,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});

	await botReplyH
		.edit({
			components: disableAllComponents(botReplyH.components),
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});

	await botReplyH
		.reply({
			embeds: [{
				color: /** @type {`#${string}`} */ (default_color),
				// @ts-ignore, since message must be in guild
				author: { name: botReplyV.guild.name, icon_url: botReplyV.guild.iconURL() || undefined },
				description: `*${characterDataH.name} goes to pick up the ${characterDataV.displayedSpecies || characterDataV.species} and their packmates from the pack borders. The new friends seem excited to be here and to talk to everyone.*`,
				footer: { text: 'Anyone with a completed profile can now send a message in this channel. It will be delivered to the other pack, and vice versa. Type "rp endvisit" to end the visit at any time.' },
			}],
			failIfNotExists: false,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});

	const filter = async (/** @type {import('discord.js').Message} */ m) => m.content.startsWith(prefix) === false && (await profileModel.findOne({ userId: m.author.id })) !== null;

	const hostChannel = await client.channels.fetch(serverDataH.visitChannelId || '');
	const guestChannel = await client.channels.fetch(serverDataV.visitChannelId || '');

	if (!hostChannel || !hostChannel.isText() || !guestChannel || !guestChannel.isText()) {

		return;
	}

	collectMessages(/** @type {import('discord.js').TextChannel} */ (hostChannel), /** @type {import('discord.js').TextChannel} */ (guestChannel));
	collectMessages(/** @type {import('discord.js').TextChannel} */ (guestChannel), /** @type {import('discord.js').TextChannel} */ (hostChannel));

	/**
	 *
	 * @param {import('discord.js').TextChannel} thisServerChannel
	 * @param {import('discord.js').TextChannel} otherServerChannel
	 */
	async function collectMessages(thisServerChannel, otherServerChannel) {

		const collector = thisServerChannel.createMessageCollector({ filter, idle: 300000 });

		collector.on('collect', async msg => {

			if (msg.content.startsWith(prefix + 'say ')) {

				msg.content = msg.content.substring((prefix + 'say ').length);
			}

			const server = /** @type {import('../../typedef').ServerSchema} */ (await serverModel.findOne(
				// @ts-ignore, since message must be in guild
				{ serverId: msg.guild.id },
			));

			if (server.currentlyVisiting === null) {

				return collector.stop();
			}

			return;
		});

		collector.on('end', async () => {

			const thisServerData = /** @type {import('../../typedef').ServerSchema} */ (await serverModel.findOne(
				{ serverId: thisServerChannel.guild.id },
			));

			const otherServerData = /** @type {import('../../typedef').ServerSchema} */ (await serverModel.findOne(
				{ serverId: otherServerChannel.guild.id },
			));

			if (thisServerData.currentlyVisiting !== null && otherServerData.currentlyVisiting !== null) {

				await serverModel.findOneAndUpdate(
					{ serverId: thisServerChannel.guild.id },
					(/** @type {import('../../typedef').ServerSchema} */ s) => { s.currentlyVisiting = null; },
				);

				await serverModel.findOneAndUpdate(
					{ serverId: otherServerChannel.guild.id },
					(/** @type {import('../../typedef').ServerSchema} */ s) => { s.currentlyVisiting = null; },
				);

				await thisServerChannel
					.send({
						embeds: [{
							color: /** @type {`#${string}`} */ (default_color),
							author: { name: otherServerChannel.guild.name, icon_url: otherServerChannel.guild.iconURL() || undefined },
							// @ts-ignore, since message must be in guild
							description: `*Hanging out with friends is always nice but has to end eventually. And so the friends from ${message.guild.name} went back to their territory. Until next time.*`,
						}],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});

				await otherServerChannel
					.send({
						embeds: [{
							color: /** @type {`#${string}`} */ (default_color),
							author: { name: thisServerChannel.guild.name, icon_url: thisServerChannel.guild.iconURL() || undefined },
							// @ts-ignore, since message must be in guild
							description: `*Hanging out with friends is always nice but has to end eventually. And so the friends from ${message.guild.name} went back to their territory. Until next time.*`,
						}],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
			}
		});
	}
}

/**
 * Sends a message to another server.
 * @param {import('discord.js').Client} client
 * @param {import('discord.js').Message} message
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {import('../../typedef').ServerSchema} thisServerData
 * @param {import('../../typedef').ServerSchema} otherServerData
 */
module.exports.sendVisitMessage = async (client, message, userData, thisServerData, otherServerData) => {

	const thisServerChannel = /** @type {import('discord.js').GuildTextBasedChannel} */ (await client.channels.fetch(thisServerData.visitChannelId || ''));
	const otherServerChannel = /** @type {import('discord.js').GuildTextBasedChannel} */ (await client.channels.fetch(otherServerData.visitChannelId || ''));

	const webhookChannel = otherServerChannel.isThread() ? otherServerChannel.parent : otherServerChannel;
	if (!webhookChannel) { throw new Error('Webhook can\'t be edited, interaction channel is thread and parent channel cannot be found'); }
	const otherServerWebhook = (await webhookChannel
		.fetchWebhooks()
		.catch((error) => {
			if (error.httpStatus === 403) {
				otherServerChannel.send({ content: 'Please give me permission to create webhooks 😣' }).catch((err) => { throw new Error(err); });
				thisServerChannel.send({ content: 'The other pack is missing permissions, so I couldn\'t establish a connection 😣' }).catch((err) => { throw new Error(err); });
			}
			throw new Error(error);
		})
	).find(webhook => webhook.name === 'PnP Profile Webhook') || await webhookChannel
		.createWebhook('PnP Profile Webhook')
		.catch((error) => {
			if (error.httpStatus === 403) {
				otherServerChannel.send({ content: 'Please give me permission to create webhooks 😣' }).catch((err) => { throw new Error(err); });
				thisServerChannel.send({ content: 'The other pack is missing permissions, so I couldn\'t establish a connection 😣' }).catch((err) => { throw new Error(err); });
			}
			throw new Error(error);
		});

	// @ts-ignore, since message must be in guild
	const characterData = userData?.characters?.[userData?.currentCharacter?.[message.guildId]];
	if (characterData === undefined) { return; }
	/** @type {import('../../typedef').WebhookMessages} */
	const webhookCache = JSON.parse(readFileSync('./database/webhookCache.json', 'utf-8'));
	let embeds = undefined;

	if (message.reference && message.reference.messageId) {

		const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);

		if (webhookCache[referencedMessage.id] !== undefined) {

			const user = await client.users.fetch(webhookCache[referencedMessage.id]);
			referencedMessage.author = user;
		}

		embeds = [ new MessageEmbed({
			color: referencedMessage.member?.displayColor || referencedMessage.author.accentColor || '#ffffff',
			author: {
				name: referencedMessage.member?.displayName || referencedMessage.author?.tag,
				icon_url: referencedMessage.member?.displayAvatarURL() || referencedMessage.author?.avatarURL() || undefined,
			},
			description: referencedMessage.content,
		})];
	}

	const botMessage = await otherServerWebhook
		.send({
			username: characterData.name,
			avatarURL: characterData.avatarURL,
			content: message.content || undefined,
			files: Array.from(message.attachments.values()) || undefined,
			embeds: embeds,
			threadId: otherServerChannel.isThread() ? otherServerChannel.id : undefined,
		})
		.catch((error) => { throw new Error(error); });

	webhookCache[botMessage.id] = message.author.id + (characterData?._id !== undefined ? `_${characterData?._id}` : '');

	writeFileSync('./database/webhookCache.json', JSON.stringify(webhookCache, null, '\t'));
};
