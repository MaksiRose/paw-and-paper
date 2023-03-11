import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, RestOrArray, StringSelectMenuBuilder, SelectMenuComponentOptionData, AnySelectMenuInteraction, SlashCommandBuilder, SnowflakeUtil } from 'discord.js';
import Fuse from 'fuse.js';
import { Op } from 'sequelize';
import { commonPlantsInfo, materialsInfo, rarePlantsInfo, specialPlantsInfo, speciesInfo, uncommonPlantsInfo } from '../..';
import Den from '../../models/den';
import DiscordUser from '../../models/discordUser';
import DiscordUserToServer from '../../models/discordUserToServer';
import Quid from '../../models/quid';
import QuidToServer from '../../models/quidToServer';
import Server from '../../models/server';
import User from '../../models/user';
import UserToServer from '../../models/userToServer';
import { CommonPlantNames, RarePlantNames, SpecialPlantNames, UncommonPlantNames } from '../../typings/data/general';
import { CurrentRegionType, RankType } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { PlantEdibilityType } from '../../typings/main';
import { drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { changeCondition, infectWithChance } from '../../utils/changeCondition';
import { updateAndGetMembers } from '../../utils/checkRoleRequirements';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInteractable, isInvalid, isPassedOut } from '../../utils/checkValidity';
import { saveCommandDisablingInfo, disableAllComponents, deleteCommandDisablingInfo, componentDisablingInteractions } from '../../utils/componentDisabling';
import { addFriendshipPoints } from '../../utils/friendshipHandling';
import getInventoryElements from '../../utils/getInventoryElements';
import { getDisplayname, getDisplayspecies, pronoun, pronounAndPlural } from '../../utils/getQuidInfo';
import { capitalize, getArrayElement, keyInObject, respond } from '../../utils/helperFunctions';
import { checkLevelUp } from '../../utils/levelHandling';
import { missingPermissions } from '../../utils/permissionHandler';
import { getRandomNumber, pullFromWeightedTable } from '../../utils/randomizers';
import { wearDownDen } from '../../utils/wearDownDen';
import { remindOfAttack } from '../gameplay_primary/attack';

