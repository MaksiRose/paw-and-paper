import { ActionRowBuilder, AnySelectMenuInteraction, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, InteractionReplyOptions, InteractionUpdateOptions, MessageEditOptions, RestOrArray, SelectMenuComponentOptionData, SlashCommandBuilder, StringSelectMenuBuilder } from 'discord.js';
import User from '../../models/user';
import { SlashCommand } from '../../typings/handle';
import { hasName } from '../../utils/checkUserState';
import { constructCustomId, constructSelectOptions, deconstructCustomId, deconstructSelectOptions } from '../../utils/customId';
import { respond } from '../../utils/helperFunctions';
const { default_color } = require('../../../config.json');

type CustomIdArgs = ['options'] | ['mainpage'] | ['mentions'] | ['accessibility'] | ['proxy'] | ['reminders', 'resting' | 'water', 'on' | 'off']
type SelectOptionArgs = ['mentions'] | ['accessibility'] | ['proxy'] | ['water' | 'resting'] | ['replaceEmojis'] | ['editing' | 'keepInMessage']

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('user-settings')
		.setDescription('List of user-specific settings like mentions and accessibility.')
		.toJSON(),
	category: 'page3',
	position: 1,
	disablePreviousCommand: true,
	modifiesServerProfile: false,
	sendCommand: async (interaction, { user }) => {

		// It should give you a message with a drop-down of options:
		// mentions (which has watering and auto-resting), accessibility (option to replace emojis with letters & numbers)
		// Clicking these should edit the message with the current embed, a first row button that says "⬅️ Back", and any other needed components
		// If the command is nested (as in, you need to click another option to be brought into a sub-sub-setting), the "⬅️ Back" button should only bring you back one level
		// That way you can basically go through the command as if it was a folder

		if (user === undefined) {

			hasName(undefined, { interaction, hasQuids: false });
			return;
		}

		// This is always a reply
		await respond(interaction, getOriginalMessage(interaction));
		return;
	},
	async sendMessageComponentResponse(interaction, { user }) {

		const selectOptionId = interaction.isAnySelectMenu() ? deconstructSelectOptions<SelectOptionArgs>(interaction) : null;
		const customId = deconstructCustomId<CustomIdArgs>(interaction.customId);
		if (customId === null) { throw new TypeError('customId is null'); }
		if (user === undefined) { throw new TypeError('userData is undefined'); }

		if (customId.args[0] === 'mainpage') {

			// This is always an update
			await respond(interaction, getOriginalMessage(interaction), 'update', interaction.message.id);
		}

		const isProxyChange = customId.args[0] === 'proxy' && interaction.isStringSelectMenu();
		if (isProxyChange || (customId.args[0] === 'options' && selectOptionId?.[0]?.[0] === 'proxy')) {

			if (isProxyChange) {

				await user.update({
					proxy_editing: selectOptionId?.flat().includes('editing') ?? false,
					proxy_keepInMessage: selectOptionId?.flat().includes('keepInMessage') ?? false,
				});
			}

			// This is always an update
			await respond(interaction, getProxyMessage(interaction, user), 'update', interaction.message.id);
		}
	},
};

function getOriginalMessage(
	interaction: ChatInputCommandInteraction | ButtonInteraction | AnySelectMenuInteraction,
): InteractionReplyOptions & MessageEditOptions & InteractionUpdateOptions {

	return {
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setTitle('Select what you want to configure from the drop-down menu below.')],
		components: [new ActionRowBuilder<StringSelectMenuBuilder>()
			.setComponents([new StringSelectMenuBuilder()
				.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, interaction.user.id, ['options']))
				.setPlaceholder('Select a category to configure')
				.setOptions(
					{ value: constructSelectOptions<SelectOptionArgs>(['proxy']), label: 'Proxy', description: 'Configure proxy options' },
				)])],
	};
}

function getProxyMessage(
	interaction: ChatInputCommandInteraction | ButtonInteraction | AnySelectMenuInteraction,
	user: User,
): InteractionReplyOptions & MessageEditOptions & InteractionUpdateOptions {

	const menuOptions: RestOrArray<SelectMenuComponentOptionData> = [
		{ label: 'Replace message when proxy is edited in', value: constructSelectOptions<SelectOptionArgs>(['editing']), default: user.proxy_editing },
		{ label: 'Keep the proxy in the message after it\'s been replaced', value: constructSelectOptions<SelectOptionArgs>(['keepInMessage']), default: user.proxy_keepInMessage },
	];

	return {
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setTitle('Settings ➜ Proxy')],
		components: [new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, interaction.user.id, ['mainpage']))
				.setLabel('Back')
				.setEmoji('⬅️')
				.setStyle(ButtonStyle.Secondary)]),
		new ActionRowBuilder<StringSelectMenuBuilder>()
			.setComponents([new StringSelectMenuBuilder()
				.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, interaction.user.id, ['mentions']))
				.setOptions(menuOptions)
				.setMinValues(0)
				.setMaxValues(menuOptions.length)])],
	};
}