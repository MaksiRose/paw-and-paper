import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChannelType, Collection, EmbedBuilder, ModalBuilder, ModalSubmitInteraction, NonThreadGuildBasedChannel, SelectMenuBuilder, SelectMenuInteraction, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { respond } from '../../events/interactionCreate';
import serverModel from '../../models/serverModel';
import userModel from '../../models/userModel';
import { Character, ServerSchema, SlashCommand, UserSchema } from '../../typedef';
import { hasName } from '../../utils/checkAccountCompletion';
import { createCommandComponentDisabler } from '../../utils/componentDisabling';
const { default_color, error_color } = require('../../../config.json');

const name: SlashCommand['name'] = 'proxy';
const description: SlashCommand['description'] = 'Add a proxy or autoproxy for your character.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.toJSON(),
	disablePreviousCommand: true,
	sendCommand: async (client, interaction, userData) => {

		/* If the user is not the admin of a server nor do they have a character selected, return.
		The admin check is done since admins can configure where messages can be sent. */
		if (!(interaction.inCachedGuild() && interaction.member.permissions.has('Administrator')) && !hasName(interaction, userData)) { return; }

		const characterData = userData ? userData.characters[userData.currentCharacter[interaction.guildId || 'DM']] : null;

		/* Send a response to the user. */
		const botReply = await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(characterData?.color || default_color)
				.setAuthor(characterData ? { name: characterData.name, iconURL: characterData.avatarURL } : null)
				.setTitle('What is a proxy and how do I use this command?')
				.setDescription('Proxying is a way to speak as if your character was saying it. This means that your message will be replaced by one that has your characters name and avatar.')
				.setFields([
					...(characterData && characterData?.name !== '' ? [{
						name: 'set proxy',
						value: 'This sets an indicator to the bot you want your message to be proxied. Only messages with those indicators will be proxied. Click the "Set?" button below to learn more.',
					}, ...(interaction.inGuild() ? [{
						name: 'always proxy',
						value: 'This will treat every message in a specific channel as if it was proxied, even if the proxy isn\'t included. Click the "Always?" button below to learn more.',
					}] : []),
					] : []),
					...(interaction.inCachedGuild() && interaction.member.permissions.has('Administrator') ? [{
						name: 'disable proxy',
						value: 'This is an __administrator__ setting that can toggle whether `always` or `all` proxy should be disabled or enabled in a specific channel. Click the "Disable?" Button below to learn more.',
					}] : []),
				])],
			components: [new ActionRowBuilder<ButtonBuilder>()
				.setComponents([
					...(userData && characterData && characterData?.name !== '' ? [
						new ButtonBuilder()
							.setCustomId(`proxy_set_learnmore_${characterData._id}`)
							.setLabel('Set?')
							.setStyle(ButtonStyle.Success),
						...(interaction.inGuild() ? [new ButtonBuilder()
							.setCustomId(`proxy_always_learnmore_${characterData._id}`)
							.setLabel('Always?')
							.setStyle(ButtonStyle.Success)] : []),
					] : []),
					...(interaction.inCachedGuild() && interaction.member.permissions.has('Administrator') ? [
						new ButtonBuilder()
							.setCustomId('proxy_disable_learnmore')
							.setLabel('Disable?')
							.setStyle(ButtonStyle.Success),
					] : []),
				])],
		}, true)
			.catch((error) => { throw new Error(error); });

		if (userData) { createCommandComponentDisabler(userData.uuid, interaction.guildId || 'DM', botReply); }
	},
};

