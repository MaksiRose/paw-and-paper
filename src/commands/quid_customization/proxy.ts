import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Collection, EmbedBuilder, ModalBuilder, NonThreadGuildBasedChannel, RestOrArray, StringSelectMenuBuilder, SelectMenuComponentOptionData, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { respond } from '../../utils/helperFunctions';
import { hasName } from '../../utils/checkUserState';
import { saveCommandDisablingInfo } from '../../utils/componentDisabling';
import { getMapData } from '../../utils/helperFunctions';
import { missingPermissions } from '../../utils/permissionHandler';
import { SlashCommand } from '../../typings/handle';
import { AutoproxyConfigType, StickymodeConfigType, UserData } from '../../typings/data/user';
import { constructCustomId, constructSelectOptions, deconstructCustomId, deconstructSelectOptions } from '../../utils/customId';
const { error_color, default_color } = require('../../../config.json');

type CustomIdArgs = [] | ['set', 'learnmore' | 'modal'] | ['auto', 'learnmore' | 'options' | 'setTo' | 'stickymode']
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
	sendCommand: async (interaction, userData) => {

		if (await missingPermissions(interaction, [
			'ViewChannel', // Needed because of createCommandComponentDisabler
		]) === true) { return; }

		/* If the user does not have a quid selected, return. */
		if (userData === null) {

			hasName(userData, interaction);// This is always a reply
			return;
		}

		// This is always a reply
		const { id: messageId } = await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(userData.quid?.color ?? default_color)
				.setAuthor(hasName(userData) ? { name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL } : null)
				.setTitle('What is a proxy and how do I use this command?')
				.setDescription('Proxying is a way to speak as if your quid was saying it. This means that your message will be replaced by one that has your quids name and avatar.')
				.setFields([
					{
						name: 'set proxy',
						value: 'This sets an indicator to the bot you want your message to be proxied. Only messages with those indicators will be proxied. Click the "Set?" button below to learn more.',
					}, ...(hasName(userData) ? [{
						name: 'auto proxy',
						value: 'This will treat every message in a specific channel as if it was proxied, even if the proxy isn\'t included. Click the "Auto?" button below to learn more.',
					}] : []),
				])],
			components: [new ActionRowBuilder<ButtonBuilder>()
				.setComponents([
					new ButtonBuilder()
						.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData.quid?._id ?? userData._id, ['set', 'learnmore']))
						.setLabel('Set?')
						.setStyle(ButtonStyle.Success),
					...(hasName(userData) ? [new ButtonBuilder()
						.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData.quid._id, ['auto', 'learnmore']))
						.setLabel('Auto?')
						.setStyle(ButtonStyle.Success)] : []),
				])],
			fetchReply: true,
		});

		saveCommandDisablingInfo(userData, interaction.guildId || 'DMs', interaction.channelId, messageId, interaction);
	},
	async sendMessageComponentResponse(interaction, userData) {

		const customId = deconstructCustomId<CustomIdArgs>(interaction.customId);
		if (!customId) { throw TypeError('customId is null'); }
		if (userData === null) { return; }

		/* If the user pressed the button to learn more about the set subcommand, explain it with a button that opens a modal. */
		if (interaction.isButton() && customId.args[0] === 'set' && customId.args[1] === 'learnmore') {

			// This is always an update to the message with the button
			await respond(interaction, {
				embeds: [new EmbedBuilder(interaction.message.embeds[0]?.toJSON())
					.setTitle('Here is how to use the set subcommand:')
					.setDescription('Proxying is a way to speak as if your quid was saying it. The proxy is an indicator to the bot you want your message to be proxied. It consists of a prefix (indicator before the message) and a suffix (indicator after the message). You can either set both or one of them.\n\nExamples:\nprefix: `<`, suffix: `>`, example message: `<hello friends>`\nprefix: `P: `, no suffix, example message: `P: hello friends`\nno prefix, suffix: ` -p`, example message: `hello friends -p`\nThis is case-sensitive (meaning that upper and lowercase matters).')
					.setFields()
					.setFooter({ text: hasName(userData) ? 'Tip: Use this command while no quid is selected to configure an "anti-proxy". That anti-proxy can be used to escape auto-proxying. It also turns off auto-proxying permanently while sticky-mode is on, until you use another proxy again.' : 'Caution: Since you currently have no quid selected, you are configuring an anti-proxy. This can be used to escape auto-proxying. It also turns off auto-proxying permanently while sticky-mode is on, until you use another proxy again. Select a quid from the profile-command to configure a proxy for that quid.' })],
				components: [new ActionRowBuilder<ButtonBuilder>()
					.setComponents([new ButtonBuilder()
						.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData.quid?._id ?? userData._id, ['set', 'modal']))
						.setLabel('Set proxy')
						.setStyle(ButtonStyle.Success)])],
			}, 'update', interaction.message.id);
			return;
		}

		/* If the user pressed the button to set their proxy, open the modal. */
		if (interaction.isButton() && customId.args[0] === 'set' && customId.args[1] === 'modal') {

			await interaction.showModal(new ModalBuilder()
				.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData.quid?._id ?? userData._id, []))
				.setTitle('Set a proxy')
				.addComponents(
					new ActionRowBuilder<TextInputBuilder>({
						components: [new TextInputBuilder()
							.setCustomId('startsWith')
							.setLabel('Prefix (indicator before the message)')
							.setStyle(TextInputStyle.Short)
							.setMaxLength(16)
							.setRequired(false)
							.setValue(userData.quid?.proxy.startsWith ?? userData.antiproxy.startsWith),
						],
					}),
					new ActionRowBuilder<TextInputBuilder>({
						components: [new TextInputBuilder()
							.setCustomId('endsWith')
							.setLabel('Suffix (indicator after the message)')
							.setStyle(TextInputStyle.Short)
							.setMaxLength(16)
							.setRequired(false)
							.setValue(userData.quid?.proxy.endsWith ?? userData.antiproxy.endsWith),
						],
					}),
				),
			);
			return;
		}

		if (!hasName(userData)) { return; }
		const allChannels = interaction.inGuild() ? (await interaction.guild?.channels?.fetch() ?? new Collection()).filter((c): c is NonThreadGuildBasedChannel => c !== null && c.permissionsFor(interaction.client.user.id)?.has('ViewChannel') != false && c.permissionsFor(interaction.client.user.id)?.has('SendMessages') != false && c.permissionsFor(interaction.user.id)?.has('ViewChannel') != false && c.permissionsFor(interaction.user.id)?.has('SendMessages') != false) : null;

		/* If the user pressed the button to learn more about the auto subcommand, explain it with a select menu to select channels. */
		if (interaction.isButton() && customId.args[0] === 'auto' && customId.args[1] === 'learnmore') {

			// This is always an update to the message with the button
			await respond(interaction, {
				embeds: [new EmbedBuilder(interaction.message.embeds[0]?.toJSON())
					.setTitle('Here is how to use the auto subcommand:')
					.setDescription(`${interaction.inGuild() ? '' : '**IMPORTANT:** Due to discord limitations, this feature only works in servers.\n\n'}Auto-proxying means that every message you send will be treated as if it was proxied, even if the proxy isn\`t included.\n\nPressing the first button allows you to ${interaction.inGuild() ? 'toggle between the global setting, a blacklist and a whitelist. When this is set to blacklist, auto-proxying is *only disabled* in the selected channels. When it is set to whitelist, auto-proxying is *only enabled* in the selected channels.\n\nUsing the drop-down menu, you can select the channels for the black-/whitelist.' : 'enable or disable this globally.'}\n\nUse the second button to toggle sticky mode. When enabled, a different quid will be auto-proxied when their proxy is used once. Sticky mode will only work cross-server when enabled globally and following global settings in the server.`)
					.setFields()
					.setFooter({ text: interaction.inGuild() ? 'Tip: Use this command in DMs to change global (cross-server) proxy settings.' : 'Tip: Use this command in a server to overwrite these global (cross-server) proxy settings for that server.' })],
				components: getAutoproxyComponents(allChannels, userData, 0),
			}, 'update', interaction.message.id);
			return;
		}

		/* Responses for select menu selections */
		if (interaction.isButton() && customId.args[0] === 'auto' && customId.args[1] === 'setTo') {

			const oldSetting = userData.settings.proxy.server?.autoproxy.setTo ?? AutoproxyConfigType.FollowGlobal;
			const newSetting = oldSetting === AutoproxyConfigType.FollowGlobal ? AutoproxyConfigType.Blacklist : oldSetting === AutoproxyConfigType.Blacklist ? AutoproxyConfigType.Whitelist : AutoproxyConfigType.FollowGlobal;

			userData.update(
				(u) => {
					if (interaction.inGuild()) {
						const sps = u.settings.proxy.servers[interaction.guildId];
						if (!sps) {
							u.settings.proxy.servers[interaction.guildId] = {
								autoproxy: {
									setTo: newSetting,
									channels: {
										whitelist: [],
										blacklist: [],
									},
								},
								stickymode: StickymodeConfigType.FollowGlobal,
							};
						}
						else { sps.autoproxy.setTo = newSetting; }
					}
					else {
						u.settings.proxy.global.autoproxy = !u.settings.proxy.global.autoproxy;
					}
				},
			);

			// This is always an update to the message with the select menu
			await respond(interaction, {
				components: getAutoproxyComponents(allChannels, userData, 0),
			}, 'update', interaction.message.id);

			// This is always a followUp
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(userData.quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setTitle(`Auto-proxying ${interaction.inGuild() ? ((newSetting === AutoproxyConfigType.FollowGlobal) ? 'now follows the global setting' : `is now only ${newSetting === AutoproxyConfigType.Blacklist ? 'disabled' : 'enabled'} in the ${newSetting === AutoproxyConfigType.Blacklist ? 'blacklisted' : 'whitelisted'} channels`) : `is now ${userData.settings.proxy.global.autoproxy === true ? 'enabled' : 'disabled'} globally`}!`)],
				ephemeral: true,
			});
		}

		if (interaction.isButton() && customId.args[0] === 'auto' && customId.args[1] === 'stickymode') {

			const oldSetting = userData.settings.proxy.server?.stickymode ?? StickymodeConfigType.FollowGlobal;
			const newSetting = oldSetting === StickymodeConfigType.FollowGlobal ? StickymodeConfigType.Enabled : oldSetting === StickymodeConfigType.Enabled ? StickymodeConfigType.Disabled : StickymodeConfigType.FollowGlobal;

			userData.update(
				(u) => {
					if (interaction.inGuild()) {
						const sps = u.settings.proxy.servers[interaction.guildId];
						if (!sps) {
							u.settings.proxy.servers[interaction.guildId] = {
								autoproxy: {
									setTo: AutoproxyConfigType.FollowGlobal,
									channels: {
										whitelist: [],
										blacklist: [],
									},
								},
								stickymode: newSetting,
							};
						}
						else { sps.stickymode = newSetting; }
					}
					else { u.settings.proxy.global.stickymode = !u.settings.proxy.global.stickymode; }
				},
			);

			// This is always an update to the message with the select menu
			await respond(interaction, {
				components: getAutoproxyComponents(allChannels, userData, 0),
			}, 'update', interaction.message.id);

			// This is always a followUp
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(userData.quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setTitle(`Sticky mode ${interaction.inGuild() ? ((newSetting === StickymodeConfigType.FollowGlobal) ? 'now follows the global setting' : `is now ${newSetting === StickymodeConfigType.Disabled ? 'disabled' : 'enabled'} in this server`) : `is now ${userData.settings.proxy.global.stickymode === true ? 'enabled' : 'disabled'} globally`}!`)],
				ephemeral: true,
			});
		}

		if (interaction.inCachedGuild() && interaction.isStringSelectMenu() && customId.args[0] === 'auto' && customId.args[1] === 'options') {

			let page = 0;
			const selectOptionId = deconstructSelectOptions<SelectOptionArgs>(interaction)[0];
			if (selectOptionId === undefined) { throw new TypeError('selectOptionId is undefined'); }

			/* If the user clicked the next page option, increment the page. */
			if (selectOptionId[0] === 'nextpage') {

				page = Number(selectOptionId[1]) + 1;
				if (page >= Math.ceil((allChannels!.size + 1) / 24)) { page = 0; }

				// This is always an update to the message with the select menu
				await respond(interaction, {
					components: getAutoproxyComponents(allChannels, userData, page),
				}, 'update', interaction.message.id);
			}
			/* If the user clicked an always subcommand option, add/remove the channel and send a success message. */
			else {

				const channelId = selectOptionId[0];
				const listType = userData.settings.proxy.server?.autoproxy.setTo !== AutoproxyConfigType.Blacklist ? 'whitelist' : 'blacklist';
				const hasChannel = userData.settings.proxy.server?.autoproxy.channels[listType].includes(channelId) || false;

				await userData.update(
					(u) => {
						const sps = u.settings.proxy.servers[interaction.guildId];
						if (!sps) {
							u.settings.proxy.servers[interaction.guildId] = {
								autoproxy: {
									setTo: AutoproxyConfigType.Whitelist,
									channels: {
										whitelist: [channelId],
										blacklist: [],
									},
								},
								stickymode: StickymodeConfigType.FollowGlobal,
							};
						}
						else if (!hasChannel) { sps.autoproxy.channels[listType].push(channelId); }
						else { sps.autoproxy.channels[listType] = sps.autoproxy.channels[listType].filter(string => string !== channelId); }
					},
				);

				// This is always an update to the message with the select menu
				await respond(interaction, {
					components: getAutoproxyComponents(allChannels, userData, page),
				}, 'update', interaction.message.id);

				// This is always a followUp
				await respond(interaction, {
					embeds: [new EmbedBuilder()
						.setColor(userData.quid.color)
						.setAuthor({
							name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
							iconURL: quid.avatarURL,
						})
						.setTitle(`${hasChannel ? 'Removed' : 'Added'} ${interaction.guild.channels.cache.get(channelId)?.name} ${hasChannel ? 'from' : 'to'} the auto-proxy ${listType}!`)],
					ephemeral: true,
				});
			}
		}

	},
	async sendModalResponse(interaction, userData) {

		const customId = deconstructCustomId<CustomIdArgs>(interaction.customId);
		if (userData === null || !customId) { return; } // This is always a reply

		const chosenPrefix = interaction.fields.getTextInputValue('startsWith');
		const chosenSuffix = interaction.fields.getTextInputValue('endsWith');

		/* For each quid but the selected one, check if they already have the same prefix and suffix and send an error message if they do. */
		for (const quid of userData.quids.values()) {

			if (quid._id === userData.quid?._id) { continue; }

			const isSamePrefix = quid.proxy.startsWith === chosenPrefix;
			const isSameSuffix = quid.proxy.endsWith === chosenSuffix;
			if (isSamePrefix && isSameSuffix) {

				// This is always a reply
				await respond(interaction, {
					embeds: [new EmbedBuilder()
						.setColor(error_color)
						.setDescription(`The prefix \`${chosenPrefix || 'no prefix'}\` and the suffix \`${chosenSuffix || 'no suffix'}\` are already used for ${quid.name} and can't be used for ${userData.quid?.name ?? 'the anti-proxy'} as well.`)],
					ephemeral: true,
				});
				return;
			}
		}

		if (hasName(userData)) {

			const isSamePrefix = userData.antiproxy.startsWith === chosenPrefix;
			const isSameSuffix = userData.antiproxy.endsWith === chosenSuffix;
			if (isSamePrefix && isSameSuffix) {

				// This is always a reply
				await respond(interaction, {
					embeds: [new EmbedBuilder()
						.setColor(error_color)
						.setDescription(`The prefix \`${chosenPrefix || 'no prefix'}\` and the suffix \`${chosenSuffix || 'no suffix'}\` are already used for the anti-proxy and can't be used for ${userData.quid.name} as well.`)],
					ephemeral: true,
				});
				return;
			}
		}

		/* Update the database and send a success messsage. */
		await userData.update(
			(u) => {
				if (hasName(userData)) {

					const q = getMapData(u.quids, userData.quid._id);
					q.proxy.startsWith = chosenPrefix;
					q.proxy.endsWith = chosenSuffix;
				}
				else {
					u.antiproxy.startsWith = chosenPrefix;
					u.antiproxy.endsWith = chosenSuffix;
				}
			},
		);

		const prefixResponse = chosenPrefix === '' ? 'no prefix' : `prefix: \`${chosenPrefix}\``;
		const suffixResponse = chosenSuffix === '' ? 'no suffix' : `suffix: \`${chosenSuffix}\``;
		// This is always a reply
		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(userData.quid?.color ?? default_color)
				.setAuthor(hasName(userData) ? { name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL } : null)
				.setTitle(`${hasName(userData) ? 'Proxy' : 'Anti-proxy'} set to ${prefixResponse} and ${suffixResponse}!`)],
		});
		return;
	},
};