const itemInfo = { ...commonPlantsInfo, ...uncommonPlantsInfo, ...rarePlantsInfo, ...specialPlantsInfo };

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('heal')
		.setDescription('Heal injuries_ Not available to Younglings. Less effective on yourself, and as Apprentice or Hunter.')
		.addUserOption(option =>
			option.setName('user')
				.setDescription('The user you want to heal.')
				.setRequired(false))
		.addStringOption(option =>
			option.setName('item')
				.setDescription('The item that you would like to heal the user with.')
				.setAutocomplete(true)
				.setRequired(false))
		.toJSON(),
	category: 'page3',
	position: 7,
	disablePreviousCommand: true,
	modifiesServerProfile: true,
	sendAutocomplete: async (interaction, { quidToServer }) => {

		if (!quidToServer) { return; }
		const focusedValue = interaction.options.getFocused();
		let choices: string[] = [...new Set(quidToServer.inventory)].filter(i => !keyInObject(materialsInfo, i) && !keyInObject(speciesInfo, i));

		if (focusedValue.length > 0) { choices = new Fuse(choices).search(focusedValue).map(value => value.item); }

		await interaction.respond(
			choices.slice(0, 25).map(choice => ({ name: choice, value: choice })),
		);
	},
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

		const messageContent = remindOfAttack(interaction.guildId);

		if (quidToServer.rank === RankType.Youngling) {

			// This is always a reply
			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setDescription(`*A healer rushes into the medicine den in fury.*\n"${quid.name}, you are not trained to heal yourself, and especially not to heal others! I don't ever wanna see you again in here without supervision!"\n*${quid.name} lowers ${pronoun(quid, 2)} head and leaves in shame.*`)],
			});
			return;
		}

		// Make a function that makes a message for you. If you give it a valid user or quid, it will give you the problems the user has + a list of herbs. if you give it a page (1 | 2), it will give you a list of herbs from that page. If you give it an available herb as well, it will check whether there was an existing message where a problem was mentioned that the user already not has anymore (in which case it will refresh the info and tell the user to pick again) and if not, apply the herb.
		const chosenUser = interaction.options.getUser('user');

		const discordUser2 = chosenUser ? await DiscordUser.findByPk(chosenUser.id) ?? undefined : undefined;
		const user2 = discordUser2 ? await User.findByPk(discordUser2.userId) ?? undefined : undefined;
		const userToServer2 = user2 ? await UserToServer.findOne({ where: { userId: user2.id, serverId: server.id } }) ?? undefined : undefined;
		const quid2 = userToServer2?.activeQuidId ? await Quid.findByPk(userToServer2.activeQuidId) ?? undefined : undefined;
		const quidToServer2 = quid2 ? await QuidToServer.findOne({ where: { quidId: quid2.id, serverId: server.id } }) ?? undefined : undefined;

		if (user2 && !isInteractable(interaction, quid2, quidToServer2, user2, userToServer2, messageContent, restEmbed, { checkFullInventory: false, checkPassedOut: false })) { return; }

		let chosenItem = interaction.options.getString('item') ?? undefined;
		if (!chosenItem || !stringIsAvailableItem(chosenItem, server.inventory)) { chosenItem = undefined; }

		await getHealResponse(interaction, user, quid, userToServer, quidToServer, server, messageContent, restEmbed, 0, user2, quid2, discordUser2?.id, quidToServer2, 1, chosenItem);
	},
	async sendMessageComponentResponse(interaction, { user, quid, userToServer, quidToServer, server }) {

		/* This ensures that the user is in a guild and has a completed account. */
		if (server === undefined) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (user !== undefined && (await Quid.count({ where: { userId: user.id } })) > 0) })) { return; } // This is always a reply
		if (!user) { throw new TypeError('user is undefined'); }
		if (!userToServer) { throw new TypeError('userToServer is undefined'); }
		if (!quidToServer) { throw new TypeError('quidToServer is undefined'); }

		if (interaction.isStringSelectMenu() && interaction.customId.startsWith('heal_quids_options')) {

			const value = getArrayElement(interaction.values, 0);
			if (value.startsWith('newpage_')) {

				const page = Number(value.replace('newpage_', ''));
				if (isNaN(page)) { throw new TypeError('page is NaN'); }

				await getHealResponse(interaction, user, quid, userToServer, quidToServer, server, '', [], page);
			}
			else {

				const quid2 = await Quid.findByPk(value) ?? undefined;
				const quidToServer2 = quid2 ? await QuidToServer.findOne({ where: { quidId: quid2.id, serverId: server.id } }) ?? undefined : undefined;
				const user2 = quid2 ? await User.findByPk(quid2.userId) ?? undefined : undefined;
				const userToServer2 = user2 ? await UserToServer.findOne({ where: { userId: user2.id, serverId: server.id } }) ?? undefined : undefined;

				const discordUsers2 = user2 ? await DiscordUser.findAll({ where: { userId: user2.id } }) : undefined;
				const discordUserToServer2 = discordUsers2 ? await DiscordUserToServer.findOne({
					where: {
						serverId: server.id,
						discordUserId: { [Op.in]: discordUsers2.map(du => du.id) },
					},
				}) : undefined;

				if (!isInteractable(interaction, quid2, quidToServer2, user2, userToServer2, '', [], { checkFullInventory: false, checkPassedOut: false })) { return; }
				if (!quidToServer2) { throw new TypeError('quidToServer2 is undefined'); }
				if (!user2) { throw new TypeError('user2 is undefined'); }
				if (!discordUserToServer2) { throw new TypeError('discordUserToServer2 is undefined'); }

				await getHealResponse(interaction, user, quid, userToServer, quidToServer, server, '', [], 0, user2, quid2, discordUserToServer2.discordUserId, quidToServer2);
			}
		}
		else if (interaction.customId.startsWith('heal_page_')) {

			const inventoryPage = Number(getArrayElement(interaction.customId.split('_'), 2));
			if (isNaN(inventoryPage)) { throw new TypeError('inventoryPage is NaN'); }
			if (inventoryPage !== 1 && inventoryPage !== 2) { throw new TypeError('inventoryPage is not 1 or 2'); }
			const quidId = getArrayElement(interaction.customId.split('_'), 3);

			const quid2 = await Quid.findByPk(quidId) ?? undefined;
			const quidToServer2 = quid2 ? await QuidToServer.findOne({ where: { quidId: quid2.id, serverId: server.id } }) ?? undefined : undefined;
			const user2 = quid2 ? await User.findByPk(quid2.userId) ?? undefined : undefined;
			const userToServer2 = user2 ? await UserToServer.findOne({ where: { userId: user2.id, serverId: server.id } }) ?? undefined : undefined;

			const discordUsers2 = user2 ? await DiscordUser.findAll({ where: { userId: user2.id } }) : undefined;
			const discordUserToServer2 = discordUsers2 ? await DiscordUserToServer.findOne({
				where: {
					serverId: server.id,
					discordUserId: { [Op.in]: discordUsers2.map(du => du.id) },
				},
			}) : undefined;

			if (!isInteractable(interaction, quid2, quidToServer2, user2, userToServer2, '', [], { checkFullInventory: false, checkPassedOut: false })) { return; }
			if (!quidToServer2) { throw new TypeError('quidToServer2 is undefined'); }
			if (!user2) { throw new TypeError('user2 is undefined'); }
			if (!discordUserToServer2) { throw new TypeError('discordUserToServer2 is undefined'); }

			await getHealResponse(interaction, user, quid, userToServer, quidToServer, server, '', [], 0, user2, quid2, discordUserToServer2.discordUserId, quidToServer2, inventoryPage);
		}
		else if (interaction.isStringSelectMenu() && interaction.customId.startsWith('heal_inventory_options_')) {

			const quidId = getArrayElement(interaction.customId.split('_'), 3);

			const quid2 = await Quid.findByPk(quidId) ?? undefined;
			const quidToServer2 = quid2 ? await QuidToServer.findOne({ where: { quidId: quid2.id, serverId: server.id } }) ?? undefined : undefined;
			const user2 = quid2 ? await User.findByPk(quid2.userId) ?? undefined : undefined;
			const userToServer2 = user2 ? await UserToServer.findOne({ where: { userId: user2.id, serverId: server.id } }) ?? undefined : undefined;

			const discordUsers2 = user2 ? await DiscordUser.findAll({ where: { userId: user2.id } }) : undefined;
			const discordUserToServer2 = discordUsers2 ? await DiscordUserToServer.findOne({
				where: {
					serverId: server.id,
					discordUserId: { [Op.in]: discordUsers2.map(du => du.id) },
				},
			}) : undefined;

			if (!isInteractable(interaction, quid2, quidToServer2, user2, userToServer2, '', [], { checkFullInventory: false, checkPassedOut: false })) { return; }
			if (!quidToServer2) { throw new TypeError('quidToServer2 is undefined'); }
			if (!user2) { throw new TypeError('user2 is undefined'); }
			if (!discordUserToServer2) { throw new TypeError('discordUserToServer2 is undefined'); }

			let chosenItem = interaction.values[0];
			if (!chosenItem || !stringIsAvailableItem(chosenItem, server.inventory)) { chosenItem = undefined; }

			await getHealResponse(interaction, user, quid, userToServer, quidToServer, server, '', [], 0, user2, quid2, discordUserToServer2.discordUserId, quidToServer2, 1, chosenItem);
		}
	},
};

