import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Collection, EmbedBuilder, ModalBuilder, NonThreadGuildBasedChannel, RestOrArray, StringSelectMenuBuilder, SelectMenuComponentOptionData, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { deepCopy, respond } from '../../utils/helperFunctions';
import { hasName } from '../../utils/checkUserState';
import { saveCommandDisablingInfo } from '../../utils/componentDisabling';
import { missingPermissions } from '../../utils/permissionHandler';
import { SlashCommand } from '../../typings/handle';
import { constructCustomId, constructSelectOptions, deconstructCustomId, deconstructSelectOptions } from '../../utils/customId';
import { getDisplayname } from '../../utils/getQuidInfo';
import UserToServer from '../../models/userToServer';
import Quid from '../../models/quid';
import User from '../../models/user';
import { generateId } from 'crystalid';
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
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer }) => {

		if (await missingPermissions(interaction, [
			'ViewChannel', // Needed because of createCommandComponentDisabler
		]) === true) { return; }

		/* If the user does not have a quid selected, return. */
		if (user === undefined) {

			hasName(undefined, { interaction, hasQuids: false }); // This is always a reply
			return;
		}

		// This is always a reply
		const { id: messageId } = await respond(interaction, {
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
					}, ...((hasName(quid) || !interaction.inGuild()) ? [{
						name: 'auto proxy',
						value: 'This will treat every message in a specific channel as if it was proxied, even if the proxy isn\'t included. Click the "Auto?" button below to learn more.',
					}] : []),
				])],
			components: [new ActionRowBuilder<ButtonBuilder>()
				.setComponents([
					new ButtonBuilder()
						.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, quid?.id ?? user.id, ['set', 'learnmore']))
						.setLabel('Set?')
						.setStyle(ButtonStyle.Success),
					...((hasName(quid) || !interaction.inGuild()) ? [new ButtonBuilder()
						.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, quid?.id ?? user.id, ['auto', 'learnmore']))
						.setLabel('Auto?')
						.setStyle(ButtonStyle.Success)] : []),
				])],
			fetchReply: true,
		});

		if (userToServer) { saveCommandDisablingInfo(userToServer, interaction, interaction.channelId, messageId); }
	},
	async sendMessageComponentResponse(interaction, { user, quid, userToServer, quidToServer }) {

		const customId = deconstructCustomId<CustomIdArgs>(interaction.customId);
		if (!customId) { throw TypeError('customId is null'); }
		if (user === undefined) { return; }

		/* If the user pressed the button to learn more about the set subcommand, explain it with a button that opens a modal. */
		if (interaction.isButton() && customId.args[0] === 'set' && customId.args[1] === 'learnmore') {

			// This is always an update to the message with the button
			await respond(interaction, {
				embeds: [new EmbedBuilder(interaction.message.embeds[0]?.toJSON())
					.setTitle('Here is how to use the set subcommand:')
					.setDescription('Proxying is a way to speak as if your quid was saying it. The proxy is an indicator to the bot you want your message to be proxied. It consists of a prefix (indicator before the message) and a suffix (indicator after the message). You can either set both or one of them.\n\nExamples:\nprefix: `<`, suffix: `>`, example message: `<hello friends>`\nprefix: `P: `, no suffix, example message: `P: hello friends`\nno prefix, suffix: ` -p`, example message: `hello friends -p`\nThis is case-sensitive (meaning that upper and lowercase matters).')
					.setFields()
					.setFooter({ text: hasName(quid) ? 'Tip: Use this command while no quid is selected to configure an "anti-proxy". That anti-proxy can be used to escape auto-proxying. It also turns off auto-proxying permanently while sticky-mode is on, until you use another proxy again.' : 'Caution: Since you currently have no quid selected, you are configuring an anti-proxy. This can be used to escape auto-proxying. It also turns off auto-proxying permanently while sticky-mode is on, until you use another proxy again. Select a quid from the profile-command to configure a proxy for that quid.' })],
				components: [new ActionRowBuilder<ButtonBuilder>()
					.setComponents([new ButtonBuilder()
						.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, quid?.id ?? user.id, ['set', 'modal']))
						.setLabel('Set proxy')
						.setStyle(ButtonStyle.Success)])],
			}, 'update', interaction.message.id);
			return;
		}

		/* If the user pressed the button to set their proxy, open the modal. */
		if (interaction.isButton() && customId.args[0] === 'set' && customId.args[1] === 'modal') {

			await interaction.showModal(new ModalBuilder()
				.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, quid?.id ?? user.id, []))
				.setTitle('Set a proxy')
				.addComponents(
					new ActionRowBuilder<TextInputBuilder>({
						components: [new TextInputBuilder()
							.setCustomId('startsWith')
							.setLabel('Prefix (indicator before the message)')
							.setStyle(TextInputStyle.Short)
							.setMaxLength(16)
							.setRequired(false)
							.setValue(quid?.proxy_startsWith ?? user.antiproxy_startsWith),
						],
					}),
					new ActionRowBuilder<TextInputBuilder>({
						components: [new TextInputBuilder()
							.setCustomId('endsWith')
							.setLabel('Suffix (indicator after the message)')
							.setStyle(TextInputStyle.Short)
							.setMaxLength(16)
							.setRequired(false)
							.setValue(quid?.proxy_endsWith ?? user.antiproxy_endsWith),
						],
					}),
				),
			);
			return;
		}

		if (!hasName(quid) && interaction.inGuild()) { return; }
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
				components: getAutoproxyComponents(allChannels, user, quid, userToServer, 0),
			}, 'update', interaction.message.id);
			return;
		}

		/* Responses for select menu selections */
		if (interaction.isButton() && customId.args[0] === 'auto' && customId.args[1] === 'setTo') {

			const oldSetting = userToServer?.autoproxy_setToWhitelist ?? null;
			const newSetting = oldSetting === null ? false : oldSetting === false ? true : null;

			if (!interaction.inGuild()) {

				await user.update({ proxy_globalAutoproxy: !user.proxy_globalAutoproxy });
			}
			else if (!userToServer) {

				userToServer = await UserToServer.create({
					id: generateId(), userId: user.id, serverId: interaction.guildId, autoproxy_setToWhitelist: newSetting,
				});
			}
			else {

				await userToServer.update({ autoproxy_setToWhitelist: newSetting });
			}

			// This is always an update to the message with the select menu
			await respond(interaction, {
				components: getAutoproxyComponents(allChannels, user, quid, userToServer, 0),
			}, 'update', interaction.message.id);

			// This is always a followUp
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(quid?.color ?? default_color)
					.setAuthor(hasName(quid) ? {
						name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					} : null)
					.setTitle(`Auto-proxying ${interaction.inGuild() ? ((newSetting === null) ? 'now follows the global setting' : `is now only ${newSetting === false ? 'disabled' : 'enabled'} in the ${newSetting === false ? 'blacklisted' : 'whitelisted'} channels`) : `is now ${user.proxy_globalAutoproxy === true ? 'enabled' : 'disabled'} globally`}!`)],
				ephemeral: true,
			});
		}

		if (interaction.isButton() && customId.args[0] === 'auto' && customId.args[1] === 'stickymode') {

			const oldSetting = userToServer?.stickymode_setTo ?? null;
			const newSetting = oldSetting === null ? true : oldSetting === true ? false : null;

			if (!interaction.inGuild()) {

				await user.update({ proxy_globalStickymode: !user.proxy_globalStickymode });
			}
			else if (!userToServer) {

				userToServer = await UserToServer.create({
					id: generateId(), userId: user.id, serverId: interaction.guildId, stickymode_setTo: newSetting,
				});
			}
			else {

				await userToServer.update({ stickymode_setTo: newSetting });
			}

			// This is always an update to the message with the select menu
			await respond(interaction, {
				components: getAutoproxyComponents(allChannels, user, quid, userToServer, 0),
			}, 'update', interaction.message.id);

			// This is always a followUp
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(quid?.color ?? default_color)
					.setAuthor(hasName(quid) ? {
						name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					} : null)
					.setTitle(`Sticky mode ${interaction.inGuild() ? ((newSetting === null) ? 'now follows the global setting' : `is now ${newSetting === false ? 'disabled' : 'enabled'} in this server`) : `is now ${user.proxy_globalStickymode === true ? 'enabled' : 'disabled'} globally`}!`)],
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
					components: getAutoproxyComponents(allChannels, user, quid, userToServer, page),
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
					components: getAutoproxyComponents(allChannels, user, quid, userToServer, page),
				}, 'update', interaction.message.id);

				// This is always a followUp
				await respond(interaction, {
					embeds: [new EmbedBuilder()
						.setColor(quid?.color ?? default_color)
						.setAuthor(hasName(quid) ? {
							name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
							iconURL: quid.avatarURL,
						} : null)
						.setTitle(`${hasChannel ? 'Removed' : 'Added'} ${interaction.guild.channels.cache.get(channelId)?.name} ${hasChannel ? 'from' : 'to'} the auto-proxy ${listType}!`)],
					ephemeral: true,
				});
			}
		}

	},
	async sendModalResponse(interaction, { user, quid: activeQuid, userToServer, quidToServer }) {

		const customId = deconstructCustomId<CustomIdArgs>(interaction.customId);
		if (user === undefined || !customId) { return; } // This is always a reply

		const chosenPrefix = interaction.fields.getTextInputValue('startsWith');
		const chosenSuffix = interaction.fields.getTextInputValue('endsWith');

		/* For each quid but the selected one, check if they already have the same prefix and suffix and send an error message if they do. */
		const quids = await Quid.findAll({ where: { userId: user.id } });
		for (const quid of quids) {

			if (quid.id === activeQuid?.id) { continue; }

			const isSamePrefix = quid.proxy_startsWith === chosenPrefix;
			const isSameSuffix = quid.proxy_endsWith === chosenSuffix;
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

		if (hasName(activeQuid)) {

			const isSamePrefix = user.antiproxy_startsWith === chosenPrefix;
			const isSameSuffix = user.antiproxy_endsWith === chosenSuffix;
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

		/* Update the database and send a success messsage. */
		if (hasName(activeQuid)) {

			await activeQuid.update({ proxy_startsWith: chosenPrefix, proxy_endsWith: chosenSuffix });
		}
		else {

			await user.update({ antiproxy_startsWith: chosenPrefix, antiproxy_endsWith: chosenSuffix });
		}

		const prefixResponse = chosenPrefix === '' ? 'no prefix' : `prefix: \`${chosenPrefix}\``;
		const suffixResponse = chosenSuffix === '' ? 'no suffix' : `suffix: \`${chosenSuffix}\``;
		// This is always a reply
		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(activeQuid?.color ?? default_color)
				.setAuthor(hasName(activeQuid) ? {
					name: await getDisplayname(activeQuid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
					iconURL: activeQuid.avatarURL,
				} : null)
				.setTitle(`${hasName(activeQuid) ? 'Proxy' : 'Anti-proxy'} set to ${prefixResponse} and ${suffixResponse}!`)],
		});
		return;
	},
};

