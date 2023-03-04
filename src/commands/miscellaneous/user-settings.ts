import { ActionRowBuilder, AnySelectMenuInteraction, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, InteractionReplyOptions, InteractionUpdateOptions, MessageEditOptions, RestOrArray, SelectMenuComponentOptionData, SlashCommandBuilder, StringSelectMenuBuilder } from 'discord.js';
import Quid from '../../models/quid';
import QuidToServer from '../../models/quidToServer';
import User from '../../models/user';
import { SlashCommand } from '../../typings/handle';
import { hasName, hasNameAndSpecies } from '../../utils/checkUserState';
import { constructCustomId, constructSelectOptions, deconstructCustomId, deconstructSelectOptions } from '../../utils/customId';
import { respond } from '../../utils/helperFunctions';
import { sendReminder, stopReminder } from '../gameplay_maintenance/water-tree';
const { default_color } = require('../../../config.json');

type CustomIdArgs = ['options'] | ['mainpage'] | ['mentions'] | ['accessibility'] | ['reminders', 'resting' | 'water', 'on' | 'off']
type SelectOptionArgs = ['mentions'] | ['accessibility'] | ['water' | 'resting'] | ['replaceEmojis']

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('user-settings')
		.setDescription('List of user-specific settings like mentions and accessibility.')
		.toJSON(),
	category: 'page5',
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

		const isMentionsChange = customId.args[0] === 'mentions' && interaction.isStringSelectMenu();
		if (isMentionsChange || (customId.args[0] === 'options' && selectOptionId?.[0]?.[0] === 'mentions')) {

			if (isMentionsChange) {

				await user.update({
					reminders_resting: selectOptionId?.flat().includes('resting') ?? false,
					reminders_water: selectOptionId?.flat().includes('water') ?? false,
				});
			}

			// This is always an update
			await respond(interaction, getMentionsMessage(interaction, user), 'update', interaction.message.id);
		}

		const isAccessibilityChange = customId.args[0] === 'accessibility' && interaction.isStringSelectMenu();
		if (isAccessibilityChange || (customId.args[0] === 'options' && selectOptionId?.[0]?.[0] === 'accessibility')) {

			if (isAccessibilityChange) {

				await user.update({ accessibility_replaceEmojis: selectOptionId?.flat().includes('replaceEmojis') ?? false });
			}

			// This is always an update
			await respond(interaction, getAccessibilityMessage(interaction, user), 'update', interaction.message.id);
		}

		if (customId.args[0] === 'reminders') {

			const isOn = customId.args[2] === 'on';

			if (customId.args[1] === 'water') {

				await user.update({ reminders_water: isOn });

				/* This executes the sendReminder function for each profile for which the sapling exists and where lastMessageChannelId is a string, if the user has enabled water reminders. */
				if (user.reminders_water === true) {

					const quids = await Quid.findAll({ where: { userId: user.id } });
					for (const quid of quids) {

						const quidToServers = await QuidToServer.findAll({ where: { quidId: quid.id } });
						for (const quidToServer of quidToServers) {

							if (isOn) {

								if (hasNameAndSpecies(quid) && quidToServer.sapling_exists && typeof quidToServer.sapling_lastChannelId === 'string' && !quidToServer.sapling_sentReminder) { sendReminder(user); }
							}
							else { stopReminder(quid.id, quidToServer.serverId); }
						}
					}
				}

				// This should always update the message with the settings-button
				await respond(interaction, {
					components: [new ActionRowBuilder<ButtonBuilder>()
						.setComponents(new ButtonBuilder()
							.setCustomId(`user-settings_reminders_water_${isOn ? 'off' : 'on'}_@${user.id}`)
							.setLabel(`Turn water reminders ${isOn ? 'off' : 'on'}`)
							.setStyle(ButtonStyle.Secondary))],
				}, 'update', interaction.message.id);

				// This should always be a followUp to the updated error message
				await respond(interaction, {
					content: `You turned reminders for watering ${isOn ? 'on' : 'off'}!`,
					ephemeral: true,
				});
			}

			if (customId.args[1] === 'resting') {

				await user.update({ reminders_resting: isOn });

				// This should always update the message with the settings-button
				await respond(interaction, {
					components: [new ActionRowBuilder<ButtonBuilder>()
						.setComponents(new ButtonBuilder()
							.setCustomId(`user-settings_reminders_resting_${isOn ? 'off' : 'on'}_@${user.id}`)
							.setLabel(`Turn automatic resting pings ${isOn ? 'off' : 'on'}`)
							.setStyle(ButtonStyle.Secondary))],
				}, 'update', interaction.message.id);

				// This should always be a followUp to the updated error message
				await respond(interaction, {
					content: `You turned pings for automatic resting ${isOn ? 'on' : 'off'}!`,
					ephemeral: true,
				});
			}
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
					{ value: constructSelectOptions<SelectOptionArgs>(['mentions']), label: 'Mentions', description: 'Manage what you get pinged for' },
					{ value: constructSelectOptions<SelectOptionArgs>(['accessibility']), label: 'Accessibility', description: 'Configure accessibility options' },
				)])],
	};
}

function getMentionsMessage(
	interaction: ChatInputCommandInteraction | ButtonInteraction | AnySelectMenuInteraction,
	user: User,
): InteractionReplyOptions & MessageEditOptions & InteractionUpdateOptions {

	const menuOptions: RestOrArray<SelectMenuComponentOptionData> = [
		{ label: 'Send watering reminders', value: constructSelectOptions<SelectOptionArgs>(['water']), default: user.reminders_water },
		{ label: 'Ping when automatic resting is finished', value: constructSelectOptions<SelectOptionArgs>(['resting']), default: user.reminders_resting },
	];

	return {
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setTitle('Settings ➜ Mentions')],
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

function getAccessibilityMessage(
	interaction: ChatInputCommandInteraction | ButtonInteraction | AnySelectMenuInteraction,
	user: User,
): InteractionReplyOptions & MessageEditOptions & InteractionUpdateOptions {

	const menuOptions: RestOrArray<SelectMenuComponentOptionData> = [
		{ label: 'Replace emojis with letters and numbers in games', value: constructSelectOptions<SelectOptionArgs>(['replaceEmojis']), default: user.accessibility_replaceEmojis },
	];

	return {
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setTitle('Settings ➜ Accessibility')],
		components: [new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, interaction.user.id, ['mainpage']))
				.setLabel('Back')
				.setEmoji('⬅️')
				.setStyle(ButtonStyle.Secondary)]),
		new ActionRowBuilder<StringSelectMenuBuilder>()
			.setComponents([new StringSelectMenuBuilder()
				.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, interaction.user.id, ['accessibility']))
				.setOptions(menuOptions)
				.setMinValues(0)
				.setMaxValues(menuOptions.length)])],
	};
}