export async function proxyInteractionCollector(interaction: ButtonInteraction | SelectMenuInteraction, userData: UserSchema | null, serverData: ServerSchema | null): Promise<void> {

	/* If the user pressed the button to learn more about the set subcommand, explain it with a button that opens a modal. */
	if (interaction.isButton() && interaction.customId.startsWith('proxy_set_learnmore')) {

		const characterDataId = interaction.customId.split('_')[3];

		await interaction
			.update({
				embeds: [new EmbedBuilder(interaction.message.embeds[0].toJSON())
					.setTitle('Here is how to use the set subcommand:')
					.setDescription('Proxying is a way to speak as if your character was saying it. The proxy is an indicator to the bot you want your message to be proxied. It consists of a prefix (indicator before the message) and a suffix (indicator after the message). You can either set both or one of them.\n\nExamples:\nprefix: `<`, suffix: `>`, example message: `<hello friends>`\nprefix: `P: `, no suffix, example message: `P: hello friends`\nno prefix, suffix: ` -p`, example message: `hello friends -p`\nThis is case-sensitive (meaning that upper and lowercase matters).')
					.setFields()],
				components: [new ActionRowBuilder<ButtonBuilder>()
					.setComponents([new ButtonBuilder()
						.setCustomId(`proxy_set_modal_${characterDataId}`)
						.setLabel('Set proxy')
						.setStyle(ButtonStyle.Success)])],
			}).catch((error) => { throw new Error(error); });
		return;
	}

	/* If the user pressed the button to set their proxy, open the modal. */
	if (interaction.isButton() && interaction.customId.startsWith('proxy_set_modal')) {

		const characterData = userData ? userData.characters[interaction.customId.split('_')[3]] : null;
		if (!characterData) { throw new Error('characterData is null'); }

		interaction.showModal(new ModalBuilder()
			.setCustomId(`proxy_set_${characterData._id}`)
			.setTitle('Set a proxy')
			.addComponents(
				new ActionRowBuilder<TextInputBuilder>({
					components: [new TextInputBuilder()
						.setCustomId('proxy_textinput_startsWith')
						.setLabel('Prefix (indicator before the message)')
						.setStyle(TextInputStyle.Short)
						.setMaxLength(16)
						.setValue(characterData.proxy.startsWith),
					],
				}),
				new ActionRowBuilder<TextInputBuilder>({
					components: [new TextInputBuilder()
						.setCustomId('proxy_textinput_endsWith')
						.setLabel('Suffix (indicator after the message)')
						.setStyle(TextInputStyle.Short)
						.setMaxLength(16)
						.setValue(characterData.proxy.endsWith),
					],
				}),
			),
		);
	}

	const allChannels = (await interaction.guild?.channels?.fetch() || new Collection()).filter(c => c.type === ChannelType.GuildText && c.viewable && c.permissionsFor(interaction.client.user?.id || '')?.has('SendMessages') == true && c.permissionsFor(interaction.user.id)?.has('ViewChannel') == true && c.permissionsFor(interaction.user.id)?.has('SendMessages') == true);

	/* If the user pressed the button to learn more about the always subcommand, explain it with a select menu to select channels. */
	if (interaction.isButton() && interaction.customId.startsWith('proxy_always_learnmore')) {

		if (!interaction.inGuild()) { throw new Error('Interaction is not in guild'); }
		const characterData = userData ? userData.characters[interaction.customId.split('_')[3]] : null;
		const { alwaysSelectMenu } = await getSelectMenus(allChannels, userData, characterData, serverData, 0);

		await interaction
			.update({
				embeds: [new EmbedBuilder(interaction.message.embeds[0].toJSON())
					.setTitle('Here is how to use the always subcommand:')
					.setDescription('When this feature is enabled, every message you send will be treated as if it was proxied, even if the proxy isn\'t included.\nYou can either toggle it for the entire server, or specific channels, using the drop-down menu below. Enabled channels will have a radio emoji next to it.')
					.setFields()],
				components: [new ActionRowBuilder<SelectMenuBuilder>()
					.setComponents([alwaysSelectMenu])],
			}).catch((error) => { throw new Error(error); });
		return;
	}

	/* If the user pressed the button to learn more about the disable subcommand, explain it with two select menus to select channels. */
	if (interaction.isButton() && interaction.customId.startsWith('proxy_disable_learnmore')) {

		if (!interaction.inGuild()) { throw new Error('Interaction is not in guild'); }
		const { disableAutoSelectMenu, disableAllSelectMenu } = await getSelectMenus(allChannels, null, null, serverData, 0);

		await interaction
			.update({
				embeds: [new EmbedBuilder(interaction.message.embeds[0].toJSON())
					.setTitle('Here is how to use the disable subcommand:')
					.setDescription('This is an **administrator** setting that can toggle whether `automatic` or `all` proxy should be disabled or enabled in specific channels, or in the entire server, using the drop-down menus below. Disabled channels will have a radio emoji next to it.')
					.setFields()],
				components: [new ActionRowBuilder<SelectMenuBuilder>()
					.setComponents([disableAutoSelectMenu]),
				new ActionRowBuilder<SelectMenuBuilder>()
					.setComponents([disableAllSelectMenu])],
			}).catch((error) => { throw new Error(error); });
		return;
	}

	/* Responses for select menu selections */
	if (interaction.isSelectMenu() && interaction.inCachedGuild()) {

		let page = 0;
		let characterData: Character | null = null;

		/* If the user clicked the next page option, increment the page. */
		if (interaction.values[0].includes('nextpage')) {

			page = Number(interaction.values[0].split('nextpage_')[1]) + 1;
			if (page >= Math.ceil((allChannels.size + 1) / 24)) { page = 0; }
		}
		/* If the user clicked an always subcommand option, add/remove the channel and send a success message. */
		else if (interaction.customId.startsWith('proxy_always_options')) {

			const channelId = interaction.values[0].replace('proxy_', '');
			const hasChannel = userData && userData.autoproxy[interaction.guildId] !== undefined && userData.autoproxy[interaction.guildId].includes(channelId);

			userData = await userModel.findOneAndUpdate(
				{ uuid: userData?.uuid },
				(u) => {
					if (u.autoproxy[interaction.guildId] === undefined) { u.autoproxy[interaction.guildId] = [channelId]; }
					else if (!hasChannel) { u.autoproxy[interaction.guildId].push(channelId); }
					else { u.autoproxy[interaction.guildId] = u.autoproxy[interaction.guildId].filter(string => string !== channelId); }
				},
			);
			characterData = userData.characters[interaction.customId.split('_')[3]];

			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(characterData.color)
					.setAuthor({ name: characterData.name, iconURL: characterData.avatarURL })
					.setTitle(`${hasChannel ? 'Removed' : 'Added'} ${channelId === 'everywhere' ? channelId : interaction.guild.channels.cache.get(channelId)?.name} ${hasChannel ? 'from' : 'to'} the list of automatic proxy channels!`)],
				ephemeral: true,
			}, false)
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
		}
		/* If the user clicked a disable subcommand option, add/remove the channel and send a success message. */
		else if (interaction.customId.startsWith('proxy_disable_')) {

			const kind = interaction.customId.includes('all') ? 'all' : 'auto';
			const channelId = interaction.values[0].replace('proxy_all_', '');
			const hasChannel = serverData && serverData.proxysetting[kind].includes(channelId);

			serverData = await serverModel.findOneAndUpdate(
				{ serverId: interaction.guildId },
				(s) => {
					if (!hasChannel) { s.proxysetting[kind].push(channelId); }
					else { s.proxysetting[kind] = s.proxysetting[kind].filter(string => string !== channelId); }
				},
			);

			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(interaction.member.displayColor)
					.setAuthor({ name: interaction.member.displayName, iconURL: interaction.member.displayAvatarURL() })
					.setTitle(`${hasChannel ? 'Enabled' : 'Disabled'} ${kind} proxies ${channelId === 'everywhere' ? channelId : 'in ' + interaction.guild.channels.cache.get(channelId)?.name}!`)],
				ephemeral: true,
			}, false)
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
		}

		/* This edits the original message where the select menu originates, to have the correct pages get rid of any selections made. */
		const { disableAutoSelectMenu, alwaysSelectMenu, disableAllSelectMenu } = await getSelectMenus(allChannels, userData, characterData, serverData, page);

		await interaction.message
			.edit({
				components: interaction.customId.includes('always') ? [new ActionRowBuilder<SelectMenuBuilder>()
					.setComponents([alwaysSelectMenu])] :
					[new ActionRowBuilder<SelectMenuBuilder>()
						.setComponents([disableAutoSelectMenu]),
					new ActionRowBuilder<SelectMenuBuilder>()
						.setComponents([disableAllSelectMenu])],
			})
			.catch((error) => { throw new Error(error); });
	}
}

