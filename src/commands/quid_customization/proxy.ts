import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Collection, EmbedBuilder, ModalBuilder, NonThreadGuildBasedChannel, RestOrArray, StringSelectMenuBuilder, SelectMenuComponentOptionData, SlashCommandBuilder, TextInputBuilder, TextInputStyle, ChatInputCommandInteraction, ButtonInteraction } from 'discord.js';
import { deepCopy, respond } from '../../utils/helperFunctions';
import { hasName } from '../../utils/checkUserState';
import { SlashCommand } from '../../typings/handle';
import { constructCustomId, constructSelectOptions, deconstructCustomId, deconstructSelectOptions } from '../../utils/customId';
import { getDisplayname } from '../../utils/getQuidInfo';
import UserToServer, { AutoproxySetTo } from '../../models/userToServer';
import Quid from '../../models/quid';
import User from '../../models/user';
import { generateId } from 'crystalid';
import QuidToServer from '../../models/quidToServer';
const { error_color, default_color } = require('../../../config.json');

type CustomIdArgs = [] | ['set', 'learnmore' | 'modal'] | ['auto', 'learnmore' | 'setTo' | 'advanced' | 'channelListType' | 'channelListOptions'] | ['mainpage'] | [string]
type SelectOptionArgs = [string] | ['nextpage', `${number}`]

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('proxy')
		.setDescription('Add a proxy or autoproxy for your quid.')
		.toJSON(),
	category: 'page1',
	position: 6,
	disablePreviousCommand: true,
	modifiesServerProfile: false,
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer }) => {

		/* If the user does not have a quid selected, return. */
		if (user === undefined) {

			hasName(undefined, { interaction, hasQuids: false }); // This is always a reply
			return;
		}

		// This is always a reply
		await respond(interaction, await getMainPageContent(interaction, user, quid, userToServer, quidToServer));
	},
	async sendMessageComponentResponse(interaction, { user, quid, userToServer, quidToServer }) {

		const customId = deconstructCustomId<CustomIdArgs>(interaction.customId);
		if (!customId) { throw TypeError('customId is null'); }
		if (user === undefined) { return; }

		if (interaction.isButton() && customId.args[0] === 'mainpage') {

			await respond(interaction, await getMainPageContent(interaction, user, quid, userToServer, quidToServer), 'update', interaction.message.id);
			return;
		}

		/* If the user pressed the button to learn more about the set subcommand, explain it with a button that opens a modal. */
		if (interaction.isButton() && customId.args[0] === 'set' && customId.args[1] === 'learnmore') {

			// This is always an update to the message with the button
			await respond(interaction, {
				embeds: [new EmbedBuilder(interaction.message.embeds[0]?.toJSON())
					.setTitle('Here is how to use the set subcommand:')
					.setDescription('Proxying is a way to speak as if your quid was saying it. The proxy is an indicator to the bot you want your message to be proxied. It consists of a prefix (indicator before the message) and a suffix (indicator after the message). You can either set both or one of them.\n\nExamples:\nprefix: `<`, suffix: `>`, example message: `<hello friends>`\nprefix: `P: `, no suffix, example message: `P: hello friends`\nno prefix, suffix: ` -p`, example message: `hello friends -p`\nThis is case-sensitive (meaning that upper and lowercase matters).')
					.setFields()
					.setFooter({ text: hasName(quid) ? 'Tip: Use this command while no quid is selected to configure an "anti-proxy". That anti-proxy can be used to escape auto-proxying. It also turns off auto-proxying permanently while sticky-mode is on, until you use another proxy again.' : 'Caution: Since you currently have no quid selected, you are configuring an anti-proxy. This can be used to escape auto-proxying. It also turns off auto-proxying permanently while sticky-mode is on, until you use another proxy again. Select a quid from the profile-command to configure a proxy for that quid.' })],
				components: getSetproxyMsg(user, quid, 0),
			}, 'update', interaction.message.id);
			return;
		}

		/* If the user pressed the select menu to set their proxy, open the modal. */
		if (interaction.isStringSelectMenu() && customId.args[0] === 'set' && customId.args[1] === 'modal') {

			let page = 0;
			const selectOptionId = deconstructSelectOptions<SelectOptionArgs>(interaction)[0];
			if (selectOptionId === undefined) { throw new TypeError('selectOptionId is undefined'); }

			/* If the user clicked the next page option, increment the page. */
			if (selectOptionId[0] === 'nextpage') {

				page = Number(selectOptionId[1]) + 1;
				if (page >= Math.ceil(((quid ? quid.proxies : user.antiproxies).length + 1) / 24)) { page = 0; }

				// This is always an update to the message with the select menu
				await respond(interaction, {
					components: getSetproxyMsg(user, quid, page),
				}, 'update', interaction.message.id);
			}
			/* If the user clicked add or an existing proxy, show a modal. */
			else {

				await interaction.showModal(new ModalBuilder()
					.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, quid?.id ?? user.id, [selectOptionId[0]]))
					.setTitle('Set a proxy')
					.addComponents(
						new ActionRowBuilder<TextInputBuilder>({
							components: [new TextInputBuilder()
								.setCustomId('startsWith')
								.setLabel('Prefix (indicator before the message)')
								.setStyle(TextInputStyle.Short)
								.setMaxLength(16)
								.setRequired(false)
								.setValue(selectOptionId[0] === 'add' ? '' : ((quid ? quid.proxies[Number(selectOptionId[0])]?.[0] : user.antiproxies[Number(selectOptionId[0])]?.[0]) ?? '')),
							],
						}),
						new ActionRowBuilder<TextInputBuilder>({
							components: [new TextInputBuilder()
								.setCustomId('endsWith')
								.setLabel('Suffix (indicator after the message)')
								.setStyle(TextInputStyle.Short)
								.setMaxLength(16)
								.setRequired(false)
								.setValue(selectOptionId[0] === 'add' ? '' : ((quid ? quid.proxies[Number(selectOptionId[0])]?.[1] : user.antiproxies[Number(selectOptionId[0])]?.[1]) ?? '')),
							],
						}),
					),
				);
			}
			return;
		}

		/* If the user pressed the button to learn more about the auto subcommand, explain it with a select menu to select channels. */
		if (interaction.isButton() && customId.args[0] === 'auto' && customId.args[1] === 'learnmore') {

			// This is always an update to the message with the button
			await respond(interaction, {
				embeds: [new EmbedBuilder(interaction.message.embeds[0]?.toJSON())
					.setTitle('Here is how to use the auto subcommand:')
					.setDescription(`${interaction.inGuild() ? '' : '**IMPORTANT:** Due to discord limitations, this feature only works in servers.\n\n'}Auto-proxying means that every message you send will be treated as if it was proxied, even if the proxy isn't included. With "select mode", it will choose the quid that is currently selected in the \`/profile\`-command. With "sticky mode", it will instead choose the quid whose proxy was last included in a message.\n\nIn the drop-down menu, you can select what autoproxy setting you want to follow. This applies ${interaction.inGuild() ? 'locally (in this server only)' : 'globally (cross-server)'}.`)
					.setFields()
					.setFooter({ text: `Tips:\n${interaction.inGuild() ? '1. Use this command in DMs to change global (cross-server) proxy settings.' : '1.Use this command in a server to overwrite these global (cross-server) proxy settings for that server.'}\n2. When sticky mode is enabled, you can include the anti-proxy in a message to stop auto-proxying until you include another quids' proxy in a future message, instead of having to turn off auto-proxying altogether or having to select an Empty Slot in the profile-command.\n3. If you want sticky mode to stick to the same quid across different servers, then enable sticky mode globally and select "Follow global settings" in the servers you want this to apply.\n4. If you want select mode to select the same quid across different servers, then enable select mode globally and select "Follow global settings" in the servers you want this to apply. It will then choose the quid that is selected via the profile-command in DMs.` })],
				components: getAutoproxyComponents(user, quid, userToServer, interaction.inGuild()),
			}, 'update', interaction.message.id);
			return;
		}

		if (interaction.isStringSelectMenu() && customId.args[0] === 'auto' && customId.args[1] === 'setTo') {

			const selectOptionId = deconstructSelectOptions<SelectOptionArgs>(interaction)[0];
			if (selectOptionId === undefined) { throw new TypeError('selectOptionId is undefined'); }

			if (!interaction.inGuild()) { await user.update({ proxy_setTo: Number(selectOptionId[0]) }); }
			else if (!userToServer) {

				userToServer = await UserToServer.create({
					id: generateId(), userId: user.id, serverId: interaction.guildId, autoproxy_setTo: Number(selectOptionId[0]),
				});
			}
			else { await userToServer.update({ autoproxy_setTo: Number(selectOptionId[0]) }); }

			const newSetting = selectOptionId[0] === '0'
				? 'is now disabled'
				: selectOptionId[0] === '1'
					? 'is now enabled with select mode'
					: selectOptionId[0] === '2'
						? 'is now enabled with sticky mode'
						: 'now follows the global setting';

			// This is always an update to the message with the select menu
			await respond(interaction, {
				components: getAutoproxyComponents(user, quid, userToServer, interaction.inGuild()),
			}, 'update', interaction.message.id);

			// This is always a followUp
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(quid?.color ?? default_color)
					.setAuthor(hasName(quid) ? {
						name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					} : null)
					.setTitle(`Auto-proxying ${newSetting} ${interaction.inGuild() ? 'in this server' : 'globally'}!`)],
				ephemeral: true,
			});
			return;
		}

		if (!interaction.inGuild()) { return; }
		const allChannels = (await interaction.guild?.channels?.fetch() ?? new Collection()).filter((c): c is NonThreadGuildBasedChannel => c !== null && c.permissionsFor(interaction.client.user.id)?.has('ViewChannel') != false && c.permissionsFor(interaction.client.user.id)?.has('SendMessages') != false && c.permissionsFor(interaction.user.id)?.has('ViewChannel') != false && c.permissionsFor(interaction.user.id)?.has('SendMessages') != false);

		if (interaction.isButton() && customId.args[0] === 'auto' && customId.args[1] === 'advanced') {

			// This is always an update to the message with the button
			await respond(interaction, {
				embeds: [new EmbedBuilder(interaction.message.embeds[0]?.toJSON())
					.setTitle('Advanced options for the auto subcommand:')
					.setDescription('You can customize which channels auto-proxying applies in. When this is set to blacklist, auto-proxying is *only disabled* in the selected channels. When it is set to whitelist, auto-proxying is *only enabled* in the selected channels. Using the drop-down menu, you can select the channels for the black-/whitelist.\n\nBy default, this is set to blacklist with no channels selected, which means that it is not disabled in any channels.')
					.setFields()
					.setFooter(null)],
				components: getAdvancedAutoproxyComponents(allChannels, user, quid, userToServer, 0),
			}, 'update', interaction.message.id);
			return;
		}

		/* Responses for select menu selections */
		if (interaction.isButton() && customId.args[0] === 'auto' && customId.args[1] === 'channelListType') {

			const oldSetting = userToServer?.autoproxy_setToWhitelist ?? false;
			const newSetting = oldSetting === false ? true : false;

			if (!userToServer) {

				userToServer = await UserToServer.create({
					id: generateId(), userId: user.id, serverId: interaction.guildId, autoproxy_setToWhitelist: newSetting,
				});
			}
			else { await userToServer.update({ autoproxy_setToWhitelist: newSetting }); }

			// This is always an update to the message with the select menu
			await respond(interaction, {
				components: getAdvancedAutoproxyComponents(allChannels, user, quid, userToServer, 0),
			}, 'update', interaction.message.id);

			// This is always a followUp
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(quid?.color ?? default_color)
					.setAuthor(hasName(quid) ? {
						name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					} : null)
					.setTitle(`Auto-proxying ${`is now only ${newSetting === false ? 'disabled' : 'enabled'} in the ${newSetting === false ? 'blacklisted' : 'whitelisted'} channels`}!`)],
				ephemeral: true,
			});
		}

		if (interaction.isStringSelectMenu() && customId.args[0] === 'auto' && customId.args[1] === 'channelListOptions') {

			let page = 0;
			const selectOptionId = deconstructSelectOptions<SelectOptionArgs>(interaction)[0];
			if (selectOptionId === undefined) { throw new TypeError('selectOptionId is undefined'); }

			/* If the user clicked the next page option, increment the page. */
			if (selectOptionId[0] === 'nextpage') {

				page = Number(selectOptionId[1]) + 1;
				if (page >= Math.ceil((allChannels!.size + 1) / 24)) { page = 0; }

				// This is always an update to the message with the select menu
				await respond(interaction, {
					components: getAdvancedAutoproxyComponents(allChannels, user, quid, userToServer, page),
				}, 'update', interaction.message.id);
			}
			/* If the user clicked an always subcommand option, add/remove the channel and send a success message. */
			else {

				const channelId = selectOptionId[0];
				const listType = userToServer?.autoproxy_setToWhitelist === false ? 'autoproxy_blacklist' : 'autoproxy_whitelist';
				const hasChannel = userToServer?.[listType].includes(channelId) ?? false;

				if (!userToServer) {

					userToServer = await UserToServer.create({
						id: generateId(), userId: user.id, serverId: interaction.guildId, autoproxy_setToWhitelist: true, autoproxy_whitelist: [channelId],
					});
				}
				else {

					let newList = deepCopy(userToServer[listType]);
					if (!hasChannel) { newList.push(channelId); }
					else { newList = newList.filter(cid => cid !== channelId); }
					await userToServer.update({ [listType]: newList });
				}

				// This is always an update to the message with the select menu
				await respond(interaction, {
					components: getAdvancedAutoproxyComponents(allChannels, user, quid, userToServer, page),
				}, 'update', interaction.message.id);

				// This is always a followUp
				await respond(interaction, {
					embeds: [new EmbedBuilder()
						.setColor(quid?.color ?? default_color)
						.setAuthor(hasName(quid) ? {
							name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
							iconURL: quid.avatarURL,
						} : null)
						.setTitle(`${hasChannel ? 'Removed' : 'Added'} ${interaction.guild?.channels.cache.get(channelId)?.name ?? channelId} ${hasChannel ? 'from' : 'to'} the auto-proxy ${listType.split('_')[1]}!`)],
					ephemeral: true,
				});
			}
			return;
		}
	},
	async sendModalResponse(interaction, { user, quid: activeQuid, userToServer, quidToServer }) {

		const customId = deconstructCustomId<CustomIdArgs>(interaction.customId);
		if (user === undefined || !customId) { return; }
		if (!interaction.isFromMessage()) { return; }

		const chosenPrefix = interaction.fields.getTextInputValue('startsWith');
		const chosenSuffix = interaction.fields.getTextInputValue('endsWith');

		if (customId.args[0] === 'add' && chosenPrefix.length <= 0 && chosenSuffix.length <= 0) {

			// This is always an update
			await respond(interaction, {
				components: getSetproxyMsg(user, activeQuid, Math.ceil(((activeQuid ? activeQuid.proxies : user.antiproxies).length + 1) / 24) - 1),
			}, 'update', interaction.message.id);
			return;
		}

		/* For each quid but the selected one, check if they already have the same prefix and suffix and send an error message if they do. */
		if (chosenPrefix.length > 0 || chosenSuffix.length > 0) {

			const quids = await Quid.findAll({ where: { userId: user.id } });
			for (const quid of quids) {

				if (quid.id === activeQuid?.id) { continue; }

				for (const proxy of quid.proxies) {

					const isSamePrefix = proxy[0] === chosenPrefix;
					const isSameSuffix = proxy[1] === chosenSuffix;
					if (isSamePrefix && isSameSuffix) {

						// This is always a reply
						await respond(interaction, {
							embeds: [new EmbedBuilder()
								.setColor(error_color)
								.setDescription(`The prefix \`${chosenPrefix || 'no prefix'}\` and the suffix \`${chosenSuffix || 'no suffix'}\` are already used for ${quid.name} and can't be used for ${activeQuid?.name ?? 'the anti-proxy'} as well.`)],
							ephemeral: true,
						});
						return;
					}
				}
			}

			if (hasName(activeQuid)) {

				for (const antiproxy of user.antiproxies) {

					const isSamePrefix = antiproxy[0] === chosenPrefix;
					const isSameSuffix = antiproxy[1] === chosenSuffix;
					if (isSamePrefix && isSameSuffix) {

						// This is always a reply
						await respond(interaction, {
							embeds: [new EmbedBuilder()
								.setColor(error_color)
								.setDescription(`The prefix \`${chosenPrefix || 'no prefix'}\` and the suffix \`${chosenSuffix || 'no suffix'}\` are already used for the anti-proxy and can't be used for ${activeQuid.name} as well.`)],
							ephemeral: true,
						});
						return;
					}
				}
			}
		}

		const proxyNumber = Number(customId.args[0]);
		const proxyOrAntiproxy = activeQuid ? 'proxy' : 'anti-proxy';

		const prefixReply = chosenPrefix === '' ? 'no prefix' : `prefix: \`${chosenPrefix}\``;
		const suffixReply = chosenSuffix === '' ? 'no suffix' : `suffix: \`${chosenSuffix}\``;
		const proxyReply = `${prefixReply} and ${suffixReply}`;

		const previousPrefix = activeQuid ? activeQuid.proxies[proxyNumber]?.[0] : user.antiproxies[proxyNumber]?.[0];
		const previousSuffix = activeQuid ? activeQuid.proxies[proxyNumber]?.[1] : user.antiproxies[proxyNumber]?.[1];
		const previousPrefixReply = previousPrefix === '' ? 'no prefix' : `prefix: \`${previousPrefix}\``;
		const previousSuffixReply = previousSuffix === '' ? 'no suffix' : `suffix: \`${previousSuffix}\``;
		const previousProxyReply = `${previousPrefixReply} and ${previousSuffixReply}`;

		const addOrEdit = `${customId.args[0] === 'add'
			? `added ${proxyOrAntiproxy}`
			: `edited ${proxyOrAntiproxy} from ${previousProxyReply} to`} ${proxyReply}`;
		const deleteOrAddOrEdit = (chosenPrefix.length <= 0 && chosenSuffix.length <= 0)
			? `deleted ${proxyOrAntiproxy} ${previousProxyReply}`
			: addOrEdit;

		/* Update the database and send a success messsage. */
		if (activeQuid) {

			const proxies = deepCopy(activeQuid.proxies);
			if (chosenPrefix.length <= 0 && chosenSuffix.length <= 0) { proxies.splice(proxyNumber, 1); }
			else { proxies[isNaN(proxyNumber) ? proxies.length : proxyNumber] = [chosenPrefix, chosenSuffix]; }
			await activeQuid.update({ proxies: proxies });
		}
		else {

			const antiproxies = deepCopy(user.antiproxies);
			if (chosenPrefix.length <= 0 && chosenSuffix.length <= 0) { antiproxies.splice(proxyNumber, 1); }
			else { antiproxies[isNaN(proxyNumber) ? antiproxies.length : proxyNumber] = [chosenPrefix, chosenSuffix]; }
			await user.update({ antiproxies: antiproxies });
		}

		// This is always an update
		await respond(interaction, {
			components: getSetproxyMsg(user, activeQuid, Math.ceil(((activeQuid ? activeQuid.proxies : user.antiproxies).length + 1) / 24) - 1),
		}, 'update', interaction.message.id);

		// This is always a followUp
		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(activeQuid?.color ?? default_color)
				.setAuthor(activeQuid ? {
					name: await getDisplayname(activeQuid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
					iconURL: activeQuid.avatarURL,
				} : null)
				.setTitle(`Successfully ${deleteOrAddOrEdit}!`)],
		});
		return;
	},
};

