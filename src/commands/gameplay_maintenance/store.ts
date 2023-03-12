import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, Embed, EmbedBuilder, RestOrArray, StringSelectMenuBuilder, SelectMenuComponentOptionData, SlashCommandBuilder } from 'discord.js';
import Quid from '../../models/quid';
import QuidToServer from '../../models/quidToServer';
import Server from '../../models/server';
import User from '../../models/user';
import UserToServer from '../../models/userToServer';
import { CommonPlantNames, MaterialNames, RarePlantNames, SpecialPlantNames, SpeciesNames, UncommonPlantNames } from '../../typings/data/general';
import { SlashCommand } from '../../typings/handle';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid } from '../../utils/checkValidity';
import { saveCommandDisablingInfo, disableAllComponents } from '../../utils/componentDisabling';
import { getDisplayname, pronoun, pronounAndPlural } from '../../utils/getQuidInfo';
import { getArrayElement, capitalize, respond, deepCopy } from '../../utils/helperFunctions';
import { missingPermissions } from '../../utils/permissionHandler';
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
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer, server }) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (server === undefined) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (user !== undefined && (await Quid.count({ where: { userId: user.id } })) > 0) })) { return; } // This is always a reply
		if (!user) { throw new TypeError('user is undefined'); }
		if (!userToServer) { throw new TypeError('userToServer is undefined'); }
		if (!quidToServer) { throw new TypeError('quidToServer is undefined'); }

		/* Checks if the profile is resting, on a cooldown or passed out. */
		const restEmbed = await isInvalid(interaction, user, userToServer, quid, quidToServer);
		if (restEmbed === false) { return; }

		await sendStoreMessage(interaction, user, quid, userToServer, quidToServer, server, restEmbed);
	},
	async sendMessageComponentResponse(interaction, { user, quid, userToServer, quidToServer, server }) {

		/* This ensures that the user is in a guild and has a completed account. */
		if (server === undefined) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (user !== undefined && (await Quid.count({ where: { userId: user.id } })) > 0) })) { return; } // This is always a reply
		if (!user) { throw new TypeError('user is undefined'); }
		if (!userToServer) { throw new TypeError('userToServer is undefined'); }
		if (!quidToServer) { throw new TypeError('quidToServer is undefined'); }

		if (interaction.isStringSelectMenu()) {

			if (interaction.customId.startsWith('store_options')) {

				const chosenFood = getArrayElement(interaction.values, 0) as CommonPlantNames | UncommonPlantNames | RarePlantNames | SpecialPlantNames | SpeciesNames | MaterialNames;
				const maximumAmount = quidToServer.inventory.filter(i => i === chosenFood).length;

				const amountSelectMenuOptions: RestOrArray<SelectMenuComponentOptionData> = [];

				for (let i = 1; i <= maximumAmount; i++) {

					amountSelectMenuOptions.push({ label: `${i}`, value: `${chosenFood}_${i}` });
				}

				const itemSelectMenu = getOriginalComponents(user, quidToServer, chosenFood).itemSelectMenu;

				const amountSelectMenu = new ActionRowBuilder<StringSelectMenuBuilder>()
					.setComponents(new StringSelectMenuBuilder()
						.setCustomId(`store_amount_@${user.id}`)
						.setPlaceholder('Select the amount to store away')
						.setOptions(amountSelectMenuOptions));

				// This is an update to the message with the select menu
				await respond(interaction, {
					components: [itemSelectMenu, amountSelectMenu],
				}, 'update', interaction.message.id);
				return;
			}

			if (interaction.customId.startsWith('store_amount')) {

				const chosenFood = getArrayElement(getArrayElement(interaction.values, 0).split('_'), 0) as CommonPlantNames | UncommonPlantNames | RarePlantNames | SpecialPlantNames | SpeciesNames | MaterialNames;
				const chosenAmount = Number(getArrayElement(getArrayElement(interaction.values, 0).split('_'), 1));
				if (isNaN(chosenAmount)) { throw new TypeError('chosenAmount is NaN'); }

				let foundCount = 0;
				const serverInv = deepCopy(server.inventory);
				const qtsInv = deepCopy(quidToServer.inventory).filter((item) => {
					if (item === chosenFood && foundCount < chosenAmount) {
						foundCount++;
						serverInv.push(item);
						return false;
					}
					return true;
				});

				await quidToServer.update({ inventory: qtsInv });
				await server.update({ inventory: serverInv });

				const { itemSelectMenu, storeAllButton } = getOriginalComponents(user, quidToServer);

				const embed = new EmbedBuilder(interaction.message.embeds.splice(-1, 1)[0]?.toJSON() || (await getOriginalEmbed(quid, { serverId: interaction.guildId, userToServer, quidToServer, user })).toJSON());
				let footerText = embed.toJSON().footer?.text ?? '';
				footerText += `\n+${chosenAmount} ${chosenFood} for ${interaction.guild.name}`;
				embed.setFooter({ text: footerText });

				// This is an update to the message with the select menu
				await respond(interaction, {
					embeds: [...interaction.message.embeds, embed],
					components: itemSelectMenu.components[0]?.options.length === 0 ? disableAllComponents(interaction.message.components) : [itemSelectMenu, storeAllButton],
				}, 'update', interaction.message.id);
				return;
			}
		}

		if (interaction.isButton() && interaction.customId.startsWith('store_all')) {

			await storeAll(interaction, quidToServer, server, interaction.message.embeds.splice(-1, 1)[0] ?? await getOriginalEmbed(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }), interaction.message.embeds);
		}
	},
};