export async function sendEditProxyModalResponse(interaction: ModalSubmitInteraction, userData: UserSchema | null): Promise<void> {

	/* Check if user data exists, and get characterData, the chosen prefix and the chosen suffix */
	if (!userData) { throw new Error('userData is null'); }
	const characterData = userData.characters[interaction.customId.split('_')[2]];
	const chosenPrefix = interaction.fields.getTextInputValue('proxy_textinput_startsWith');
	const chosenSuffix = interaction.fields.getTextInputValue('proxy_textinput_endsWith');

	/* For each character but the selected one, check if they already have the same prefix and suffix and send an error message if they do. */
	for (const character of Object.values(userData.characters)) {

		if (character._id === characterData._id) { continue; }

		const isSamePrefix = chosenPrefix !== '' && character.proxy.startsWith === chosenPrefix;
		const isSameSuffix = chosenSuffix !== '' && character.proxy.endsWith === chosenSuffix;
		if (isSamePrefix && isSameSuffix) {

			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setDescription(`The prefix \`${chosenPrefix}\` and the suffix \`${chosenSuffix}\` are already used for ${character.name} and can't be used for ${characterData.name} as well.`)],
				ephemeral: true,
			}, false)
				.catch((error) => { throw new Error(error); });
			return;
		}
	}

	/* Update the database and send a success messsage. */
	await userModel.findOneAndUpdate(
		{ uuid: userData.uuid },
		(u) => {
			u.characters[characterData._id].proxy.startsWith = chosenPrefix;
			u.characters[characterData._id].proxy.endsWith = chosenSuffix;
		},
	);

	const prefixResponse = chosenPrefix === '' ? 'no prefix' : `prefix: \`${chosenPrefix}\``;
	const suffixResponse = chosenSuffix === '' ? 'no suffix' : `suffix: \`${chosenSuffix}\``;
	await respond(interaction, {
		embeds: [new EmbedBuilder()
			.setColor(characterData.color)
			.setAuthor({ name: characterData.name, iconURL: characterData.avatarURL })
			.setTitle(`Proxy set to ${prefixResponse} and ${suffixResponse}!`)],
	}, true)
		.catch((error) => { throw new Error(error); });
	return;
}

