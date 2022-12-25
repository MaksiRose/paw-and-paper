import { ActionRowBuilder, AnySelectMenuInteraction, ButtonInteraction, ChatInputCommandInteraction, EmbedBuilder, InteractionReplyOptions, InteractionUpdateOptions, MessageEditOptions, SlashCommandBuilder, StringSelectMenuBuilder } from 'discord.js';
import { SlashCommand } from '../../typings/handle';
import { hasName } from '../../utils/checkUserState';
import { constructCustomId, constructSelectOptions } from '../../utils/customId';
import { respond } from '../../utils/helperFunctions';
const { default_color } = require('../../../config.json');

type CustomIdArgs = ['options']
type SelectOptionArgs = ['mentions'] | ['accessibility']

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('user-settings')
		.setDescription('List of user-specific settings like mentions and accessibility.')
		.toJSON(),
	category: 'page5',
	position: 1,
	disablePreviousCommand: true,
	modifiesServerProfile: false,
	sendCommand: async (interaction, userData) => {

		// It should give you a message with a drop-down of options:
		// mentions (which has watering and auto-resting), accessibility (option to replace emojis with letters & numbers)
		// Clicking these should edit the message with the current embed, a first row button that says "⬅️ Back", and any other needed components
		// If the command is nested (as in, you need to click another option to be brought into a sub-sub-setting), the "⬅️ Back" button should only bring you back one level
		// That way you can basically go through the command as if it was a folder

		if (userData === null) {

			hasName(userData, interaction);
			return;
		}

		// This is always a reply
		await respond(interaction, getOriginalMessage(interaction));
		return;
	},
};

function getOriginalMessage(interaction: ChatInputCommandInteraction | ButtonInteraction | AnySelectMenuInteraction): InteractionReplyOptions & MessageEditOptions & InteractionUpdateOptions {

	return {
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setTitle('Select what you want to configure from the drop-down menu below.')],
		components: [new ActionRowBuilder<StringSelectMenuBuilder>()
			.setComponents([new StringSelectMenuBuilder()
				.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, interaction.user.id, ['options']))
				.setPlaceholder('Select an option to configure')
				.setOptions(
					{ value: constructSelectOptions<SelectOptionArgs>(['mentions']), label: 'Mentions', description: 'Manage what you get pinged for' },
					{ value: constructSelectOptions<SelectOptionArgs>(['accessibility']), label: 'Accessibility', description: 'Configure accessibility options' },
				)])],
	};
}