/**
 * If the quid has a profile for the given guild, and any of its energy, health, hunger, or thirst are zero, or it has an injury, then it needs healing.
 * @param {Quid} q - Quid - The quid object
 * @param {string} guildId - The ID of the guild the quid is in.
 * @returns A boolean value.
 */
export function quidNeedsHealing(
	quidToServer: QuidToServer,
	checkOnlyFor?: 'energy' | 'hunger' | 'wounds' | 'infections' | 'cold' | 'sprains' | 'poison',
): boolean {

	return ((checkOnlyFor === undefined || checkOnlyFor === 'energy') && quidToServer.energy === 0) ||
		(checkOnlyFor === undefined && quidToServer.health === 0) ||
		((checkOnlyFor === undefined || checkOnlyFor === 'hunger') && quidToServer.hunger === 0) ||
		(checkOnlyFor === undefined && quidToServer.thirst === 0) ||
		((checkOnlyFor === undefined || checkOnlyFor === 'wounds') && quidToServer.injuries_wounds > 0) ||
		((checkOnlyFor === undefined || checkOnlyFor === 'infections') && quidToServer.injuries_infections > 0) ||
		((checkOnlyFor === undefined || checkOnlyFor === 'cold') && quidToServer.injuries_cold === true) ||
		((checkOnlyFor === undefined || checkOnlyFor === 'sprains') && quidToServer.injuries_sprains > 0) ||
		((checkOnlyFor === undefined || checkOnlyFor === 'poison') && quidToServer.injuries_poison === true);
}

/** This function is used to make item-string equal to undefined in getHealResponse if the string isn't a herb/water that is also available */
function stringIsAvailableItem(
	string: string,
	inventory: string[],
): string is CommonPlantNames | UncommonPlantNames | RarePlantNames | SpecialPlantNames | 'water' {

	return string === 'water'
	|| (
		(
			keyInObject(commonPlantsInfo, string)
			|| keyInObject(uncommonPlantsInfo, string)
			|| keyInObject(rarePlantsInfo, string)
			|| keyInObject(specialPlantsInfo, string)
		)
		&& inventory.includes(string)
	);
}

