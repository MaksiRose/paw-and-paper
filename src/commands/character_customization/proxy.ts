import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChannelType, Collection, EmbedBuilder, ModalBuilder, ModalSubmitInteraction, NonThreadGuildBasedChannel, RestOrArray, SelectMenuBuilder, SelectMenuComponentOptionData, SelectMenuInteraction, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { respond } from '../../events/interactionCreate';
import userModel from '../../models/userModel';
import { Character, ProxyConfigType, ProxyListType, ServerSchema, SlashCommand, UserSchema } from '../../typedef';
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

		/* If the user does not have a character selected, return. */
		if (!hasName(interaction, userData)) { return; }

		const characterData = userData.characters[userData.currentCharacter[interaction.guildId || 'DM']];

		/* Send a response to the user. */
		const botReply = await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(characterData?.color || default_color)
				.setAuthor(characterData ? { name: characterData.name, iconURL: characterData.avatarURL } : null)
				.setTitle('What is a proxy and how do I use this command?')
				.setDescription('Proxying is a way to speak as if your character was saying it. This means that your message will be replaced by one that has your characters name and avatar.')
				.setFields([
					{
						name: 'set proxy',
						value: 'This sets an indicator to the bot you want your message to be proxied. Only messages with those indicators will be proxied. Click the "Set?" button below to learn more.',
					}, ...(interaction.inGuild() ? [{
						name: 'always proxy',
						value: 'This will treat every message in a specific channel as if it was proxied, even if the proxy isn\'t included. Click the "Always?" button below to learn more.',
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
		const alwaysSelectMenu = await getSelectMenus(allChannels, userData, characterData, serverData, 0);

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
			const hasChannel = userData && userData.serverProxySettings[interaction.guildId] !== undefined && userData.serverProxySettings[interaction.guildId].autoproxy.channels.whitelist.includes(channelId);

			userData = await userModel.findOneAndUpdate(
				u => u.uuid === userData?.uuid,
				(u) => {
					if (u.serverProxySettings[interaction.guildId] === undefined) {
						u.serverProxySettings[interaction.guildId] = {
							autoproxy: {
								setTo: ProxyConfigType.Enabled,
								channels: {
									setTo: ProxyListType.Whitelist,
									whitelist: [channelId],
									blacklist: [],
								},
							},
							stickymode: ProxyConfigType.FollowGlobal,
						};
					}
					else if (!hasChannel) { u.serverProxySettings[interaction.guildId].autoproxy.channels.whitelist.push(channelId); }
					else { u.serverProxySettings[interaction.guildId].autoproxy.channels.whitelist = u.serverProxySettings[interaction.guildId].autoproxy.channels.whitelist.filter(string => string !== channelId); }
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
		u => u.uuid === userData?.uuid,
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

async function getSelectMenus(allChannels: Collection<string, NonThreadGuildBasedChannel>, userData: UserSchema | null, characterData: Character | null, serverData: ServerSchema | null, page: number): Promise<SelectMenuBuilder> {

	let alwaysSelectMenuOptions: RestOrArray<SelectMenuComponentOptionData> = allChannels.map((channel, channelId) => ({ label: channel.name, value: `proxy_${channelId}`, emoji: userData && userData.serverProxySettings[serverData?.serverId || '']?.autoproxy.channels.whitelist.includes(channelId) ? '🔘' : undefined }));

	if (alwaysSelectMenuOptions.length > 25) {

		alwaysSelectMenuOptions = alwaysSelectMenuOptions.splice(page * 24, 24);
		alwaysSelectMenuOptions.push({ label: 'Show more channels', value: `proxy_nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return new SelectMenuBuilder()
		.setCustomId(`proxy_always_options_${characterData?._id}`)
		.setPlaceholder('Select channels to automatically be proxied in')
		.setOptions(alwaysSelectMenuOptions);
}