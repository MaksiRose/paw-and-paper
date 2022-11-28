import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, Embed, EmbedBuilder, RestOrArray, StringSelectMenuBuilder, SelectMenuComponentOptionData, SlashCommandBuilder } from 'discord.js';
import serverModel from '../../models/serverModel';
import { CommonPlantNames, MaterialNames, RarePlantNames, SpecialPlantNames, SpeciesNames, UncommonPlantNames } from '../../typings/data/general';
import { ServerSchema } from '../../typings/data/server';
import { UserData } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid } from '../../utils/checkValidity';
import { saveCommandDisablingInfo, disableAllComponents } from '../../utils/componentDisabling';
import { getMapData, widenValues, unsafeKeys, respond, update, getArrayElement, capitalizeString } from '../../utils/helperFunctions';
import { missingPermissions } from '../../utils/permissionHandler';
import { calculateInventorySize } from '../../utils/simulateItemUse';
import { remindOfAttack } from '../gameplay_primary/attack';

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('store')
		.setDescription('Take items you have gathered for your pack, and put them in the pack inventory.')
		.setDMPermission(false)
		.addSubcommand(option =>
			option.setName('all')
				.setDescription('Select this if you want to store all your items away.'))
		.addSubcommand(option =>
			option.setName('custom')
				.setDescription('Select this if you want to individually store your items away.'))
		.toJSON(),
	category: 'page3',
	position: 2,
	disablePreviousCommand: true,
	modifiesServerProfile: true,
	sendCommand: async (interaction, userData, serverData) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(userData, interaction)) { return; }

		/* Checks if the profile is resting, on a cooldown or passed out. */
		const restEmbed = await isInvalid(interaction, userData);
		if (restEmbed === false) { return; }

		await sendStoreMessage(interaction, userData, serverData, restEmbed);
	},
	async sendMessageComponentResponse(interaction, userData, serverData) {

		/* This ensures that the user is in a guild and has a completed account. */
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(userData, interaction)) { return; }

		if (interaction.isSelectMenu()) {

			if (interaction.customId === 'store_options') {

				const chosenFood = getArrayElement(interaction.values, 0) as CommonPlantNames | UncommonPlantNames | RarePlantNames | SpecialPlantNames | SpeciesNames | MaterialNames;
				let maximumAmount = 0;

				const inventory_ = widenValues(userData.quid.profile.inventory);
				for (const itemType of unsafeKeys(inventory_)) {

					if (unsafeKeys(inventory_[itemType]).includes(chosenFood)) {

						maximumAmount = inventory_[itemType][chosenFood];
					}
				}

				const amountSelectMenuOptions: RestOrArray<SelectMenuComponentOptionData> = [];

				for (let i = 1; i <= maximumAmount; i++) {

					amountSelectMenuOptions.push({ label: `${i}`, value: `${chosenFood}_${i}` });
				}

				const itemSelectMenu = getOriginalComponents(userData, chosenFood).itemSelectMenu;

				const amountSelectMenu = new ActionRowBuilder<StringSelectMenuBuilder>()
					.setComponents(new StringSelectMenuBuilder()
						.setCustomId(`store_amount_@${userData._id}`)
						.setPlaceholder('Select the amount to store away')
						.setOptions(amountSelectMenuOptions));

				await update(interaction, {
					components: [itemSelectMenu, amountSelectMenu],
				});
				return;
			}

			if (interaction.customId === 'store_amount') {

				const chosenFood = getArrayElement(getArrayElement(interaction.values, 0).split('_'), 0) as CommonPlantNames | UncommonPlantNames | RarePlantNames | SpecialPlantNames | SpeciesNames | MaterialNames;
				const chosenAmount = Number(getArrayElement(getArrayElement(interaction.values, 0).split('_'), 1));
				if (isNaN(chosenAmount)) { throw new TypeError('chosenAmount is NaN'); }

				const userInventory = widenValues(userData.quid.profile.inventory);
				const serverInventory = widenValues(serverData.inventory);
				for (const itemType of unsafeKeys(userInventory)) {

					if (unsafeKeys(userInventory[itemType]).includes(chosenFood)) {

						userInventory[itemType][chosenFood] -= chosenAmount;
						serverInventory[itemType][chosenFood] += chosenAmount;
					}
				}

				await userData.update(
					(u) => {
						const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
						p.inventory = userInventory;
					},
				);

				serverData = await serverModel.findOneAndUpdate(
					s => s._id === serverData?._id,
					(s) => {
						s.inventory = serverInventory;
					},
				);

				const { itemSelectMenu, storeAllButton } = getOriginalComponents(userData);

				const embed = new EmbedBuilder(interaction.message.embeds.splice(-1, 1)[0]?.toJSON() || getOriginalEmbed(userData).toJSON());
				let footerText = embed.toJSON().footer?.text ?? '';
				footerText += `\n+${chosenAmount} ${chosenFood} for ${interaction.guild.name}`;
				embed.setFooter({ text: footerText });

				await update(interaction, {
					embeds: [...interaction.message.embeds, embed],
					components: itemSelectMenu.components[0]?.options.length === 0 ? disableAllComponents(interaction.message.components) : [itemSelectMenu, storeAllButton],
				});
				return;
			}
		}

		if (interaction.isButton() && interaction.customId.startsWith('store_all')) {

			await storeAll(interaction, userData, serverData, interaction.message.embeds.splice(-1, 1)[0], interaction.message.embeds);
		}

	},
};

