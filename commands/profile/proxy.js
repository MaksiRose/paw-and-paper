// @ts-check
const { MessageEmbed, MessageButton, MessageActionRow, MessageSelectMenu, Modal, TextInputComponent, Collection } = require('discord.js');
const { hasNoName } = require('../../utils/checkAccountCompletion');
const { error_color, prefix } = require('../../config.json');
const profileModel = require('../../models/profileModel');
const serverModel = require('../../models/serverModel');
const { createCommandCollector } = require('../../utils/commandCollector');
const disableAllComponents = require('../../utils/disableAllComponents');
const sendNoDM = require('../../utils/sendNoDM');
let hasModalCollector = false;

module.exports.name = 'proxy';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {import('../../typedef').ServerSchema} serverData
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData, serverData) => {

	const characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild?.id || 'DM']];

	/* Checking if the user has a name set. If they don't, it will send a message telling them to set a
	name. */
	if ((!message.inGuild() || message.member.permissions.has('ADMINISTRATOR') === false) && await hasNoName(message, characterData)) {

		return;
	}

	/** @type {import('discord.js').Message} */
	let botReply;
	let page = 0;

	const allChannels = (await message.guild?.channels?.fetch() || new Collection()).filter(c => c.isText() && c.viewable && c.permissionsFor(client.user).has('SEND_MESSAGES') && c.permissionsFor(message.author.id).has('VIEW_CHANNEL') && c.permissionsFor(message.author.id).has('SEND_MESSAGES'));

	/* Creating a new MessageSelectMenu for each of the three options. */
	const { disableAutoSelectMenu, disableAllSelectMenu, alwaysSelectMenu } = getSelectMenus(allChannels, userData, message, serverData, page);

	const subcommand = argumentsArray.splice(0, 1)[0];

	if ((characterData && characterData?.name !== '') && (subcommand === 'set' || subcommand === 'add')) {

		await setProxy();
		return;
	}

	if ((characterData && characterData?.name !== '') && (subcommand === 'always' || subcommand === 'auto' || subcommand === 'automatic')) {

		await alwaysProxy();
		return;
	}

	if (subcommand === 'disable' || subcommand === 'enable' || subcommand === 'toggle') {

		await disableProxy();
		return;
	}

	botReply = await message
		.reply({
			embeds: [ new MessageEmbed({
				color: /** @type {`#${string}`} */ (error_color),
				title: 'What is a proxy and how do I use this command?',
				description: 'Proxying is a way to speak as if your character was saying it. This means that your message will be replaced by one that has your characters name and avatar.',
				fields: [
					...(characterData && characterData?.name !== '' ? [
						{
							name: 'rp proxy set',
							value: 'This sets an indicator to the bot you want your message to be proxied. Only messages with those indicators will be proxied. Click the "Set?" button below to learn more.',
						},
						...(message.inGuild() ? [{
							name: 'rp proxy always',
							value: 'This will treat every message in a specific channel as if it was proxied, even if the proxy isn\'t included. Click the "Always?" button below to learn more.',
						}] : []),
					] : []),
					...(message.inGuild() && message.member.permissions.has('ADMINISTRATOR') ? [
						{
							name: 'rp proxy disable',
							value: 'This is an __administrator__ setting that can toggle whether `always` or `all` proxy should be disabled or enabled in a specific channel. Click the "Disable?" Button below to learn more.',
						},
					] : []),
				],
			})],
			components: [ new MessageActionRow({
				components: [
					...(characterData && characterData?.name !== '' ? [
						new MessageButton({
							customId: 'proxy-learnmore-set',
							label: 'Set?',
							style: 'SUCCESS',
						}), ...(message.inGuild() ? [new MessageButton({
							customId: 'proxy-learnmore-always',
							label: 'Always?',
							style: 'SUCCESS',
						})] : []),
					] : []),
					...(message.inGuild() && message.member.permissions.has('ADMINISTRATOR') ? [
						new MessageButton({
							customId: 'proxy-learnmore-disable',
							label: 'Disable?',
							style: 'SUCCESS',
						}),
					] : []),
				],
			})],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	createCommandCollector(message.author.id, message.guild?.id || '', botReply);
	interactionCollector();

	async function interactionCollector() {

		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => i.customId.includes('proxy') && i.user.id === message.author.id;

		/** @type {import('discord.js').MessageComponentInteraction | null} */
		await botReply
			.awaitMessageComponent({ filter, time: 120_000 })
			.then(async interaction => {

				if (interaction.isButton() && interaction.customId === 'proxy-learnmore-set') {

					await setProxy();
				}

				if (interaction.isButton() && interaction.customId === 'proxy-learnmore-always') {

					await alwaysProxy();
				}

				if (interaction.isButton() && interaction.customId === 'proxy-learnmore-disable') {

					await disableProxy();
				}

				if (interaction.isButton() && interaction.customId === 'proxy-set-modal') {

					interaction.showModal(new Modal()
						.setCustomId('proxy-set')
						.setTitle('Set a proxy')
						.addComponents(
							new MessageActionRow({
								components: [ new TextInputComponent()
									.setCustomId('proxy-set-textinput-startsWith')
									.setLabel('Prefix (indicator before the word "text")')
									.setStyle('SHORT')
									.setValue(characterData.proxy.startsWith),
								],
							}),
							new MessageActionRow({
								components: [ new TextInputComponent()
									.setCustomId('proxy-set-textinput-endsWith')
									.setLabel('Suffix (indicator after the word "text")')
									.setStyle('SHORT')
									.setValue(characterData.proxy.endsWith),
								],
							}),
						),
					);

					interactionCollector();

					if (hasModalCollector) {

						return;
					}
					hasModalCollector = true;

					interaction.awaitModalSubmit({ filter: i => i.customId === 'proxy-set', time: 120_000 })
						.then(async i => {

							hasModalCollector = false;
							argumentsArray = (i.components[0].components[0].value + 'text' + i.components[1].components[0].value).split(' ');

							await i
								.deferUpdate()
								.catch(async (error) => {
									if (error.httpStatus === 400) { return console.error('DiscordAPIError: Interaction has already been acknowledged.'); }
									if (error.httpStatus === 404) { return console.error('DiscordAPIError: Unknown interaction. (This probably means that there was server-side delay when receiving the interaction)'); }
								});

							setProxy();
						})
						.catch(() => {
							hasModalCollector = false;
						});
				}

				if (interaction.isButton() && interaction.customId === 'proxy-disable-automatic') {

					botReply = await botReply
						.edit({
							components: [botReply.components[0], new MessageActionRow({
								components: [disableAutoSelectMenu],
							})],
						})
						.catch((error) => { throw new Error(error); });
					interactionCollector();
				}

				if (interaction.isButton() && interaction.customId === 'proxy-disable-all') {

					botReply = await botReply
						.edit({
							components: [botReply.components[0], new MessageActionRow({
								components: [disableAllSelectMenu],
							})],
						})
						.catch((error) => { throw new Error(error); });
					interactionCollector();
				}

				if (interaction.isSelectMenu()) {

					if (interaction.values[0].includes('page')) {

						page++;
						if (page >= Math.ceil((allChannels.size + 1) / 24)) {

							page = 0;
						}

						interactionCollector();
					}
					else if (!interaction.values[0].includes('page') && interaction.customId === 'proxy-always-options') {

						const channelId = interaction.values[0].replace('proxy-always_', '');

						if (channelId === 'everywhere') { argumentsArray[0] = channelId; }
						else { message.mentions.channels.set(channelId, allChannels.get(channelId)); }

						await alwaysProxy();
					}
					else if (!interaction.values[0].includes('page') && interaction.customId === 'proxy-disableall-options') {

						const channelId = interaction.values[0].replace('proxy-disableall_', '');
						argumentsArray[0] = 'all';

						if (channelId === 'everywhere') { argumentsArray[1] = channelId; }
						else { message.mentions.channels.set(channelId, allChannels.get(channelId)); }

						await disableProxy();
					}
					else if (!interaction.values[0].includes('page') && interaction.customId === 'proxy-disableauto-options') {

						const channelId = interaction.values[0].replace('proxy-disableauto_', '');
						argumentsArray[0] = 'auto';

						if (channelId === 'everywhere') { argumentsArray[1] = channelId; }
						else { message.mentions.channels.set(channelId, allChannels.get(channelId)); }

						await disableProxy();
					}

					const component = interaction.customId.includes('disableall') ? getSelectMenus(allChannels, userData, message, serverData, page).disableAllSelectMenu :
						interaction.customId.includes('disableauto') ? getSelectMenus(allChannels, userData, message, serverData, page).disableAutoSelectMenu :
							getSelectMenus(allChannels, userData, message, serverData, page).alwaysSelectMenu;

					botReply = await botReply
						.edit({
							components: [...(interaction.customId.includes('disable') ? [botReply.components[0]] : []), new MessageActionRow({
								components: [component],
							})],
						})
						.catch((error) => { throw new Error(error); });
				}
			})
			.catch(async (err) => {

				console.error(err);
				await botReply
					.edit({
						components: disableAllComponents(botReply?.components || []),
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
				return;
			});
	}

	async function setProxy() {

		const proxy = argumentsArray.join(' ');

		if (proxy.includes('text')) {

			const proxies = proxy.split('text');

			if (proxies[0] === prefix) {

				botReply = await ((content) => !botReply ? message.reply(content) : botReply.edit(content))({
					embeds: [new MessageEmbed({
						color: /** @type {`#${string}`} */ (error_color),
						title: 'You can\'t make your proxy the bot\'s prefix.',
					})],
					components: [ new MessageActionRow({
						components: [ new MessageButton({
							customId: 'proxy-set-modal',
							label: 'Set proxy',
							style: 'SUCCESS',
						})],
					})],
					failIfNotExists: false,
				}).catch((error) => { throw new Error(error); });

				if (botReply) {

					createCommandCollector(message.author.id, message.guild?.id || '', botReply);
					interactionCollector();
				}
				return;
			}

			for (const character of Object.values(userData?.characters || {})) {

				const isSamePrefix = proxies[0] !== '' && proxies[0] !== undefined && character.proxy.startsWith === proxies[0];
				const isSameSuffix = proxies[1] !== '' && proxies[1] !== undefined && character.proxy.endsWith === proxies[1];
				if (isSamePrefix && isSameSuffix) {

					botReply = await ((content) => !botReply ? message.reply(content) : botReply.edit(content))({
						embeds: [new MessageEmbed({
							color: /** @type {`#${string}`} */ (error_color),
							title: 'You can\'t have two characters with the same proxy.',
						})],
						components: [ new MessageActionRow({
							components: [ new MessageButton({
								customId: 'proxy-set-modal',
								label: 'Set proxy',
								style: 'SUCCESS',
							})],
						})],
						failIfNotExists: false,
					}).catch((error) => { throw new Error(error); });

					if (botReply) {

						createCommandCollector(message.author.id, message.guild?.id || '', botReply);
						interactionCollector();
					}
					return;
				}
			}

			userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
				{ uuid: userData.uuid },
				(/** @type {import('../../typedef').ProfileSchema} */ p) => {
					p.characters[p.currentCharacter[message.guild?.id || 'DM']].proxy.startsWith = proxies[0];
					p.characters[p.currentCharacter[message.guild?.id || 'DM']].proxy.endsWith = proxies[1];
				},
			));

			botReply = await ((content) => !botReply ? message.reply(content) : botReply.edit(content))({
				embeds: [new MessageEmbed({
					color: characterData.color,
					author: { name: characterData.name, icon_url: characterData.avatarURL },
					title: `Proxy set to ${proxies[0]}text${proxies[1]}!`,
				})],
				components: disableAllComponents(botReply?.components || []),
				failIfNotExists: false,
			}).catch((error) => { throw new Error(error); });
		}
		else {

			botReply = await ((content) => !botReply ? message.reply(content) : botReply.edit(content))({
				embeds: [new MessageEmbed({
					color: /** @type {`#${string}`} */ (error_color),
					title: 'Here is how to use the set subcommand:',
					description: 'Proxying is a way to speak as if your character was saying it. The proxy is an indicator to the bot you want your message to be proxied. You can set your proxy by putting the indicator around the word "text". In a message, "text" would be replaced by whatever you want your character to say.\n\nExamples:\n`rp proxy set <text>`\n`rp proxy set P: text`\n`rp proxy set text -p`\nThis is case-sensitive (meaning that upper and lowercase matters).\n\nYou can also use the button below to set your proxy.',
				})],
				components: [ new MessageActionRow({
					components: [ new MessageButton({
						customId: 'proxy-set-modal',
						label: 'Set proxy',
						style: 'SUCCESS',
					})],
				})],
				failIfNotExists: false,
			}).catch((error) => { throw new Error(error); });

			if (botReply) {

				createCommandCollector(message.author.id, message.guild?.id || '', botReply);
				interactionCollector();
			}
		}
	}

	async function alwaysProxy() {

		if (await sendNoDM(message)) {

			return;
		}

		const autoproxy = message.mentions.channels.size > 0 && message.mentions.channels.first().isText() ? message.mentions.channels.first().id : argumentsArray.join(' ');

		if ((message.mentions.channels.size > 0 && message.mentions.channels.first().isText()) || autoproxy === 'everywhere') {

			const hasChannel = userData.autoproxy[message.guild.id] !== undefined && userData.autoproxy[message.guild.id].includes(autoproxy);

			userData = /** @type {import('../../typedef').ProfileSchema} */ (await profileModel.findOneAndUpdate(
				{ uuid: userData.uuid },
				(/** @type {import('../../typedef').ProfileSchema} */ p) => {
					if (p.autoproxy[message.guild.id] === undefined) { p.autoproxy[message.guild.id] = []; }
					if (hasChannel) { p.autoproxy[message.guild.id] = p.autoproxy[message.guild.id].filter(string => string !== autoproxy); }
					else { p.autoproxy[message.guild.id].push(autoproxy); }
				},
			));

			await message
				.reply({
					embeds: [ new MessageEmbed({
						color: characterData.color,
						author: { name: characterData.name, icon_url: characterData.avatarURL },
						title: `${hasChannel ? 'Removed' : 'Added'} ${autoproxy === 'everywhere' ? autoproxy : message.guild.channels.cache.get(autoproxy).name} ${hasChannel ? 'from' : 'to'} the list of automatic proxy channels!`,
					})],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});

			if (botReply) {

				createCommandCollector(message.author.id, message.guild?.id || '', botReply);
				interactionCollector();
			}
		}
		else {

			botReply = await ((content) => !botReply ? message.reply(content) : botReply.edit(content))({
				embeds: [ new MessageEmbed({
					color: /** @type {`#${string}`} */ (error_color),
					title: 'Here is how to use the always subcommand:',
					description: 'When this feature is enabled, every message you sent will be treated as if it was proxied, even if the proxy isn\'t included.\nYou can either toggle it for the entire server (by adding the word "everywhere" to the command), or just one channel (by mentioning the channel). Repeating the command will toggle the feature off again for that channel/for the server.\n\nSo it\'s either `rp proxy always everywhere` or `rp proxy always #channel`.\n\nYou can also toggle channels with the drop-down menu below. Enabled channels will have a radio emoji next to it.',
				})],
				components: [ new MessageActionRow({
					components: [alwaysSelectMenu],
				})],
				failIfNotExists: false,
			}).catch((error) => { throw new Error(error); });

			if (botReply) {

				createCommandCollector(message.author.id, message.guild?.id || '', botReply);
				interactionCollector();
			}
		}
	}

	async function disableProxy() {

		if (!message.inGuild() || message.member.permissions.has('ADMINISTRATOR') === false) {

			await message
				.reply({
					embeds: [ new MessageEmbed({
						color: /** @type {`#${string}`} */ (error_color),
						title: 'Only administrators of a server can use this command!',
					})],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		const subsubcommand = argumentsArray.splice(0, 1)[0];
		const kind = (subsubcommand === 'any') ? 'all' : (subsubcommand === 'always' || subsubcommand === 'automatic') ? 'auto' : subsubcommand;
		const place = message.mentions.channels.size > 0 && message.mentions.channels.first().isText() ? message.mentions.channels.first().id : argumentsArray.join(' ');

		if (((message.mentions.channels.size > 0 && message.mentions.channels.first().isText()) || place === 'everywhere') && (kind === 'all' || kind === 'auto')) {

			const hasChannel = serverData.proxysetting[kind].includes(place);

			serverData = /** @type {import('../../typedef').ServerSchema} */ (await serverModel.findOneAndUpdate(
				{ serverId: message.guild.id },
				(/** @type {import('../../typedef').ServerSchema} */ s) => {
					if (hasChannel) { s.proxysetting[kind] = s.proxysetting[kind].filter(string => string !== place); }
					else { s.proxysetting[kind].push(place); }
				},
			));

			await message
				.reply({
					embeds: [ new MessageEmbed({
						color: characterData.color,
						author: { name: characterData.name, icon_url: characterData.avatarURL },
						title: `${hasChannel ? 'Enabled' : 'Disabled'} ${kind} proxies ${place === 'everywhere' ? place : 'in ' + message.guild.channels.cache.get(place).name}!`,
					})],
					failIfNotExists: false,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});

			if (botReply) {

				createCommandCollector(message.author.id, message.guild?.id || '', botReply);
				interactionCollector();
			}
		}
		else {

			botReply = await ((content) => !botReply ? message.reply(content) : botReply.edit(content))({
				embeds: [ new MessageEmbed({
					color: /** @type {`#${string}`} */ (error_color),
					title: 'Here is how to use the disable subcommand:',
					description: 'This is an **administrator** setting that can toggle whether `automatic` or `all` proxy should be disabled or enabled in a specific channel, or everywhere. Repeating the command will allow that kind of proxying again for that channel/for the server.\n\nExamples:\n`rp proxy disable automatic everywhere`\n`rp proxy disable all #channel`\n\nYou can also toggle channels with a drop-down menu, once you choose what you want to toggle below. Disabled channels will have a radio emoji next to it.',
				})],
				components: [ new MessageActionRow({
					components: [ new MessageButton({
						customId: 'proxy-disable-automatic',
						label: 'Disable automatic',
						style: 'SUCCESS',
					}), new MessageButton({
						customId: 'proxy-disable-all',
						label: 'Disable all',
						style: 'SUCCESS',
					})],
				}), ...(kind === 'all' || kind === 'auto') ? [new MessageActionRow({
					components: [kind === 'all' ? disableAllSelectMenu : disableAutoSelectMenu],
				})] : []],
				failIfNotExists: false,
			}).catch((error) => { throw new Error(error); });

			if (botReply) {

				createCommandCollector(message.author.id, message.guild?.id || '', botReply);
				interactionCollector();
			}
		}
	}
};

/**
 *
 * @param {import('discord.js').Collection<string, import('discord.js').NonThreadGuildBasedChannel>} allChannels
 * @param {import('../../typedef').ProfileSchema} userData
 * @param {import('discord.js').Message} message
 * @param {import('../../typedef').ServerSchema} serverData
 * @param {number} page
 * @returns
 */
function getSelectMenus(allChannels, userData, message, serverData, page) {

	const alwaysSelectMenu = new MessageSelectMenu({
		custom_id: 'proxy-always-options',
		placeholder: 'Select a channel to toggle always proxying for',
	});
	alwaysSelectMenu.addOptions({ label: 'Everywhere', value: 'proxy-always_everywhere' });

	const disableAllSelectMenu = new MessageSelectMenu({
		custom_id: 'proxy-disableall-options',
		placeholder: 'Select a channel to toggle all proxying for',
	});
	disableAllSelectMenu.addOptions({ label: 'Everywhere', value: 'proxy-disableall_everywhere' });

	const disableAutoSelectMenu = new MessageSelectMenu({
		custom_id: 'proxy-disableauto-options',
		placeholder: 'Select a channel to toggle automatic proxying for',
	});
	disableAutoSelectMenu.addOptions({ label: 'Everywhere', value: 'proxy-disableauto_everywhere' });

	for (const [channelId, channel] of allChannels) {

		alwaysSelectMenu.addOptions({ label: channel.name, value: `proxy-always_${channelId}`, emoji: userData.autoproxy[message.guild.id]?.includes(channelId) ? '🔘' : null });
		disableAllSelectMenu.addOptions({ label: channel.name, value: `proxy-disableall_${channelId}`, emoji: serverData.proxysetting.all?.includes(channelId) ? '🔘' : null });
		disableAutoSelectMenu.addOptions({ label: channel.name, value: `proxy-disableauto_${channelId}`, emoji: serverData.proxysetting.auto?.includes(channelId) ? '🔘' : null });
	}

	if (alwaysSelectMenu.options.length > 25) {

		alwaysSelectMenu.options = alwaysSelectMenu.options.splice(page * 24, (page + 1) * 24);
		alwaysSelectMenu.addOptions({ label: 'Show more channels', value: 'proxy-always_page', description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	if (disableAllSelectMenu.options.length > 25) {

		disableAllSelectMenu.options = disableAllSelectMenu.options.splice(page * 24, (page + 1) * 24);
		disableAllSelectMenu.addOptions({ label: 'Show more channels', value: 'proxy-disableall_page', description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	if (disableAutoSelectMenu.options.length > 25) {

		disableAutoSelectMenu.options = disableAutoSelectMenu.options.splice(page * 24, (page + 1) * 24);
		disableAutoSelectMenu.addOptions({ label: 'Show more channels', value: 'proxy-disableauto_page', description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return { disableAutoSelectMenu, disableAllSelectMenu, alwaysSelectMenu };
}
