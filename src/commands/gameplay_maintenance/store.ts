import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, Embed, EmbedBuilder, RestOrArray, SelectMenuBuilder, SelectMenuComponentOptionData, SelectMenuInteraction, SlashCommandBuilder } from 'discord.js';
import serverModel from '../../models/serverModel';
import userModel from '../../models/userModel';
import { CommonPlantNames, Inventory, MaterialNames, Profile, Quid, RarePlantNames, ServerSchema, SlashCommand, SpecialPlantNames, SpeciesNames, UncommonPlantNames, UserSchema } from '../../typedef';
import { hasCompletedAccount, isInGuild } from '../../utils/checkUserState';
import { isInvalid } from '../../utils/checkValidity';
import { createCommandComponentDisabler, disableAllComponents } from '../../utils/componentDisabling';
import { pronoun, upperCasePronounAndPlural } from '../../utils/getPronouns';
import { getMapData, widenValues, unsafeKeys, respond, update, getQuidDisplayname } from '../../utils/helperFunctions';
import { remindOfAttack } from '../gameplay_primary/attack';

const name: SlashCommand['name'] = 'store';
const description: SlashCommand['description'] = 'Take items you have gathered for your pack, and put them in the pack inventory.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.setDMPermission(false)
		.addSubcommand(option =>
			option.setName('all')
				.setDescription('Select this if you want to store all your items away.'))
		.addSubcommand(option =>
			option.setName('custom')
				.setDescription('Select this if you want to individually store your items away.'))
		.toJSON(),
	disablePreviousCommand: true,
	modifiesServerProfile: true,
	sendCommand: async (client, interaction, userData, serverData, embedArray) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (!isInGuild(interaction)) { return; }
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!hasCompletedAccount(interaction, userData)) { return; }

		/* Gets the current active quid and the server profile from the account */
		const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId));
		const profileData = getMapData(quidData.profiles, interaction.guildId);

		/* Checks if the profile is on a cooldown or passed out. */
		if (await isInvalid(interaction, userData, quidData, profileData, embedArray)) { return; }

		await sendStoreMessage(interaction, userData, quidData, profileData, serverData, embedArray);
	},
};

export async function sendStoreMessage(
	interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>,
	userData: UserSchema,
	quidData: Quid,
	profileData: Profile,
	serverData: ServerSchema,
	embedArray: EmbedBuilder[],
): Promise<void> {

	const messageContent = remindOfAttack(interaction.guildId);

	/** This is an array of all the inventory objects. */
	const inventoryObjectValues = Object.values(profileData.inventory) as Array<Inventory[keyof Inventory]>;
	/** This is an array of numbers as the properties of the keys in the inventory objects, which are numbers representing the amount one has of the key which is an item type. */
	const inventoryNumberValues = inventoryObjectValues.map(type => Object.values(type)).flat();
	if (inventoryNumberValues.reduce((a, b) => a + b) === 0) {

		await (async function(messageObject) { return interaction.isButton() ? await update(interaction, messageObject) : await respond(interaction, messageObject, true); })({
			content: messageContent,
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(quidData.color)
				.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId), iconURL: quidData.avatarURL })
				.setDescription(`*${quidData.name} goes to the food den to store ${pronoun(quidData, 2)} findings away, but ${pronoun(quidData, 2)} mouth is empty...*`),
			],
		});
		return;
	}

	if (interaction.isChatInputCommand() && interaction.options.getSubcommand(false) === 'all') {

		await storeAll(interaction, userData, quidData, profileData, serverData);
		return;
	}

	const { itemSelectMenu, storeAllButton } = getOriginalComponents(profileData);

	const botReply = await (async function(messageObject) { return interaction.isButton() ? await update(interaction, messageObject) : await respond(interaction, messageObject, true); })({
		content: messageContent,
		embeds: [...embedArray, getOriginalEmbed(userData, quidData, interaction.guildId)],
		components: [itemSelectMenu, storeAllButton],
	});

	createCommandComponentDisabler(userData.uuid, interaction.guildId, botReply);
}

function getOriginalEmbed(
	userData: UserSchema,
	quidData: Quid,
	serverId: string,
): EmbedBuilder {

	return new EmbedBuilder()
		.setColor(quidData.color)
		.setAuthor({ name: getQuidDisplayname(userData, quidData, serverId), iconURL: quidData.avatarURL })
		.setDescription(`*${quidData.name} wanders to the food den, ready to store away ${pronoun(quidData, 2)} findings. ${upperCasePronounAndPlural(quidData, 0, 'circle')} the food pile…*`);
}

function getOriginalComponents(
	profileData: Profile,
	defaultItem?: CommonPlantNames | UncommonPlantNames | RarePlantNames | SpecialPlantNames | SpeciesNames | MaterialNames,
) {

	const itemSelectMenuOptions: RestOrArray<SelectMenuComponentOptionData> = [];

	const inventory_ = widenValues(profileData.inventory);
	for (const itemType of unsafeKeys(inventory_)) {

		for (const item of unsafeKeys(inventory_[itemType])) {

			if (inventory_[itemType][item] > 0) { itemSelectMenuOptions.push({ label: item, value: item, description: `${inventory_[itemType][item]}`, default: item === defaultItem }); }
		}
	}

	const itemSelectMenu = new ActionRowBuilder<SelectMenuBuilder>()
		.setComponents(new SelectMenuBuilder()
			.setCustomId('store_options')
			.setPlaceholder('Select an item to store away')
			.setOptions(itemSelectMenuOptions));

	const storeAllButton = new ActionRowBuilder<ButtonBuilder>()
		.setComponents(new ButtonBuilder()
			.setCustomId('store_all')
			.setLabel('Store everything')
			.setStyle(ButtonStyle.Success));
	return { itemSelectMenu, storeAllButton };
}