async function getSelectMenus(allChannels: Collection<string, NonThreadGuildBasedChannel>, userData: UserSchema | null, characterData: Character | null, serverData: ServerSchema | null, page: number): Promise<{ alwaysSelectMenu: SelectMenuBuilder, disableAllSelectMenu: SelectMenuBuilder, disableAutoSelectMenu: SelectMenuBuilder; }> {

	const alwaysSelectMenu = new SelectMenuBuilder()
		.setCustomId(`proxy_always_options_${characterData?._id}`)
		.setPlaceholder('Select channels to automatically be proxied in')
		.addOptions({ label: 'Everywhere', value: 'proxy_everywhere', emoji: userData && userData.autoproxy[serverData?.serverId || '']?.includes('everywhere') ? '🔘' : undefined });

	const disableAllSelectMenu = new SelectMenuBuilder()
		.setCustomId(`proxy_disable_all_options_${serverData?.serverId}`)
		.setPlaceholder('Select channels to disable all proxying for')
		.addOptions({ label: 'Everywhere', value: 'proxy_all_everywhere', emoji: serverData?.proxysetting?.all?.includes('everywhere') ? '🔘' : undefined });

	const disableAutoSelectMenu = new SelectMenuBuilder()
		.setCustomId(`proxy_disable_auto_options_${serverData?.serverId}`)
		.setPlaceholder('Select channels to disable automatic proxying for')
		.addOptions({ label: 'Everywhere', value: 'proxy_auto_everywhere', emoji: serverData?.proxysetting?.auto?.includes('everywhere') ? '🔘' : undefined });

	for (const [channelId, channel] of allChannels) {

		alwaysSelectMenu.addOptions({ label: channel.name, value: `proxy_${channelId}`, emoji: userData && userData.autoproxy[serverData?.serverId || '']?.includes(channelId) ? '🔘' : undefined });
		disableAllSelectMenu.addOptions({ label: channel.name, value: `proxy_all_${channelId}`, emoji: serverData?.proxysetting?.all?.includes(channelId) ? '🔘' : undefined });
		disableAutoSelectMenu.addOptions({ label: channel.name, value: `proxy_auto_${channelId}`, emoji: serverData?.proxysetting?.auto?.includes(channelId) ? '🔘' : undefined });
	}

	if (alwaysSelectMenu.options.length > 25) {

		alwaysSelectMenu.setOptions(alwaysSelectMenu.options.splice(page * 24, 24));
		alwaysSelectMenu.addOptions({ label: 'Show more channels', value: `proxy_nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	if (disableAllSelectMenu.options.length > 25) {

		disableAllSelectMenu.setOptions(disableAllSelectMenu.options.splice(page * 24, 24));
		disableAllSelectMenu.addOptions({ label: 'Show more channels', value: `proxy_all_nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	if (disableAutoSelectMenu.options.length > 25) {

		disableAutoSelectMenu.setOptions(disableAutoSelectMenu.options.splice(page * 24, 24));
		disableAutoSelectMenu.addOptions({ label: 'Show more channels', value: `proxy_auto_nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return { alwaysSelectMenu, disableAllSelectMenu, disableAutoSelectMenu };
}