async function getMainPageContent(
	interaction: ChatInputCommandInteraction | ButtonInteraction,
	user: User,
	quid: Quid<true> | Quid<false> | undefined,
	userToServer: UserToServer | undefined,
	quidToServer: QuidToServer | undefined,
) {

	return {
		embeds: [new EmbedBuilder()
			.setColor(quid?.color ?? default_color)
			.setAuthor(hasName(quid) ? {
				name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
				iconURL: quid.avatarURL,
			} : null)
			.setTitle('What is a proxy and how do I use this command?')
			.setDescription('Proxying is a way to speak as if your quid was saying it. This means that your message will be replaced by one that has your quids name and avatar.')
			.setFields([
				{
					name: 'set proxy',
					value: 'This sets an indicator to the bot you want your message to be proxied. Only messages with those indicators will be proxied. Click the "Set?" button below to learn more.',
				}, {
					name: 'auto proxy',
					value: 'This will treat every message in a specific channel as if it was proxied, even if the proxy isn\'t included. Click the "Auto?" button below to learn more.',
				},
			])
			.setFooter(null)],
		components: [new ActionRowBuilder<ButtonBuilder>()
			.setComponents([
				new ButtonBuilder()
					.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, quid?.id ?? user.id, ['set', 'learnmore']))
					.setLabel('Set?')
					.setStyle(ButtonStyle.Success),
				new ButtonBuilder()
					.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, quid?.id ?? user.id, ['auto', 'learnmore']))
					.setLabel('Auto?')
					.setStyle(ButtonStyle.Success),
			])],
	};
}