export async function getHealResponse(
	interaction: ChatInputCommandInteraction<'cached'> | AnySelectMenuInteraction<'cached'> | ButtonInteraction<'cached'>,
	user: User,
	quid: Quid,
	userToServer: UserToServer,
	quidToServer: QuidToServer,
	server: Server,
	messageContent: string,
	embedArray: EmbedBuilder[],
	quidPage = 0,
	user2?: User,
	quid2?: Quid,
	discordUser2?: string,
	quidToServer2?: QuidToServer,
	inventoryPage: 1 | 2 = 1,
	item?: CommonPlantNames | UncommonPlantNames | RarePlantNames | SpecialPlantNames | 'water',
): Promise<void> {

	if (await missingPermissions(interaction, [
		'ViewChannel', // Needed because of createCommandComponentDisabler
		/* 'ViewChannel',*/ interaction.channel?.isThread() ? 'SendMessagesInThreads' : 'SendMessages', 'EmbedLinks', // Needed for channel.send call in addFriendshipPoints
	]) === true) { return; }

	const quidsToHeal = await (async function(
	): Promise<Quid[]> {

		const quidToServers = await QuidToServer.findAll({ where: { serverId: server.id }, include: [{
			model: Quid,
			as: 'quid',
			where: {
				name: { [Op.not]: '' },
				species: { [Op.not]: null },
			},
		}] });
		return quidToServers.filter(qts => quidNeedsHealing(qts)).map(qts => qts.quid);
	})();

	let quidsSelectMenuOptions: RestOrArray<SelectMenuComponentOptionData> = quidsToHeal.map(q => ({ label: q.name, value: q.id }));
	if (quidsSelectMenuOptions.length > 25) {

		const totalQuidPages = Math.ceil(quidsSelectMenuOptions.length / 24);
		quidsSelectMenuOptions = quidsSelectMenuOptions.splice(quidPage * 24, 24);

		const newQuidPage = 1 + quidPage >= totalQuidPages ? 0 : quidPage;
		quidsSelectMenuOptions.push({ label: 'Show more user options', value: `newpage_${newQuidPage}`, description: `You are currently on page ${quidPage + 1}`, emoji: '📋' });
	}

	const quidsSelectMenu = new ActionRowBuilder<StringSelectMenuBuilder>()
		.setComponents(new StringSelectMenuBuilder()
			.setCustomId(`heal_quids_options_@${user.id}`)
			.setPlaceholder('Select a quid to heal')
			.setOptions(quidsSelectMenuOptions));

	if (!hasNameAndSpecies(quid2) || !quidToServer2 || !user2 || !discordUser2) {

		// If this is a ChatInputCommand, this is a reply, else this is an update to the message with the component
		const botReply = await respond(interaction, {
			content: messageContent,
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(quid.color)
				.setAuthor({
					name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
					iconURL: quid.avatarURL,
				})
				.setDescription(`*${quid.name} sits in front of the medicine den, looking if anyone needs help with injuries or illnesses.*`)
				.setFooter({ text: 'Tip: Healing yourself has a lower chance of being successful than healing others. Healers and Elderlies are more often successful than Apprentices and Hunters.' })],
			components: quidsToHeal.length > 0 && quidsSelectMenuOptions.length > 0 ? [quidsSelectMenu] : [],
			fetchReply: true,
		}, 'update', interaction.isMessageComponent() ? interaction.message.id : undefined);

		saveCommandDisablingInfo(userToServer, interaction, interaction.channelId, botReply.id);
		return;
	}

	if (!item) {

		const pagesButtons = new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(`heal_page_1_${quid2.id}_@${user.id}`)
				.setLabel('Page 1')
				.setEmoji('🌱')
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId(`heal_page_2_${quid2.id}_@${user.id}`)
				.setLabel('Page 2')
				.setEmoji('🍀')
				.setStyle(ButtonStyle.Secondary)]);

		let healUserConditionText = '';

		healUserConditionText += (quidToServer2.health <= 0) ? '\nHealth: 0' : '';
		healUserConditionText += (quidToServer2.energy <= 0) ? '\nEnergy: 0' : '';
		healUserConditionText += (quidToServer2.hunger <= 0) ? '\nHunger: 0' : '';
		healUserConditionText += (quidToServer2.thirst <= 0) ? '\nThirst: 0' : '';
		healUserConditionText += (quidToServer2.injuries_wounds > 0) ? `\nWounds: ${quidToServer2.injuries_wounds}` : '';
		healUserConditionText += (quidToServer2.injuries_infections > 0) ? `\nInfections: ${quidToServer2.injuries_infections}` : '';
		healUserConditionText += (quidToServer2.injuries_cold == true) ? '\nCold: yes' : '';
		healUserConditionText += (quidToServer2.injuries_sprains > 0) ? `\nSprains: ${quidToServer2.injuries_sprains}` : '';
		healUserConditionText += (quidToServer2.injuries_poison == true) ? '\nPoison: yes' : '';

		if (healUserConditionText === '') {

			// If this is a ChatInputCommand, this is a reply, else this is an update to the message with the component
			const botReply = await respond(interaction, {
				content: messageContent,
				embeds: [...embedArray, new EmbedBuilder()
					.setColor(quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setDescription(`*${quid.name} approaches ${quid2.name}, desperately searching for someone to help.*\n"Do you have any injuries or illnesses you know of?" *the ${getDisplayspecies(quid)} asks.\n${quid2.name} shakes ${pronoun(quid2, 2)} head.* "Not that I know of, no."\n*Disappointed, ${quid.name} goes back to the medicine den.*`)],
				components: quidsToHeal.length > 0 && quidsSelectMenuOptions.length > 0 ? [quidsSelectMenu] : [],
				fetchReply: true,
			}, 'update', interaction.isMessageComponent() ? interaction.message.id : undefined);

			saveCommandDisablingInfo(userToServer, interaction, interaction.channelId, botReply.id);
			return;
		}

		const quidConditionEmbed = new EmbedBuilder()
			.setColor(quid.color)
			.setAuthor({
				name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
				iconURL: quid.avatarURL,
			})
			.setDescription(user2.id === user.id
				? `*${quid2.name} pushes aside the leaves acting as the entrance to the healer's den. With tired eyes ${pronounAndPlural(quid2, 0, 'inspect')} the rows of herbs, hoping to find one that can ease ${pronoun(quid2, 2)} pain.*`
				: quidToServer2.energy <= 0 || quidToServer2.health <= 0 || quidToServer2.hunger <= 0 || quidToServer2.thirst <= 0
					? `*${quid.name} runs towards the pack borders, where ${quid2.name} lies, only barely conscious. The ${quidToServer.rank} immediately looks for the right herbs to help the ${getDisplayspecies(quid2)}.*`
					: `*${quid2.name} enters the medicine den with tired eyes.* "Please help me!" *${pronounAndPlural(quid2, 0, 'say')}, ${pronoun(quid2, 2)} face contorted in pain. ${quid.name} looks up with worry.* "I'll see what I can do for you."`)
			.setFooter({ text: `${quid2.name}'s condition:${healUserConditionText}` });

		let { embedDescription, selectMenuOptions } = getInventoryElements(server.inventory, inventoryPage);
		if (inventoryPage === 2) {

			embedDescription = `**water** - Found lots and lots of in the river that flows through the pack!\n${embedDescription}`;
			selectMenuOptions.unshift({ label: 'water', value: 'water' });
		}

		const inventoryEmbed = new EmbedBuilder()
			.setColor(quid.color)
			.setTitle(`Inventory of ${interaction.guild.name} - Page ${inventoryPage}`)
			.setDescription(embedDescription || null);
		const inventorySelectMenu = new ActionRowBuilder<StringSelectMenuBuilder>()
			.setComponents(new StringSelectMenuBuilder()
				.setCustomId(`heal_inventory_options_${quid2.id}_@${user.id}`)
				.setPlaceholder('Select an item')
				.setOptions(selectMenuOptions));

		// If this is a ChatInputCommand, this is a reply, else this is an update to the message with the component
		const botReply = await respond(interaction, {
			content: messageContent,
			embeds: [...embedArray, quidConditionEmbed, inventoryEmbed],
			components: [quidsSelectMenu, pagesButtons, ...(selectMenuOptions.length > 0 ? [inventorySelectMenu] : [])],
			fetchReply: true,
		}, 'update', interaction.isMessageComponent() ? interaction.message.id : undefined);

		saveCommandDisablingInfo(userToServer, interaction, interaction.channelId, botReply.id);
		return;
	}

	// This part of the code is only executed if a herb has been given

	if (!quidsToHeal.some(q => q.id === quid2.id)) {

		// If this is a ChatInputCommand, this is a reply, else this is an update to the message with the component
		const botReply = await respond(interaction, {
			content: messageContent,
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(quid.color)
				.setTitle(`${quid2.name} doesn't need to be healed anymore. Please select another quid to heal if available.`)],
			components: quidsToHeal.length > 0 && quidsSelectMenuOptions.length > 0 ? [quidsSelectMenu] : [],
			fetchReply: true,
		}, 'update', interaction.isMessageComponent() ? interaction.message.id : undefined);

		saveCommandDisablingInfo(userToServer, interaction, interaction.channelId, botReply.id);
		return;
	}

	const userCondition = interaction.isMessageComponent() ? interaction.message.embeds[interaction.message.embeds.length - 2]?.footer?.text.toLowerCase() : undefined;
	let userHasChangedCondition = false;
	let isSuccessful = false;

	let injuryUpdateText = '';

	if (item === 'water') {

		if (quidToServer2.thirst <= 0) { isSuccessful = true; }
		else if (userCondition?.includes('thirst')) { userHasChangedCondition = true; }
	}
	else {

		const itemIndex = server.inventory.findIndex(i => i === item);
		if (itemIndex < 0) { throw new Error('item does not exist in server.inventory'); }
		await server.update({ inventory: server.inventory.filter((_, idx) => idx !== itemIndex) });

		if (itemInfo[item].edibility === PlantEdibilityType.Edible) {

			if (quidToServer2.hunger <= 0) { isSuccessful = true; }
			else if (userCondition?.includes('hunger')) { userHasChangedCondition = true; }
		}

		if (quidToServer2.health <= 0) { isSuccessful = true; }
		else if (userCondition?.includes('health')) { userHasChangedCondition = true; }

		if (itemInfo[item].healsWounds) {

			if (quidToServer2.injuries_wounds > 0) {

				isSuccessful = true;
				injuryUpdateText += `\n-1 wound for ${quid2.name}`;
				quidToServer2.injuries_wounds -= 1;
			}
			else if (userCondition?.includes('wounds')) { userHasChangedCondition = true; }
		}

		if (itemInfo[item].healsInfections) {

			if (quidToServer2.injuries_infections > 0) {

				isSuccessful = true;
				injuryUpdateText += `\n-1 infection for ${quid2.name}`;
				quidToServer2.injuries_infections -= 1;
			}
			else if (userCondition?.includes('infections')) { userHasChangedCondition = true; }
		}

		if (itemInfo[item].healsColds) {

			if (quidToServer2.injuries_cold == true) {

				isSuccessful = true;
				injuryUpdateText += `\ncold healed for ${quid2.name}`;
				quidToServer2.injuries_cold = false;
			}
			else if (userCondition?.includes('cold')) { userHasChangedCondition = true; }
		}

		if (itemInfo[item].healsSprains) {

			if (quidToServer2.injuries_sprains > 0) {

				isSuccessful = true;
				injuryUpdateText += `\n-1 sprain for ${quid2.name}`;
				quidToServer2.injuries_sprains -= 1;
			}
			else if (userCondition?.includes('sprains')) { userHasChangedCondition = true; }
		}

		if (itemInfo[item].healsPoison) {

			if (quidToServer2.injuries_poison == true) {

				isSuccessful = true;
				injuryUpdateText += `\npoison healed for ${quid2.name}`;
				quidToServer2.injuries_poison = false;
			}
			else if (userCondition?.includes('poison')) { userHasChangedCondition = true; }
		}

		if (itemInfo[item].givesEnergy) {

			if (quidToServer2.energy <= 0) { isSuccessful = true; }
		}
	}

	if (isSuccessful === false && userHasChangedCondition === true) {

		// If this is a ChatInputCommand, this is a reply, else this is an update to the message with the component
		const botReply = await respond(interaction, {
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(quid.color)
				.setTitle(`${quid2.name}'s condition changed before you healed them. Please try again.`)],
			components: quidsToHeal.length > 0 && quidsSelectMenuOptions.length > 0 ? [quidsSelectMenu] : [],
			fetchReply: true,
		}, 'update', interaction.isMessageComponent() ? interaction.message.id : undefined);

		saveCommandDisablingInfo(userToServer, interaction, interaction.channelId, botReply.id);
		return;
	}

	const medicineDen = await Den.findByPk(server.medicineDenId, { rejectOnEmpty: true });
	if (isSuccessful === true && isUnlucky(user2.id, user.id, quidToServer, medicineDen)) { isSuccessful = false; }

	const denCondition = await wearDownDen(server, CurrentRegionType.MedicineDen);
	let embedDescription: string;
	let statsUpdateText = '';

	if (isSuccessful === true) {

		const chosenUserPlus = getStatsPoints(item, quidToServer2);

		await quidToServer2.update({
			thirst: quidToServer2.thirst + chosenUserPlus.thirst,
			hunger: quidToServer2.hunger + chosenUserPlus.hunger,
			energy: quidToServer2.energy + chosenUserPlus.energy,
			health: quidToServer2.health + chosenUserPlus.health,
			injuries_wounds: quidToServer2.injuries_wounds,
			injuries_infections: quidToServer2.injuries_infections,
			injuries_cold: quidToServer2.injuries_cold,
			injuries_sprains: quidToServer2.injuries_sprains,
			injuries_poison: quidToServer2.injuries_poison,
		});

		if (chosenUserPlus.health > 0) { statsUpdateText += `\n+${chosenUserPlus.health} HP for ${quid2.name} (${quidToServer2.health}/${quidToServer2.maxHealth})${injuryUpdateText}`; }
		if (chosenUserPlus.energy > 0) { statsUpdateText += `\n+${chosenUserPlus.energy} energy for ${quid2.name} (${quidToServer2.energy}/${quidToServer2.maxEnergy})`; }
		if (chosenUserPlus.hunger > 0) { statsUpdateText += `\n+${chosenUserPlus.hunger} hunger for ${quid2.name} (${quidToServer2.hunger}/${quidToServer2.maxHunger})`; }
		if (chosenUserPlus.thirst > 0) { statsUpdateText += `\n+${chosenUserPlus.thirst} thirst for ${quid2.name} (${quidToServer2.thirst}/${quidToServer2.maxThirst})`; }

		if (item === 'water') {

			embedDescription = `*${quid.name} takes ${quid2.name}'s body, drags it over to the river, and positions ${pronoun(quid2, 2)} head right over the water. The ${getDisplayspecies(quid2)} sticks ${pronoun(quid2, 2)} tongue out and slowly starts drinking. Immediately you can observe how the newfound energy flows through ${pronoun(quid2, 2)} body.*`;
		}
		else if (quid.id === quid2.id) {

			embedDescription = `*${quid.name} takes a ${item}. After a bit of preparation, the ${getDisplayspecies(quid)} can apply it correctly. Immediately you can see the effect. ${capitalize(pronounAndPlural(quid, 0, 'feel'))} much better!*`;
		}
		else {

			embedDescription = `*${quid.name} takes a ${item}. After a bit of preparation, ${pronounAndPlural(quid, 0, 'give')} it to ${quid2.name}. Immediately you can see the effect. ${capitalize(pronounAndPlural(quid2, 0, 'feel'))} much better!*`;
		}
	}
	else if (item === 'water') {

		if (quid.id === quid2.id) {

			embedDescription = `*${quid.name} thinks about just drinking some water, but that won't help with ${pronoun(quid, 2)} issues...*`;
		}
		else if (quidToServer2.thirst > 0) {

			embedDescription = `*${quid2.name} looks at ${quid.name} with indignation.* "Being hydrated is really not my biggest problem right now!"`;
		}
		else {

			embedDescription = `*${quid.name} takes ${quid2.name}'s body and tries to drag it over to the river. The ${getDisplayspecies(quid)} attempts to position the ${getDisplayspecies(quid2)}'s head right over the water, but every attempt fails miserably. ${capitalize(pronounAndPlural(quid, 0, 'need'))} to concentrate and try again.*`;
		}
	}
	else if (quid.id === quid2.id) {

		embedDescription = `*${quid.name} holds the ${item} in ${pronoun(quid, 2)} mouth, trying to find a way to apply it. After a few attempts, the herb breaks into little pieces, rendering it useless. Guess ${pronounAndPlural(quid, 0, 'has', 'have')} to try again...*`;
	}
	else {

		embedDescription = `*${quid.name} takes a ${item}. After a bit of preparation, ${pronounAndPlural(quid, 0, 'give')} it to ${quid2.name}. But no matter how long ${pronoun(quid, 0)} wait, it does not seem to help. Looks like ${quid.name} has to try again...*`;
	}

	const experiencePoints = isSuccessful === false ? 0 : getRandomNumber(5, quidToServer.levels + 8);
	const changedCondition = await changeCondition(user.id === user2.id ? quidToServer2 : quidToServer, user.id === user2.id ? quid2 : quid, experiencePoints); // userToHeal is used here when a user is healing themselves to take into account the changes to the injuries & health
	const infectedEmbed = user.id !== user2.id ? await infectWithChance(quidToServer, quid, quidToServer2, quid2) : [];

	const members = await updateAndGetMembers(user.id, interaction.guild);
	const levelUpEmbed = await checkLevelUp(interaction, quid, quidToServer, members);

	const content = (user.id !== user2.id && isSuccessful === true ? `<@${discordUser2}>\n` : '') + messageContent;

	// This is always a reply
	const botReply = await respond(interaction, {
		content: content,
		embeds: [
			...embedArray,
			new EmbedBuilder()
				.setColor(quid.color)
				.setAuthor({
					name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
					iconURL: quid.avatarURL,
				})
				.setDescription(embedDescription)
				.setFooter({ text: `${changedCondition.statsUpdateText}${statsUpdateText === '' ? '' : `\n${statsUpdateText}`}\n\n${denCondition}${item !== 'water' ? `\n-1 ${item} for ${interaction.guild.name}` : ''}` }),
			...infectedEmbed,
			...changedCondition.injuryUpdateEmbed,
			...levelUpEmbed,
		],
		components: interaction.isMessageComponent() ? disableAllComponents(interaction.message.components) : [],
	});

	/* If the interaction is a message component, delete the message it comes from. Tries to delete it by getting the componentDisablingInteraction and calling the webhook.deleteMessage function, which saves an API call. As a backup, it will try to delete it by getting the message directly. */
	if (interaction.isMessageComponent()) {

		const disablingInteraction = componentDisablingInteractions.get(user.id + interaction.guildId);
		const fifteenMinutesInMs = 900_000;
		if (disablingInteraction !== undefined && userToServer.componentDisabling_messageId != null && SnowflakeUtil.timestampFrom(disablingInteraction.id) > Date.now() - fifteenMinutesInMs) {

			await disablingInteraction.webhook.deleteMessage(userToServer.componentDisabling_messageId)
				.catch(async error => {
					await interaction.message.delete();
					console.error(error);
				});
		}
		else { await interaction.message.delete(); }

		deleteCommandDisablingInfo(userToServer);
	}

	await isPassedOut(interaction, user, userToServer, quid, quidToServer, true);

	await restAdvice(interaction, user, quidToServer);
	await drinkAdvice(interaction, user, quidToServer);
	await eatAdvice(interaction, user, quidToServer);

	const channel = interaction.channel ?? await interaction.client.channels.fetch(interaction.channelId);
	if (channel === null || !channel.isTextBased()) { throw new TypeError('interaction.channel is null or not text based'); }
	if (user2.id !== user.id) { await addFriendshipPoints({ createdTimestamp: SnowflakeUtil.timestampFrom(botReply.id), channel: channel }, quid, quid2, { serverId: server.id, userToServer, quidToServer, user }); } // I have to call SnowflakeUtil since InteractionResponse wrongly misses the createdTimestamp which is hopefully added in the future

	return;
}