export async function storeInteractionCollector(
	interaction: ButtonInteraction | SelectMenuInteraction,
	userData: UserSchema | null,
	serverData: ServerSchema | null,
): Promise<void> {

	if (!interaction.inCachedGuild()) { throw new Error('Interaction is not in cached guild'); }
	if (userData === null) { throw new TypeError('userData is null.'); }
	if (serverData === null) { throw new TypeError('serverData is null.'); }

	/* Gets the current active quid and the server profile from the account */
	const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId));
	const profileData = getMapData(quidData.profiles, interaction.guildId);

	if (interaction.isSelectMenu()) {

		if (interaction.customId === 'store_options') {

			const chosenFood = interaction.values[0] as CommonPlantNames | UncommonPlantNames | RarePlantNames | SpecialPlantNames | SpeciesNames | MaterialNames | undefined;
			if (chosenFood === undefined) { throw new TypeError('chosenFood is undefined'); }
			let maximumAmount = 0;

			const inventory_ = widenValues(profileData.inventory);
			for (const itemType of unsafeKeys(inventory_)) {

				if (unsafeKeys(inventory_[itemType]).includes(chosenFood)) {

					maximumAmount = inventory_[itemType][chosenFood];
				}
			}

			const amountSelectMenuOptions: RestOrArray<SelectMenuComponentOptionData> = [];

			for (let i = 1; i <= maximumAmount; i++) {

				amountSelectMenuOptions.push({ label: `${i}`, value: `${chosenFood}_${i}` });
			}

			const itemSelectMenu = getOriginalComponents(profileData, chosenFood).itemSelectMenu;

			const amountSelectMenu = new ActionRowBuilder<SelectMenuBuilder>()
				.setComponents(new SelectMenuBuilder()
					.setCustomId('store_amount')
					.setPlaceholder('Select the amount to store away')
					.setOptions(amountSelectMenuOptions));

			await update(interaction, {
				components: [itemSelectMenu, amountSelectMenu],
			});
			return;
		}

		if (interaction.customId === 'store_amount') {

			const chosenFood = interaction.values[0]?.split('_')[0] as CommonPlantNames | UncommonPlantNames | RarePlantNames | SpecialPlantNames | SpeciesNames | MaterialNames | undefined;
			if (chosenFood === undefined) { throw new TypeError('chosenFood is undefined'); }
			const chosenAmount = Number(interaction.values[0]?.split('_')[1]);
			if (isNaN(chosenAmount)) { throw new TypeError('chosenAmount is NaN'); }

			const userInventory = widenValues(profileData.inventory);
			const serverInventory = widenValues(serverData.inventory);
			for (const itemType of unsafeKeys(userInventory)) {

				if (unsafeKeys(userInventory[itemType]).includes(chosenFood)) {

					userInventory[itemType][chosenFood] -= chosenAmount;
					serverInventory[itemType][chosenFood] += chosenAmount;
				}
			}

			await userModel.findOneAndUpdate(
				u => u.uuid === userData!.uuid,
				(u) => {
					const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
					p.inventory = userInventory;
				},
			);

			await serverModel.findOneAndUpdate(
				s => s.uuid === serverData.uuid,
				(s) => {
					s.inventory = serverInventory;
				},
			);

			const { itemSelectMenu, storeAllButton } = getOriginalComponents(profileData);

			const embed = new EmbedBuilder(interaction.message.embeds.splice(-1, 1)[0]?.toJSON() || getOriginalEmbed(userData, quidData, interaction.guildId).toJSON());
			let footerText = embed.toJSON().footer?.text ?? '';
			footerText += `\n+${chosenAmount} ${chosenFood} for ${interaction.guild.name}`;
			embed.setFooter({ text: footerText });

			await update(interaction, {
				embeds: [...interaction.message.embeds, embed],
				components: itemSelectMenu.toJSON().components[0]?.options.length === 0 ? disableAllComponents(interaction.message.components) : [itemSelectMenu, storeAllButton],
			});
			return;
		}
	}

	if (interaction.isButton() && interaction.customId === 'store_all') {

		await storeAll(interaction, userData, quidData, profileData, serverData, interaction.message.embeds.splice(-1, 1)[0], interaction.message.embeds);
	}
}

async function storeAll(
	interaction: ButtonInteraction<'cached'> | ChatInputCommandInteraction<'cached'>,
	userData: UserSchema,
	quidData: Quid,
	profileData: Profile,
	serverData: ServerSchema,
	mainEmbed?: EmbedBuilder | Embed,
	otherEmbeds?: EmbedBuilder[] | Embed[],
): Promise<void> {

	const embed = new EmbedBuilder(mainEmbed?.toJSON() || getOriginalEmbed(userData, quidData, interaction.guildId).toJSON());
	let footerText = embed.toJSON().footer?.text ?? '';

	const userInventory = widenValues(profileData.inventory);
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

	await userModel.findOneAndUpdate(
		u => u.uuid === userData!.uuid,
		(u) => {
			const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
			p.inventory = userInventory;
		},
	);

	await serverModel.findOneAndUpdate(
		s => s.uuid === serverData.uuid,
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