function getAutoproxyComponents(
	user: User,
	quid: Quid<true> | Quid<false> | undefined,
	userToServer: UserToServer | undefined,
	isInGuild: boolean,
): (ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>)[] {

	return [
		new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, quid?.id ?? user.id, ['mainpage']))
				.setLabel('Back')
				.setEmoji('⬅️')
				.setStyle(ButtonStyle.Secondary)]),
		new ActionRowBuilder<StringSelectMenuBuilder>()
			.setComponents([new StringSelectMenuBuilder()
				.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, quid?.id ?? user.id, ['auto', 'setTo']))
				.setPlaceholder('Select what autoproxy setting you want to follow')
				.setOptions([
					...isInGuild === false ? [] : [{
						label: 'Follow global settings',
						value: `${AutoproxySetTo.followGlobal}`,
						default: userToServer?.autoproxy_setTo === AutoproxySetTo.followGlobal,
					}], {
						label: 'Off',
						value: `${AutoproxySetTo.off}`,
						default: userToServer?.autoproxy_setTo === AutoproxySetTo.off,
					}, {
						label: 'On with Select mode',
						value: `${AutoproxySetTo.onWithSelectMode}`,
						default: userToServer?.autoproxy_setTo === AutoproxySetTo.onWithSelectMode,
					}, {
						label: 'On with Sticky mode',
						value: `${AutoproxySetTo.onWithStickyMode}`,
						default: userToServer?.autoproxy_setTo === AutoproxySetTo.onWithStickyMode,
					},
				])]),
		...isInGuild === false ? [] : [new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, quid?.id ?? user.id, ['auto', 'advanced']))
				.setLabel('Advanced Options')
				.setEmoji('🔧')
				.setStyle(ButtonStyle.Primary)])],
	];
}

