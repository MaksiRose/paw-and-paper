import { ActionRowBuilder, ButtonInteraction, ChatInputCommandInteraction, EmbedBuilder, SelectMenuBuilder, SelectMenuInteraction, SlashCommandBuilder } from 'discord.js';
import { Profile, ServerSchema, SlashCommand, UserSchema } from '../../typedef';
import { hasName, hasSpecies, isInGuild } from '../../utils/checkUserState';
import { hasCooldown } from '../../utils/checkValidity';
import { createCommandComponentDisabler } from '../../utils/componentDisabling';
import getInventoryElements from '../../utils/getInventoryElements';
import { getArrayElement, getMapData, respond, update } from '../../utils/helperFunctions';
import { remindOfAttack } from '../gameplay_primary/attack';
import { sendEatMessage } from './eat';
const { default_color } = require('../../../config.json');

const name: SlashCommand['name'] = 'inventory';
const description: SlashCommand['description'] = 'This is a collection of all the things your pack has gathered, listed up.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.setDMPermission(false)
		.toJSON(),
	disablePreviousCommand: true,
	modifiesServerProfile: false,
	sendCommand: async (client, interaction, userData, serverData) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (!isInGuild(interaction)) { return; }
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!hasName(interaction, userData)) { return; }

		/* Gets the current active quid and the server profile from the account */
		const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId));
		const profileData = getMapData(quidData.profiles, interaction.guildId);
		if (!hasSpecies(interaction, quidData)) { return; }

		/* Checks if the profile is on a cooldown. */
		if (await hasCooldown(interaction, userData, quidData)) { return; }

		await showInventoryMessage(interaction, userData, profileData, serverData, 1);
	},
};

export async function showInventoryMessage(
	interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'> | SelectMenuInteraction<'cached'>,
	userData: UserSchema,
	profileData: Profile,
	serverData: ServerSchema,
	page: 1 | 2 | 3 | 4,
	showMaterialsPage = true,
	subPage?: number,
) {

	const messageContent = remindOfAttack(interaction.guildId);

	const inventorySelectMenu = new ActionRowBuilder<SelectMenuBuilder>()
		.setComponents(new SelectMenuBuilder()
			.setCustomId(`inventory_pages_${showMaterialsPage}`)
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

	const botReply = await (async function(messageObject) { return interaction.isSelectMenu() ? await update(interaction, messageObject) : await respond(interaction, messageObject, true); })({
		content: messageContent,
		embeds: [new EmbedBuilder()
			.setColor(default_color)
			.setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined })
			.setTitle(`Inventory of ${interaction.guild.name} - Page ${page}${subPage ? `.${subPage + 1}` : ''}`)
			.setDescription(description || null)],
		components: [
			inventorySelectMenu,
			...profileData.hunger < profileData.maxHunger && foodSelectMenuOptions.length > 0
				? [new ActionRowBuilder<SelectMenuBuilder>()
					.setComponents(new SelectMenuBuilder()
						.setCustomId('inventory_eat')
						.setPlaceholder('Select an item to eat')
						.setOptions(foodSelectMenuOptions))]
				: [],
		],
	});

	createCommandComponentDisabler(userData._id, interaction.guildId, botReply);
}

export async function inventoryInteractionCollector(
	interaction: SelectMenuInteraction,
	userData: UserSchema | null,
	serverData: ServerSchema | null,
): Promise<void> {

	if (!interaction.inCachedGuild()) { throw new Error('Interaction is not in cached guild'); }
	if (userData === null) { throw new Error('userData is null'); }
	if (serverData === null) { throw new Error('serverData is null'); }

	/* Gets the current active quid and the server profile from the account */
	const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId));
	const profileData = getMapData(quidData.profiles, interaction.guildId);

	if (interaction.customId.includes('pages')) {

		const showMaterialsPage = interaction.customId.split('_')[2] === 'true';
		const page = Number(interaction.values[0]);
		if (isNaN(page)) { throw new Error('page is Not a Number'); }
		if (page !== 1 && page !== 2 && page !== 3 && page !== 4) { throw new Error('page is an invalid number'); }

		await showInventoryMessage(interaction, userData, profileData, serverData, page, showMaterialsPage);
		return;
	}
	else if (interaction.customId.includes('eat')) {

		if (interaction.customId.includes('newpage')) {

			const subPage = Number(interaction.values[0]?.split('_')[1]);
			if (isNaN(subPage)) { throw new Error('subPage is Not a Number'); }
			const showMaterialsPage = interaction.values[0]?.split('_')[2] === 'true';

			await showInventoryMessage(interaction, userData, profileData, serverData, 3, showMaterialsPage, subPage);
			return;
		}
		else {

			const chosenFood = getArrayElement(interaction.values, 0);
			await sendEatMessage(interaction, chosenFood, userData, quidData, profileData, serverData, '', []);
			return;
		}
	}
}