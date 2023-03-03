import { ActionRowBuilder, ButtonInteraction, ChatInputCommandInteraction, EmbedBuilder, StringSelectMenuBuilder, AnySelectMenuInteraction, SlashCommandBuilder } from 'discord.js';
import { ServerSchema } from '../../typings/data/server';
import { UserData } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid } from '../../utils/checkValidity';
import { saveCommandDisablingInfo } from '../../utils/componentDisabling';
import getInventoryElements from '../../utils/getInventoryElements';
import { getArrayElement, respond } from '../../utils/helperFunctions';
import { missingPermissions } from '../../utils/permissionHandler';
import { remindOfAttack } from '../gameplay_primary/attack';
import { sendEatMessage } from './eat';
const { default_color } = require('../../../config.json');

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('inventory')
		.setDescription('This is a collection of all the things your pack has gathered, listed up.')
		.setDMPermission(false)
		.toJSON(),
	category: 'page3',
	position: 1,
	disablePreviousCommand: true,
	modifiesServerProfile: false,
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer, server }) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(userData, interaction)) { return; } // This is always a reply

		/* Checks if the profile is resting, on a cooldown or passed out. */
		const restEmbed = await isInvalid(interaction, userData);
		if (restEmbed === false) { return; }

		await showInventoryMessage(interaction, userData, serverData, 1);
	},
	async sendMessageComponentResponse(interaction, userData, serverData) {

		if (!interaction.isStringSelectMenu()) { return; }
		/* This ensures that the user is in a guild and has a completed account. */
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(userData, interaction)) { return; } // This is always a reply

		const selectOptionId = getArrayElement(interaction.values, 0);

		if (interaction.customId.includes('pages')) {

			const showMaterialsPage = interaction.customId.split('_')[2] === 'true';
			const page = Number(selectOptionId);
			if (isNaN(page)) { throw new Error('page is Not a Number'); }
			if (page !== 1 && page !== 2 && page !== 3 && page !== 4) { throw new Error('page is an invalid number'); }

			await showInventoryMessage(interaction, userData, serverData, page, showMaterialsPage);
			return;
		}
		else if (interaction.customId.includes('eat')) {

			if (selectOptionId.includes('newpage')) {

				const subPage = Number(getArrayElement(selectOptionId.split('_'), 1));
				if (isNaN(subPage)) { throw new Error('subPage is Not a Number'); }
				const showMaterialsPage = selectOptionId.split('_')[2] === 'true';

				await showInventoryMessage(interaction, userData, serverData, 3, showMaterialsPage, subPage);
				return;
			}
			else {

				await sendEatMessage(interaction, selectOptionId, userData, serverData, '', []);
				return;
			}
		}
	},
};

export async function showInventoryMessage(
	interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'> | AnySelectMenuInteraction<'cached'>,
	userData: UserData<never, never>,
	serverData: ServerSchema,
	page: 1 | 2 | 3 | 4,
	showMaterialsPage = true,
	subPage?: number,
) {

	if (await missingPermissions(interaction, [
		'ViewChannel', // Needed because of createCommandComponentDisabler
	]) === true) { return; }

	const messageContent = remindOfAttack(interaction.guildId);

	const inventorySelectMenu = new ActionRowBuilder<StringSelectMenuBuilder>()
		.setComponents(new StringSelectMenuBuilder()
			.setCustomId(`inventory_pages_${showMaterialsPage}_@${userData._id}`)
			.setPlaceholder('Select a page')
			.setOptions([
				{ label: 'Page 1', value: '1', description: 'common herbs', emoji: '🌱' },
				{ label: 'Page 2', value: '2', description: 'uncommon & rare herbs', emoji: '🍀' },
				{ label: 'Page 3', value: '3', description: 'meat', emoji: '🥩' },
				...showMaterialsPage ? [{ label: 'Page 4', value: '4', description: 'materials', emoji: '🪵' }] : [],
			]));

	let { selectMenuOptions: foodSelectMenuOptions, embedDescription: description } = getInventoryElements(serverData.inventory, page);
	if (page === 4) { foodSelectMenuOptions.length = 0; }

	if (foodSelectMenuOptions.length > 25) {

		const totalSubPages = Math.ceil(foodSelectMenuOptions.length / 24);
		foodSelectMenuOptions = foodSelectMenuOptions.splice((subPage ?? 0) * 24, 24);

		const newSubPage = 1 + (subPage ?? 0) >= totalSubPages ? 0 : (subPage ?? 0);
		foodSelectMenuOptions.push({ label: 'Show more meat options', value: `newpage_${newSubPage}_${showMaterialsPage}`, description: `You are currently on page ${(subPage ?? 0) + 1}`, emoji: '📋' });
	}

	// This is an update to the message with the component (either being "View Inventory" from travel-regions command or selecting a different page), and a reply when doing the inventory command or the eat command without selecting food
	const botReply = await respond(interaction, {
		content: messageContent,
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined })
			.setTitle(`Inventory of ${interaction.guild.name} - Page ${page}${subPage ? `.${subPage + 1}` : ''}`)
			.setDescription(description || null)],
		components: [
			inventorySelectMenu,
			...userData.quid.profile.hunger < userData.quid.profile.maxHunger && foodSelectMenuOptions.length > 0
				? [new ActionRowBuilder<StringSelectMenuBuilder>()
					.setComponents(new StringSelectMenuBuilder()
						.setCustomId(`inventory_eat_@${userData._id}`)
						.setPlaceholder('Select an item to eat')
						.setOptions(foodSelectMenuOptions))]
				: [],
		],
		fetchReply: true,
	}, 'update', interaction.isMessageComponent() ? interaction.message.id : undefined);

	saveCommandDisablingInfo(userData, interaction.guildId, interaction.channelId, botReply.id, interaction);
}