function getAdvancedAutoproxyComponents(
	allChannels: Collection<string, NonThreadGuildBasedChannel>,
	user: User,
	quid: Quid<true> | Quid<false> | undefined,
	userToServer: UserToServer | undefined,
	page: number,
): (ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>)[] {

	// If ChannelSelects ever allow for default values, then this could be implemented here. Right now, using default values clashes with the "Show more channels" feature
	let selectMenuOptions: RestOrArray<SelectMenuComponentOptionData> = allChannels.map((channel, channelId) => ({
		label: channel.name,
		value: constructSelectOptions<SelectOptionArgs>([channelId]),
		emoji: (userToServer && userToServer.autoproxy_setToWhitelist !== null && userToServer[userToServer.autoproxy_setToWhitelist ? 'autoproxy_whitelist' : 'autoproxy_blacklist'].includes(channelId)) ? '🔘' : undefined,
	}));

	if (selectMenuOptions.length > 25) {

		selectMenuOptions = selectMenuOptions.splice(page * 24, 24);
		selectMenuOptions.push({
			label: 'Show more channels',
			value: constructSelectOptions<SelectOptionArgs>(['nextpage', `${page}`]),
			description: `You are currently on page ${page + 1}`, emoji: '📋',
		});
	}

	return [
		new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, quid?.id ?? user.id, ['auto', 'learnmore']))
				.setLabel('Back')
				.setEmoji('⬅️')
				.setStyle(ButtonStyle.Secondary)]),
		new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, quid?.id ?? user.id, ['auto', 'channelListType']))
				.setLabel(`Currently ${userToServer?.autoproxy_setToWhitelist ? 'set to whitelist' : 'set to blacklist'}`)
				.setStyle(ButtonStyle.Secondary)]),
		new ActionRowBuilder<StringSelectMenuBuilder>()
			.setComponents([new StringSelectMenuBuilder()
				.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, quid?.id ?? user.id, ['auto', 'channelListOptions']))
				.setPlaceholder(`Select channels to ${userToServer?.autoproxy_setToWhitelist ? 'enable' : 'disable'} auto-proxying in`)
				.setOptions(selectMenuOptions)
				.setDisabled(userToServer === undefined || userToServer.autoproxy_setToWhitelist === null)]),
	];
}