// This can either be called directly from the store command, the stats command, or the travel-regions command
export async function sendStoreMessage(
	interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>,
	user: User,
	quid: Quid,
	userToServer: UserToServer,
	quidToServer: QuidToServer,
	server: Server,
	restEmbed: EmbedBuilder[],
): Promise<void> {

	if (await missingPermissions(interaction, [
		'ViewChannel', // Needed because of createCommandComponentDisabler
	]) === true) { return; }

	const messageContent = remindOfAttack(interaction.guildId);

	if (quidToServer.inventory.length === 0) {

		// This is a reply if the interaction is a ChatInputCommand, and an update to the message with the button if the interaction is a button
		await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, new EmbedBuilder()
				.setColor(quid.color)
				.setAuthor({
					name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
					iconURL: quid.avatarURL,
				})
				.setDescription(`*${quid.name} goes to the food den to store ${pronoun(quid, 2)} findings away, but ${pronoun(quid, 2)} mouth is empty...*`),
			],
			components: [],
		}, 'update', interaction.isMessageComponent() ? interaction.message.id : undefined);
		return;
	}

	if (interaction.isChatInputCommand() && interaction.options.getSubcommand(false) === 'all') {

		await storeAll(interaction, quidToServer, server, await getOriginalEmbed(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }));
		return;
	}

	const { itemSelectMenu, storeAllButton } = getOriginalComponents(user, quidToServer);

	// This is a reply if the interaction is a ChatInputCommand, and an update to the message with the button if the interaction is a button
	const botReply = await respond(interaction, {
		content: messageContent,
		embeds: [...restEmbed, await getOriginalEmbed(quid, { serverId: interaction.guildId, userToServer, quidToServer, user })],
		components: [itemSelectMenu, storeAllButton],
		fetchReply: true,
	}, 'update', interaction.isMessageComponent() ? interaction.message.id : undefined);

	saveCommandDisablingInfo(userToServer, interaction, interaction.channelId, botReply.id);
}

async function getOriginalEmbed(
	quid: Quid,
	displaynameOptions: Parameters<typeof getDisplayname>[1],
): Promise<EmbedBuilder> {

	return new EmbedBuilder()
		.setColor(quid.color)
		.setAuthor({
			name: await getDisplayname(quid, displaynameOptions),
			iconURL: quid.avatarURL,
		})
		.setDescription(`*${quid.name} wanders to the food den, ready to store away ${pronoun(quid, 2)} findings. ${capitalize(pronounAndPlural(quid, 0, 'circle'))} the food pile…*`);
}

function getOriginalComponents(
	user: User,
	quidToServer: QuidToServer,
	defaultItem?: CommonPlantNames | UncommonPlantNames | RarePlantNames | SpecialPlantNames | SpeciesNames | MaterialNames,
) {

	const itemSelectMenuOptions: RestOrArray<SelectMenuComponentOptionData> = [];

	const itemCounts: { [key: string]: number } = {};

	quidToServer.inventory.forEach(item => {
		if (!itemCounts[item]) { itemCounts[item] = 0; }
		itemCounts[item]++;
	});

	for (const [item, itemCount] of Object.entries(itemCounts)) {

		itemSelectMenuOptions.push({ label: item, value: item, description: `${itemCount}`, default: item === defaultItem });
	}

	const itemSelectMenu = new ActionRowBuilder<StringSelectMenuBuilder>()
		.setComponents(new StringSelectMenuBuilder()
			.setCustomId(`store_options_@${user.id}`)
			.setPlaceholder('Select an item to store away')
			.setOptions(itemSelectMenuOptions));

	const storeAllButton = new ActionRowBuilder<ButtonBuilder>()
		.setComponents(new ButtonBuilder()
			.setCustomId(`store_all_@${user.id}`)
			.setLabel('Store everything')
			.setStyle(ButtonStyle.Success));
	return { itemSelectMenu, storeAllButton };
}

async function storeAll(
	interaction: ButtonInteraction<'cached'> | ChatInputCommandInteraction<'cached'>,
	quidToServer: QuidToServer,
	server: Server,
	mainEmbed: EmbedBuilder | Embed,
	otherEmbeds?: EmbedBuilder[] | Embed[],
): Promise<void> {

	const embed = new EmbedBuilder(mainEmbed.toJSON());
	let footerText = embed.toJSON().footer?.text ?? '';

	const itemCounts: { [key: string]: number } = {};

	const serverInv = deepCopy(server.inventory);
	quidToServer.inventory.forEach(item => {
		if (!itemCounts[item]) { itemCounts[item] = 0; }
		itemCounts[item]++;
		serverInv.push(item);
	});

	for (const item in itemCounts) { footerText += `-${itemCounts[item]} ${item}\n`; }

	embed.setFooter(footerText ? { text: footerText } : null);

	await quidToServer.update({ inventory: [] });
	await server.update({ inventory: serverInv });

	// This is a reply if the interaction is a ChatInputCommand, and an update to the message with the button if the interaction is a button
	await respond(interaction, {
		embeds: [...(otherEmbeds ?? []), embed],
		components: interaction.isButton() ? disableAllComponents(interaction.message.components) : [],
	}, 'update', interaction.isMessageComponent() ? interaction.message.id : undefined);
	return;
}