function getAutoproxyComponents(
	allChannels: Collection<string, NonThreadGuildBasedChannel> | null,
	user: User,
	quid: Quid | undefined,
	userToServer: UserToServer | undefined,
	page: number,
): (ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>)[] {

	// If ChannelSelects ever allow for default values, then this could be implemented here. Right now, using default values clashes with the "Show more channels" feature
	let selectMenuOptions: RestOrArray<SelectMenuComponentOptionData> | undefined = allChannels?.map((channel, channelId) => ({
		label: channel.name,
		value: constructSelectOptions<SelectOptionArgs>([channelId]),
		emoji: (userToServer && userToServer.autoproxy_setToWhitelist !== null && userToServer[userToServer.autoproxy_setToWhitelist ? 'autoproxy_whitelist' : 'autoproxy_blacklist'].includes(channelId)) ? '🔘' : undefined,
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
				.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, quid?.id ?? user.id, ['auto', 'setTo']))
				.setLabel(selectMenuOptions !== undefined ? `Currently ${userToServer?.autoproxy_setToWhitelist ? 'set to whitelist' : userToServer?.autoproxy_setToWhitelist === false ? 'set to blacklist' : 'follows global setting'}` : `Auto-proxying is ${user.proxy_globalAutoproxy ? 'enabled' : 'disabled'}`)
				.setStyle(ButtonStyle.Secondary)]),
		...selectMenuOptions !== undefined ? [new ActionRowBuilder<StringSelectMenuBuilder>()
			.setComponents([new StringSelectMenuBuilder()
				.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, quid?.id ?? user.id, ['auto', 'options']))
				.setPlaceholder(`Select channels to ${userToServer?.autoproxy_setToWhitelist ? 'enable' : 'disable'} auto-proxying in`)
				.setOptions(selectMenuOptions)
				.setDisabled(userToServer === undefined || userToServer.autoproxy_setToWhitelist === null)])] : [],
		new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, quid?.id ?? user.id, ['auto', 'stickymode']))
				.setLabel(`Sticky mode ${(selectMenuOptions !== undefined ? userToServer?.stickymode_setTo === false : user.proxy_globalStickymode === false) ? 'is disabled' : (selectMenuOptions !== undefined ? userToServer?.stickymode_setTo === true : user.proxy_globalStickymode === true) ? 'is enabled' : 'follows global setting'}`)
				.setStyle(ButtonStyle.Secondary)]),
	];
}