function getSetproxyMsg(
	user: User,
	quid: Quid<true> | Quid<false> | undefined,
	page: number,
): (ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>)[] {

	// If ChannelSelects ever allow for default values, then this could be implemented here. Right now, using default values clashes with the "Show more channels" feature
	let selectMenuOptions: RestOrArray<SelectMenuComponentOptionData> = (quid ? quid.proxies : user.antiproxies).map((proxy, value) => ({
		label: `${proxy[0]}text${proxy[1]}`,
		value: constructSelectOptions<SelectOptionArgs>([`${value}`]),
	}));

	if (selectMenuOptions.length < 25) {

		selectMenuOptions.push({
			label: 'Add a proxy',
			value: constructSelectOptions<SelectOptionArgs>(['add']),
		});
	}

	if (selectMenuOptions.length > 25) {

		selectMenuOptions = selectMenuOptions.splice(page * 24, 24);
		selectMenuOptions.push({
			label: 'Show more proxies',
			value: constructSelectOptions<SelectOptionArgs>(['nextpage', `${page}`]),
			description: `You are currently on page ${page + 1}`, emoji: '📋',
		});
	}

	return [
		new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, quid?.id ?? user.id, ['mainpage']))
				.setLabel('Back')
				.setEmoji('⬅️')
				.setStyle(ButtonStyle.Secondary)]),
		new ActionRowBuilder<StringSelectMenuBuilder>()
			.setComponents([new StringSelectMenuBuilder()
				.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, quid?.id ?? user.id, ['set', 'modal']))
				.setPlaceholder('Add or select a proxy to change')
				.setOptions(selectMenuOptions)]),
	];
}