/**
 * It returns an object with the stats that will be added to the profile when the item is consumed
 * @param {CommonPlantNames | UncommonPlantNames | RarePlantNames | SpecialPlantNames | 'water'} item - The item that is being used.
 * @param {Profile} quidToServer2 - The profile that will be healed.
 * @returns An object with the keys: thirst, hunger, energy, health.
 */
export function getStatsPoints(
	item: CommonPlantNames | UncommonPlantNames | RarePlantNames | SpecialPlantNames | 'water',
	quidToServer2: QuidToServer,
): { health: number, energy: number, hunger: number, thirst: number; } {

	const thirst = item === 'water' ? Math.min(getRandomNumber(10, 6), quidToServer2.maxThirst - quidToServer2.thirst) : 0;
	const health = item === 'water' ? 0 : Math.min(getRandomNumber(10, 6), quidToServer2.maxHealth - quidToServer2.health);
	const energy = (item !== 'water' && itemInfo[item].givesEnergy) ? Math.min(30, quidToServer2.maxEnergy - quidToServer2.energy) : 0;
	const hunger = (item !== 'water' && itemInfo[item].edibility === PlantEdibilityType.Edible) ? Math.min(5, quidToServer2.maxHunger - quidToServer2.hunger) : 0;
	return { thirst, hunger, energy, health };
}

/**
 * It takes a message object and returns a number that represents the decreased success chance of a den
 */
function decreaseSuccessChance(
	medicineDen: Den,
): number {

	const denStats = medicineDen.structure + medicineDen.bedding + medicineDen.thickness + medicineDen.evenness;
	const multiplier = denStats / 400;
	return 20 - Math.round(20 * multiplier);
}

export function isUnlucky(
	injuredUserId: string,
	healingUserId: string,
	healingQuidToServer: QuidToServer,
	medicineDen: Den,
): boolean {
	return (
		injuredUserId === healingUserId &&
		pullFromWeightedTable({
			0: 75,
			1: 25 + healingQuidToServer.sapling_waterCycles - decreaseSuccessChance(medicineDen),
		}) === 0
	) ||
		(
			injuredUserId !== healingUserId &&
			(
				healingQuidToServer.rank === RankType.Apprentice ||
				healingQuidToServer.rank === RankType.Hunter
			) &&
			pullFromWeightedTable({
				0: healingQuidToServer.rank === RankType.Hunter ? 90 : 40,
				1: 60 + healingQuidToServer.sapling_waterCycles - decreaseSuccessChance(medicineDen),
			}) === 0
		);
}