function getAutoproxyComponents(
	allChannels: Collection<string, NonThreadGuildBasedChannel> | null,
	userData: UserData<never, ''>,
	page: number,
): (ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>)[] {

	// If ChannelSelects ever allow for default values, then this could be implemented here. Right now, using default values clashes with the "Show more channels" feature
	let selectMenuOptions: RestOrArray<SelectMenuComponentOptionData> | undefined = allChannels?.map((channel, channelId) => ({
		label: channel.name,
		value: constructSelectOptions<SelectOptionArgs>([channelId]),
		emoji: userData.settings.proxy.server?.autoproxy.channels[userData.settings.proxy.server.autoproxy.setTo === AutoproxyConfigType.Whitelist ? 'whitelist' : 'blacklist'].includes(channelId) ? '🔘' : undefined,
	}));

	if (selectMenuOptions !== undefined && selectMenuOptions.length > 25) {

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
				.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData.quid._id, ['auto', 'setTo']))
				.setLabel(selectMenuOptions !== undefined ? `Currently ${userData.settings.proxy.server?.autoproxy.setTo === AutoproxyConfigType.Blacklist ? 'set to blacklist' : userData.settings.proxy.server?.autoproxy.setTo === AutoproxyConfigType.Whitelist ? 'set to whitelist' : 'follows global setting'}` : `Auto-proxying is ${userData.settings.proxy.global.autoproxy === true ? 'enabled' : 'disabled'}`)
				.setStyle(ButtonStyle.Secondary)]),
		...selectMenuOptions !== undefined ? [new ActionRowBuilder<StringSelectMenuBuilder>()
			.setComponents([new StringSelectMenuBuilder()
				.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData.quid._id, ['auto', 'options']))
				.setPlaceholder(`Select channels to ${userData.settings.proxy.server?.autoproxy.setTo === AutoproxyConfigType.Whitelist ? 'enable' : 'disable'} auto-proxying in`)
				.setOptions(selectMenuOptions)
				.setDisabled(userData.settings.proxy.server === undefined || userData.settings.proxy.server.autoproxy.setTo === AutoproxyConfigType.FollowGlobal)])] : [],
		new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData.quid._id, ['auto', 'stickymode']))
				.setLabel(`Sticky mode ${(selectMenuOptions !== undefined ? userData.settings.proxy.server?.stickymode === StickymodeConfigType.Disabled : userData.settings.proxy.global.stickymode === false) ? 'is disabled' : (selectMenuOptions !== undefined ? userData.settings.proxy.server?.stickymode === StickymodeConfigType.Enabled : userData.settings.proxy.global.stickymode === true) ? 'is enabled' : 'follows global setting'}`)
				.setStyle(ButtonStyle.Secondary)]),
	];
}