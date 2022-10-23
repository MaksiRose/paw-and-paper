import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Collection, EmbedBuilder, ModalBuilder, NonThreadGuildBasedChannel, RestOrArray, SelectMenuBuilder, SelectMenuComponentOptionData, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { respond, update } from '../../utils/helperFunctions';
import { hasName, isInGuild } from '../../utils/checkUserState';
import { createCommandComponentDisabler } from '../../utils/componentDisabling';
import { getMapData } from '../../utils/helperFunctions';
import { missingPermissions } from '../../utils/permissionHandler';
import { SlashCommand } from '../../typings/handle';
import { ProxyConfigType, ProxyListType, UserData } from '../../typings/data/user';
import { constructCustomId, constructSelectOptions, deconstructCustomId, deconstructSelectOptions } from '../../utils/customId';
const { error_color } = require('../../../config.json');

type CustomIdArgs = [] | ['set', 'learnmore' | 'modal'] | ['always', 'learnmore' | 'options']
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
		if (!hasName(userData, interaction)) { return; }

		/* Send a response to the user. */
		const botReply = await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(userData.quid.color)
				.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
				.setTitle('What is a proxy and how do I use this command?')
				.setDescription('Proxying is a way to speak as if your quid was saying it. This means that your message will be replaced by one that has your quids name and avatar.')
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
					new ButtonBuilder()
						.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData.quid._id, ['set', 'learnmore']))
						.setLabel('Set?')
						.setStyle(ButtonStyle.Success),
					...(interaction.inGuild() ? [new ButtonBuilder()
						.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData.quid._id, ['always', 'learnmore']))
						.setLabel('Always?')
						.setStyle(ButtonStyle.Success)] : []),
				])],
		}, true);

		if (userData) { createCommandComponentDisabler(userData._id, interaction.guildId || 'DM', botReply); }
	},
	async sendMessageComponentResponse(interaction, userData) {

		const customId = deconstructCustomId<CustomIdArgs>(interaction.customId);
		if (!hasName(userData) || !customId) { return; }

		/* If the user pressed the button to learn more about the set subcommand, explain it with a button that opens a modal. */
		if (interaction.isButton() && customId.args[0] === 'set' && customId.args[1] === 'learnmore') {

			await update(interaction, {
				embeds: [new EmbedBuilder(interaction.message.embeds[0]?.toJSON())
					.setTitle('Here is how to use the set subcommand:')
					.setDescription('Proxying is a way to speak as if your quid was saying it. The proxy is an indicator to the bot you want your message to be proxied. It consists of a prefix (indicator before the message) and a suffix (indicator after the message). You can either set both or one of them.\n\nExamples:\nprefix: `<`, suffix: `>`, example message: `<hello friends>`\nprefix: `P: `, no suffix, example message: `P: hello friends`\nno prefix, suffix: ` -p`, example message: `hello friends -p`\nThis is case-sensitive (meaning that upper and lowercase matters).')
					.setFields()],
				components: [new ActionRowBuilder<ButtonBuilder>()
					.setComponents([new ButtonBuilder()
						.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData.quid._id, ['set', 'modal']))
						.setLabel('Set proxy')
						.setStyle(ButtonStyle.Success)])],
			});
			return;
		}

		/* If the user pressed the button to set their proxy, open the modal. */
		if (interaction.isButton() && customId.args[0] === 'set' && customId.args[1] === 'modal') {

			await interaction.showModal(new ModalBuilder()
				.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData.quid._id, []))
				.setTitle('Set a proxy')
				.addComponents(
					new ActionRowBuilder<TextInputBuilder>({
						components: [new TextInputBuilder()
							.setCustomId('startsWith')
							.setLabel('Prefix (indicator before the message)')
							.setStyle(TextInputStyle.Short)
							.setMaxLength(16)
							.setRequired(false)
							.setValue(userData.quid.proxy.startsWith),
						],
					}),
					new ActionRowBuilder<TextInputBuilder>({
						components: [new TextInputBuilder()
							.setCustomId('endsWith')
							.setLabel('Suffix (indicator after the message)')
							.setStyle(TextInputStyle.Short)
							.setMaxLength(16)
							.setRequired(false)
							.setValue(userData.quid.proxy.endsWith),
						],
					}),
				),
			);
			return;
		}

		/* Everything after this point relates to autoproxy and can only be executed in guilds */
		if (!isInGuild(interaction)) { return; }

		const allChannels = (await interaction.guild?.channels?.fetch() ?? new Collection()).filter((c): c is NonThreadGuildBasedChannel => c !== null && c.permissionsFor(interaction.client.user.id)?.has('ViewChannel') != false && c.permissionsFor(interaction.client.user.id)?.has('SendMessages') != false && c.permissionsFor(interaction.user.id)?.has('ViewChannel') != false && c.permissionsFor(interaction.user.id)?.has('SendMessages') != false);

		/* If the user pressed the button to learn more about the always subcommand, explain it with a select menu to select channels. */
		if (interaction.isButton() && customId.args[0] === 'always' && customId.args[1] === 'learnmore') {

			if (!interaction.inGuild()) { throw new Error('Interaction is not in guild'); }
			const alwaysSelectMenu = await getSelectMenu(allChannels, userData, 0);

			await update(interaction, {
				embeds: [new EmbedBuilder(interaction.message.embeds[0]?.toJSON())
					.setTitle('Here is how to use the always subcommand:')
					.setDescription('When this feature is enabled, every message you send will be treated as if it was proxied, even if the proxy isn\'t included.\nYou can either toggle it for the entire server, or specific channels, using the drop-down menu below. Enabled channels will have a radio emoji next to it.')
					.setFields()],
				components: [new ActionRowBuilder<SelectMenuBuilder>()
					.setComponents([alwaysSelectMenu])],
			});
			return;
		}

		/* Responses for select menu selections */
		if (interaction.isSelectMenu() && customId.args[0] === 'always' && customId.args[1] === 'options') {

			let page = 0;
			const selectOptionId = deconstructSelectOptions<SelectOptionArgs>(interaction);

			/* If the user clicked the next page option, increment the page. */
			if (selectOptionId[0] === 'nextpage') {

				page = Number(selectOptionId[1]) + 1;
				if (page >= Math.ceil((allChannels.size + 1) / 24)) { page = 0; }

				const alwaysSelectMenu = await getSelectMenu(allChannels, userData, page);
				await update(interaction, {
					components: [new ActionRowBuilder<SelectMenuBuilder>()
						.setComponents([alwaysSelectMenu])],
				});
			}
			/* If the user clicked an always subcommand option, add/remove the channel and send a success message. */
			else {

				const channelId = selectOptionId[0];
				const hasChannel = userData.settings.proxy.server?.autoproxy.channels.whitelist.includes(channelId) || false;

				await userData.update(
					(u) => {
						const sps = u.settings.proxy.servers[interaction.guildId];
						if (!sps) {
							u.settings.proxy.servers[interaction.guildId] = {
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
						else if (!hasChannel) { sps.autoproxy.channels.whitelist.push(channelId); }
						else { sps.autoproxy.channels.whitelist = sps.autoproxy.channels.whitelist.filter(string => string !== channelId); }
					},
				);

				const alwaysSelectMenu = await getSelectMenu(allChannels, userData, page);
				await update(interaction, {
					components: [new ActionRowBuilder<SelectMenuBuilder>()
						.setComponents([alwaysSelectMenu])],
				});

				await respond(interaction, {
					embeds: [new EmbedBuilder()
						.setColor(userData.quid.color)
						.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
						.setTitle(`${hasChannel ? 'Removed' : 'Added'} ${interaction.guild.channels.cache.get(channelId)?.name} ${hasChannel ? 'from' : 'to'} the list of automatic proxy channels!`)],
					ephemeral: true,
				}, false);
			}
		}

	},
	async sendModalResponse(interaction, userData) {

		const customId = deconstructCustomId<CustomIdArgs>(interaction.customId);
		if (!hasName(userData) || !customId) { return; }

		const chosenPrefix = interaction.fields.getTextInputValue('startsWith');
		const chosenSuffix = interaction.fields.getTextInputValue('endsWith');

		/* For each quid but the selected one, check if they already have the same prefix and suffix and send an error message if they do. */
		for (const quid of userData.quids.values()) {

			if (quid._id === userData.quid._id) { continue; }

			const isSamePrefix = chosenPrefix !== '' && quid.proxy.startsWith === chosenPrefix;
			const isSameSuffix = chosenSuffix !== '' && quid.proxy.endsWith === chosenSuffix;
			if (isSamePrefix && isSameSuffix) {

				await respond(interaction, {
					embeds: [new EmbedBuilder()
						.setColor(error_color)
						.setDescription(`The prefix \`${chosenPrefix}\` and the suffix \`${chosenSuffix}\` are already used for ${quid.name} and can't be used for ${userData.quid.name} as well.`)],
					ephemeral: true,
				}, false);
				return;
			}
		}

		/* Update the database and send a success messsage. */
		await userData.update(
			(u) => {
				const q = getMapData(u.quids, userData.quid._id);
				q.proxy.startsWith = chosenPrefix;
				q.proxy.endsWith = chosenSuffix;
			},
		);

		const prefixResponse = chosenPrefix === '' ? 'no prefix' : `prefix: \`${chosenPrefix}\``;
		const suffixResponse = chosenSuffix === '' ? 'no suffix' : `suffix: \`${chosenSuffix}\``;
		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(userData.quid.color)
				.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
				.setTitle(`Proxy set to ${prefixResponse} and ${suffixResponse}!`)],
		}, true);
		return;

	},
};

async function getSelectMenu(
	allChannels: Collection<string, NonThreadGuildBasedChannel>,
	userData: UserData<never, ''>,
	page: number,
): Promise<SelectMenuBuilder> {

	let alwaysSelectMenuOptions: RestOrArray<SelectMenuComponentOptionData> = allChannels.map((channel, channelId) => ({
		label: channel.name,
		value: constructSelectOptions<SelectOptionArgs>([channelId]),
		emoji: userData.settings.proxy.server?.autoproxy.channels.whitelist.includes(channelId) ? '🔘' : undefined,
	}));

	if (alwaysSelectMenuOptions.length > 25) {

		alwaysSelectMenuOptions = alwaysSelectMenuOptions.splice(page * 24, 24);
		alwaysSelectMenuOptions.push({
			label: 'Show more channels',
			value: constructSelectOptions<SelectOptionArgs>(['nextpage', `${page}`]),
			description: `You are currently on page ${page + 1}`, emoji: '📋',
		});
	}

	return new SelectMenuBuilder()
		.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData.quid._id, ['always', 'options']))
		.setPlaceholder('Select channels to automatically be proxied in')
		.setOptions(alwaysSelectMenuOptions);
}