export async function sendStoreMessage(
	interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>,
	userData: UserData<never, never>,
	serverData: ServerSchema,
	restEmbed: EmbedBuilder[],
): Promise<void> {

	if (await missingPermissions(interaction, [
		'ViewChannel', // Needed because of createCommandComponentDisabler
	]) === true) { return; }

	const messageContent = remindOfAttack(interaction.guildId);

	if (calculateInventorySize(userData.quid.profile.inventory) === 0) {

		await (async function(messageObject) { return interaction.isButton() ? await update(interaction, messageObject) : await respond(interaction, messageObject, true); })({
			content: messageContent,
			embeds: [...restEmbed, new EmbedBuilder()
				.setColor(userData.quid.color)
				.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
				.setDescription(`*${userData.quid.name} goes to the food den to store ${userData.quid.pronoun(2)} findings away, but ${userData.quid.pronoun(2)} mouth is empty...*`),
			],
			components: [],
		});
		return;
	}

	if (interaction.isChatInputCommand() && interaction.options.getSubcommand(false) === 'all') {

		await storeAll(interaction, userData, serverData);
		return;
	}

	const { itemSelectMenu, storeAllButton } = getOriginalComponents(userData);

	const botReply = await (async function(messageObject) { return interaction.isButton() ? await update(interaction, messageObject) : await respond(interaction, messageObject, true); })({
		content: messageContent,
		embeds: [...restEmbed, getOriginalEmbed(userData)],
		components: [itemSelectMenu, storeAllButton],
	});

	saveCommandDisablingInfo(userData, interaction.guildId, interaction.channelId, botReply.id, interaction);
}

function getOriginalEmbed(
	userData: UserData<never, never>,
): EmbedBuilder {

	return new EmbedBuilder()
		.setColor(userData.quid.color)
		.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
		.setDescription(`*${userData.quid.name} wanders to the food den, ready to store away ${userData.quid.pronoun(2)} findings. ${capitalizeString(userData.quid.pronounAndPlural(0, 'circle'))} the food pile…*`);
}

function getOriginalComponents(
	userData: UserData<never, never>,
	defaultItem?: CommonPlantNames | UncommonPlantNames | RarePlantNames | SpecialPlantNames | SpeciesNames | MaterialNames,
) {

	const itemSelectMenuOptions: RestOrArray<SelectMenuComponentOptionData> = [];

	const inventory_ = widenValues(userData.quid.profile.inventory);
	for (const itemType of unsafeKeys(inventory_)) {

		for (const item of unsafeKeys(inventory_[itemType])) {

			if (inventory_[itemType][item] > 0) { itemSelectMenuOptions.push({ label: item, value: item, description: `${inventory_[itemType][item]}`, default: item === defaultItem }); }
		}
	}

	const itemSelectMenu = new ActionRowBuilder<StringSelectMenuBuilder>()
		.setComponents(new StringSelectMenuBuilder()
			.setCustomId(`store_options_@${userData._id}`)
			.setPlaceholder('Select an item to store away')
			.setOptions(itemSelectMenuOptions));

	const storeAllButton = new ActionRowBuilder<ButtonBuilder>()
		.setComponents(new ButtonBuilder()
			.setCustomId(`store_all_@${userData._id}`)
			.setLabel('Store everything')
			.setStyle(ButtonStyle.Success));
	return { itemSelectMenu, storeAllButton };
}

async function storeAll(
	interaction: ButtonInteraction<'cached'> | ChatInputCommandInteraction<'cached'>,
	userData: UserData<never, never>,
	serverData: ServerSchema,
	mainEmbed?: EmbedBuilder | Embed,
	otherEmbeds?: EmbedBuilder[] | Embed[],
): Promise<void> {

	const embed = new EmbedBuilder(mainEmbed?.toJSON() || getOriginalEmbed(userData).toJSON());
	let footerText = embed.toJSON().footer?.text ?? '';

	const userInventory = widenValues(userData.quid.profile.inventory);
	const serverInventory = widenValues(serverData.inventory);
	for (const itemType of unsafeKeys(userInventory)) {

		for (const itemName of unsafeKeys(userInventory[itemType])) {

			if (userInventory[itemType][itemName] > 0) {

				const maximumAmount = userInventory[itemType][itemName];

				footerText += `\n+${maximumAmount} ${itemName} for ${interaction.guild.name}`;
				userInventory[itemType][itemName] -= maximumAmount;
				serverInventory[itemType][itemName] += maximumAmount;
			}
		}
	}
	embed.setFooter(footerText ? { text: footerText } : null);

	await userData.update(
		(u) => {
			const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
			p.inventory = userInventory;
		},
	);

	serverData = await serverModel.findOneAndUpdate(
		s => s._id === serverData._id,
		(s) => {
			s.inventory = serverInventory;
		},
	);

	await (async function(messageObject) { return interaction.isButton() ? await update(interaction, messageObject) : await respond(interaction, messageObject, true); })({
		embeds: [...(otherEmbeds ?? []), embed],
		components: interaction.isButton() ? disableAllComponents(interaction.message.components) : [],
	});
	return;
}