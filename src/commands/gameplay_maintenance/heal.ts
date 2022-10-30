import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, RestOrArray, SelectMenuBuilder, SelectMenuComponentOptionData, SelectMenuInteraction, SlashCommandBuilder } from 'discord.js';
import Fuse from 'fuse.js';
import { commonPlantsInfo, rarePlantsInfo, specialPlantsInfo, uncommonPlantsInfo } from '../..';
import serverModel from '../../models/serverModel';
import userModel, { getUserData } from '../../models/userModel';
import { CommonPlantNames, Inventory, RarePlantNames, SpecialPlantNames, UncommonPlantNames } from '../../typings/data/general';
import { ServerSchema } from '../../typings/data/server';
import { CurrentRegionType, RankType, UserData } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { PlantEdibilityType } from '../../typings/main';
import { drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { changeCondition, infectWithChance } from '../../utils/changeCondition';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInteractable, isInvalid, isPassedOut } from '../../utils/checkValidity';
import { saveCommandDisablingInfo, disableAllComponents, deleteCommandDisablingInfo } from '../../utils/componentDisabling';
import { addFriendshipPoints } from '../../utils/friendshipHandling';
import getInventoryElements from '../../utils/getInventoryElements';
import { capitalizeString, getArrayElement, getMapData, getSmallerNumber, keyInObject, respond, unsafeKeys, update, widenValues } from '../../utils/helperFunctions';
import { checkLevelUp } from '../../utils/levelHandling';
import { missingPermissions } from '../../utils/permissionHandler';
import { getRandomNumber, pullFromWeightedTable } from '../../utils/randomizers';
import { wearDownDen } from '../../utils/wearDownDen';
import { remindOfAttack } from '../gameplay_primary/attack';

const itemInfo = { ...commonPlantsInfo, ...uncommonPlantsInfo, ...rarePlantsInfo, ...specialPlantsInfo };

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('heal')
		.setDescription('Heal injuries. Not available to Younglings. Less effective on yourself, and as Apprentice or Hunter.')
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
	sendAutocomplete: async (interaction, userData, serverData) => {

		if (!serverData) { return; }
		const focusedValue = interaction.options.getFocused();
		let choices: string[] = [];

		const inventory_ = widenValues(serverData.inventory);
		for (const itemType of unsafeKeys(inventory_)) {

			if (itemType === 'materials') { continue; }
			if (itemType === 'meat') { continue; }
			for (const item of unsafeKeys(inventory_[itemType])) {

				if (inventory_[itemType][item] > 0) { choices.push(item); }
			}
		}

		const fuse = new Fuse(choices);
		if (focusedValue.length > 0) { choices = fuse.search(focusedValue).map(value => value.item); }

		await interaction.respond(
			choices.slice(0, 25).map(choice => ({ name: choice, value: choice })),
		);
	},
	sendCommand: async (interaction, userData, serverData) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(userData, interaction)) { return; }

		/* Checks if the profile is resting, on a cooldown or passed out. */
		const restEmbed = await isInvalid(interaction, userData);
		if (restEmbed === false) { return; }

		const messageContent = remindOfAttack(interaction.guildId);

		if (userData.quid.profile.rank === RankType.Youngling) {

			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(userData.quid.color)
					.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
					.setDescription(`*A healer rushes into the medicine den in fury.*\n"${userData.quid.name}, you are not trained to heal yourself, and especially not to heal others! I don't ever wanna see you again in here without supervision!"\n*${userData.quid.name} lowers ${userData.quid.pronoun(2)} head and leaves in shame.*`)],
			}, true);
			return;
		}

		// Make a function that makes a message for you. If you give it a valid user or quid, it will give you the problems the user has + a list of herbs. if you give it a page (1 | 2), it will give you a list of herbs from that page. If you give it an available herb as well, it will check whether there was an existing message where a problem was mentioned that the user already not has anymore (in which case it will refresh the info and tell the user to pick again) and if not, apply the herb.
		const chosenUser = interaction.options.getUser('user');
		const _chosenUserData = !chosenUser ? null : (await userModel.findOne(u => u.userId.includes(chosenUser.id)).catch(() => null));
		const chosenUserData = _chosenUserData === null ? undefined : getUserData(_chosenUserData, interaction.guildId, _chosenUserData.quids[_chosenUserData.servers[interaction.guildId]?.currentQuid ?? '']);
		if (chosenUserData && !isInteractable(interaction, chosenUserData, messageContent, restEmbed)) { return; }

		let chosenItem = interaction.options.getString('item') ?? undefined;
		if (!chosenItem || !stringIsAvailableItem(chosenItem, serverData.inventory)) { chosenItem = undefined; }

		await getHealResponse(interaction, userData, serverData, messageContent, restEmbed, 0, chosenUserData, 1, chosenItem);
	},
	async sendMessageComponentResponse(interaction, userData, serverData) {

		/* This ensures that the user is in a guild and has a completed account. */
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(userData, interaction)) { return; }

		if (interaction.isSelectMenu() && interaction.customId.startsWith('heal_quids_options')) {

			const value = getArrayElement(interaction.values, 0);
			if (value.startsWith('newpage_')) {

				const page = Number(value.replace('newpage_', ''));
				if (isNaN(page)) { throw new TypeError('page is NaN'); }

				await getHealResponse(interaction, userData, serverData, '', [], page);
			}
			else {

				const _userToHeal = await userModel.findOne(u => Object.keys(u.quids).includes(value));
				const userToHeal = getUserData(_userToHeal, interaction.guildId, getMapData(_userToHeal.quids, value));

				await getHealResponse(interaction, userData, serverData, '', [], 0, userToHeal);
			}
		}
		else if (interaction.customId.startsWith('heal_page_')) {

			const inventoryPage = Number(getArrayElement(interaction.customId.split('_'), 2));
			if (isNaN(inventoryPage)) { throw new TypeError('inventoryPage is NaN'); }
			if (inventoryPage !== 1 && inventoryPage !== 2) { throw new TypeError('inventoryPage is not 1 or 2'); }
			const quidId = getArrayElement(interaction.customId.split('_'), 3);

			const _userToHeal = await userModel.findOne(u => Object.keys(u.quids).includes(quidId));
			const userToHeal = getUserData(_userToHeal, interaction.guildId, getMapData(_userToHeal.quids, quidId));

			await getHealResponse(interaction, userData, serverData, '', [], 0, userToHeal, inventoryPage);
		}
		else if (interaction.isSelectMenu() && interaction.customId.startsWith('heal_inventory_options_')) {

			const quidId = getArrayElement(interaction.customId.split('_'), 3);
			if (quidId === undefined) { throw new TypeError('quidId is undefined'); }

			const _userToHeal = await userModel.findOne(u => Object.keys(u.quids).includes(quidId));
			const userToHeal = getUserData(_userToHeal, interaction.guildId, getMapData(_userToHeal.quids, quidId));

			let chosenItem = interaction.values[0];
			if (!chosenItem || !stringIsAvailableItem(chosenItem, serverData.inventory)) { chosenItem = undefined; }

			await getHealResponse(interaction, userData, serverData, '', [], 0, userToHeal, 1, chosenItem);
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
	u: UserData<undefined, ''>,
	checkOnlyFor?: 'energy' | 'hunger' | 'wounds' | 'infections' | 'cold' | 'sprains' | 'poison',
): u is UserData<never, never> {

	return hasNameAndSpecies(u)
		&& (
			((checkOnlyFor === undefined || checkOnlyFor === 'energy') && u.quid.profile.energy === 0)
			|| (checkOnlyFor === undefined && u.quid.profile.health === 0)
			|| ((checkOnlyFor === undefined || checkOnlyFor === 'hunger') && u.quid.profile.hunger === 0)
			|| (checkOnlyFor === undefined && u.quid.profile.thirst === 0)
			|| ((checkOnlyFor === undefined || checkOnlyFor === 'wounds') && u.quid.profile.injuries.wounds > 0)
			|| ((checkOnlyFor === undefined || checkOnlyFor === 'infections') && u.quid.profile.injuries.infections > 0)
			|| ((checkOnlyFor === undefined || checkOnlyFor === 'cold') && u.quid.profile.injuries.cold === true)
			|| ((checkOnlyFor === undefined || checkOnlyFor === 'sprains') && u.quid.profile.injuries.sprains > 0)
			|| ((checkOnlyFor === undefined || checkOnlyFor === 'poison') && u.quid.profile.injuries.poison === true)
		);
}

/** This function is used to make item-string equal to undefined in getHealResponse if the string isn't a herb/water that is also available */
function stringIsAvailableItem(
	string: string,
	inventory: Inventory,
): string is CommonPlantNames | UncommonPlantNames | RarePlantNames | SpecialPlantNames | 'water' {

	return (
		(keyInObject(inventory.commonPlants, string) && inventory.commonPlants[string] > 0)
		|| (keyInObject(inventory.uncommonPlants, string) && inventory.uncommonPlants[string] > 0)
		|| (keyInObject(inventory.rarePlants, string) && inventory.rarePlants[string] > 0)
		|| (keyInObject(inventory.specialPlants, string) && inventory.specialPlants[string] > 0)
		|| string === 'water'
	);
}

export async function getHealResponse(
	interaction: ChatInputCommandInteraction<'cached'> | SelectMenuInteraction<'cached'> | ButtonInteraction<'cached'>,
	userData: UserData<never, never>,
	serverData: ServerSchema,
	messageContent: string,
	embedArray: EmbedBuilder[],
	quidPage = 0,
	userToHeal?: UserData<never, ''> | null,
	inventoryPage: 1 | 2 = 1,
	item?: CommonPlantNames | UncommonPlantNames | RarePlantNames | SpecialPlantNames | 'water',
): Promise<void> {

	if (await missingPermissions(interaction, [
		'ViewChannel', // Needed because of createCommandComponentDisabler
		/* 'ViewChannel',*/ interaction.channel?.isThread() ? 'SendMessagesInThreads' : 'SendMessages', 'EmbedLinks', // Needed for channel.send call in addFriendshipPoints
	]) === true) { return; }

	const hurtQuids = await (async function(
	): Promise<UserData<never, never>[]> {

		const users = (await userModel.find()).map(u => Object.values(u.quids).map(q => getUserData(u, interaction.guildId, u.quids[q._id]))).flat();
		return users.filter((u): u is UserData<never, never> => quidNeedsHealing(u));
	})();

	let quidsSelectMenuOptions: RestOrArray<SelectMenuComponentOptionData> = hurtQuids.map(u => ({ label: u.quid.name, value: u.quid._id }));
	if (quidsSelectMenuOptions.length > 25) {

		const totalQuidPages = Math.ceil(quidsSelectMenuOptions.length / 24);
		quidsSelectMenuOptions = quidsSelectMenuOptions.splice(quidPage * 24, 24);

		const newQuidPage = 1 + quidPage >= totalQuidPages ? 0 : quidPage;
		quidsSelectMenuOptions.push({ label: 'Show more user options', value: `newpage_${newQuidPage}`, description: `You are currently on page ${quidPage + 1}`, emoji: '📋' });
	}

	const quidsSelectMenu = new ActionRowBuilder<SelectMenuBuilder>()
		.setComponents(new SelectMenuBuilder()
			.setCustomId(`heal_quids_options_@${userData._id}`)
			.setPlaceholder('Select a quid to heal')
			.setOptions(quidsSelectMenuOptions));

	if (!hasNameAndSpecies(userToHeal)) {

		const botReply = await (async function(messageObject) { return interaction.isMessageComponent() ? await update(interaction, messageObject) : await respond(interaction, messageObject, true); })({
			content: messageContent,
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(userData.quid.color)
				.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
				.setDescription(`*${userData.quid.name} sits in front of the medicine den, looking if anyone needs help with injuries or illnesses.*`)
				.setFooter({ text: 'Tip: Healing yourself has a lower chance of being successful than healing others. Healers and Elderlies are more often successful than Apprentices and Hunters.' })],
			components: hurtQuids.length > 0 && quidsSelectMenuOptions.length > 0 ? [quidsSelectMenu] : [],
		});

		saveCommandDisablingInfo(userData, interaction.guildId, interaction.channelId, botReply.id);
		return;
	}

	if (!item) {

		const pagesButtons = new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(`heal_page_1_${userToHeal.quid._id}_@${userData._id}`)
				.setLabel('Page 1')
				.setEmoji('🌱')
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId(`heal_page_2_${userToHeal.quid._id}_@${userData._id}`)
				.setLabel('Page 2')
				.setEmoji('🍀')
				.setStyle(ButtonStyle.Secondary)]);

		let healUserConditionText = '';

		healUserConditionText += (userToHeal.quid.profile.health <= 0) ? '\nHealth: 0' : '';
		healUserConditionText += (userToHeal.quid.profile.energy <= 0) ? '\nEnergy: 0' : '';
		healUserConditionText += (userToHeal.quid.profile.hunger <= 0) ? '\nHunger: 0' : '';
		healUserConditionText += (userToHeal.quid.profile.thirst <= 0) ? '\nThirst: 0' : '';
		healUserConditionText += (userToHeal.quid.profile.injuries.wounds > 0) ? `\nWounds: ${userToHeal.quid.profile.injuries.wounds}` : '';
		healUserConditionText += (userToHeal.quid.profile.injuries.infections > 0) ? `\nInfections: ${userToHeal.quid.profile.injuries.infections}` : '';
		healUserConditionText += (userToHeal.quid.profile.injuries.cold == true) ? '\nCold: yes' : '';
		healUserConditionText += (userToHeal.quid.profile.injuries.sprains > 0) ? `\nSprains: ${userToHeal.quid.profile.injuries.sprains}` : '';
		healUserConditionText += (userToHeal.quid.profile.injuries.poison == true) ? '\nPoison: yes' : '';

		if (healUserConditionText === '') {

			const botReply = await (async function(messageObject) { return interaction.isMessageComponent() ? await update(interaction, messageObject) : await respond(interaction, messageObject, true); })({
				content: messageContent,
				embeds: [...embedArray, new EmbedBuilder()
					.setColor(userData.quid.color)
					.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
					.setDescription(`*${userData.quid.name} approaches ${userToHeal.quid.name}, desperately searching for someone to help.*\n"Do you have any injuries or illnesses you know of?" *the ${userData.quid.getDisplayspecies()} asks.\n${userToHeal.quid.name} shakes ${userToHeal.quid.pronoun(2)} head.* "Not that I know of, no."\n*Disappointed, ${userData.quid.name} goes back to the medicine den.*`)],
				components: hurtQuids.length > 0 && quidsSelectMenuOptions.length > 0 ? [quidsSelectMenu] : [],
			});

			saveCommandDisablingInfo(userData, interaction.guildId, interaction.channelId, botReply.id);
			return;
		}

		const quidConditionEmbed = new EmbedBuilder()
			.setColor(userData.quid.color)
			.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
			.setDescription(userToHeal._id === userData._id
				? `*${userToHeal.quid.name} pushes aside the leaves acting as the entrance to the healer's den. With tired eyes ${userToHeal.quid.pronounAndPlural(0, 'inspect')} the rows of herbs, hoping to find one that can ease ${userToHeal.quid.pronoun(2)} pain.*`
				: userToHeal.quid.profile.energy <= 0 || userToHeal.quid.profile.health <= 0 || userToHeal.quid.profile.hunger <= 0 || userToHeal.quid.profile.thirst <= 0
					? `*${userData.quid.name} runs towards the pack borders, where ${userToHeal.quid.name} lies, only barely conscious. The ${userData.quid.profile.rank} immediately looks for the right herbs to help the ${userToHeal.quid.getDisplayspecies()}.*`
					: `*${userToHeal.quid.name} enters the medicine den with tired eyes.* "Please help me!" *${userToHeal.quid.pronounAndPlural(0, 'say')}, ${userToHeal.quid.pronoun(2)} face contorted in pain. ${userData.quid.name} looks up with worry.* "I'll see what I can do for you."`)
			.setFooter({ text: `${userToHeal.quid.name}'s condition:${healUserConditionText}` });

		let { embedDescription, selectMenuOptions } = getInventoryElements(serverData.inventory, inventoryPage);
		if (inventoryPage === 2) {

			embedDescription = `**water** - Found lots and lots of in the river that flows through the pack!\n${embedDescription}`;
			selectMenuOptions.unshift({ label: 'water', value: 'water' });
		}

		const inventoryEmbed = new EmbedBuilder()
			.setColor(userData.quid.color)
			.setTitle(`Inventory of ${interaction.guild.name} - Page ${inventoryPage}`)
			.setDescription(embedDescription);
		const inventorySelectMenu = new ActionRowBuilder<SelectMenuBuilder>()
			.setComponents(new SelectMenuBuilder()
				.setCustomId(`heal_inventory_options_${userToHeal.quid._id}_@${userData._id}`)
				.setPlaceholder('Select an item')
				.setOptions(selectMenuOptions));

		const botReply = await (async function(messageObject) { return interaction.isMessageComponent() ? await update(interaction, messageObject) : await respond(interaction, messageObject, true); })({
			content: messageContent,
			embeds: [...embedArray, quidConditionEmbed, inventoryEmbed],
			components: [quidsSelectMenu, pagesButtons, inventorySelectMenu],
		});

		saveCommandDisablingInfo(userData, interaction.guildId, interaction.channelId, botReply.id);
		return;
	}

	// This part of the code is only executed if a herb has been given

	if (!hurtQuids.some(quid => quid._id === userToHeal!.quid._id)) {

		const botReply = await (async function(messageObject) { return interaction.isMessageComponent() ? await update(interaction, messageObject) : await respond(interaction, messageObject, true); })({
			content: messageContent,
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(userData.quid.color)
				.setTitle(`${userToHeal.quid.name} doesn't need to be healed anymore. Please select another quid to heal if available.`)],
			components: hurtQuids.length > 0 && quidsSelectMenuOptions.length > 0 ? [quidsSelectMenu] : [],
		});

		saveCommandDisablingInfo(userData, interaction.guildId, interaction.channelId, botReply.id);
		return;
	}

	const userCondition = interaction.isMessageComponent() ? interaction.message.embeds[interaction.message.embeds.length - 2]?.footer?.text.toLowerCase() : undefined;
	let userHasChangedCondition = false;
	let isSuccessful = false;

	let injuryUpdateText = '';

	if (item === 'water') {

		if (userToHeal.quid.profile.thirst <= 0) { isSuccessful = true; }
		else if (userCondition?.includes('thirst')) { userHasChangedCondition = true; }
	}
	else {

		if (keyInObject(serverData.inventory.commonPlants, item)) { serverData.inventory.commonPlants[item] -= 1; }
		else if (keyInObject(serverData.inventory.uncommonPlants, item)) { serverData.inventory.uncommonPlants[item] -= 1; }
		else if (keyInObject(serverData.inventory.rarePlants, item)) { serverData.inventory.rarePlants[item] -= 1; }
		else if (keyInObject(serverData.inventory.specialPlants, item)) { serverData.inventory.specialPlants[item] -= 1; }
		else { throw new Error('item does not exist in serverData.inventory'); }
		serverData = await serverModel.update(
			serverData,
			(s) => { s.inventory = serverData.inventory; },
		);

		if (itemInfo[item].edibility === PlantEdibilityType.Edible) {

			if (userToHeal.quid.profile.hunger <= 0) { isSuccessful = true; }
			else if (userCondition?.includes('hunger')) { userHasChangedCondition = true; }
		}

		if (userToHeal.quid.profile.health <= 0) { isSuccessful = true; }
		else if (userCondition?.includes('health')) { userHasChangedCondition = true; }

		if (itemInfo[item].healsWounds) {

			if (userToHeal.quid.profile.injuries.wounds > 0) {

				isSuccessful = true;
				injuryUpdateText += `\n-1 wound for ${userToHeal.quid.name}`;
				userToHeal.quid.profile.injuries.wounds -= 1;
			}
			else if (userCondition?.includes('wounds')) { userHasChangedCondition = true; }
		}

		if (itemInfo[item].healsInfections) {

			if (userToHeal.quid.profile.injuries.infections > 0) {

				isSuccessful = true;
				injuryUpdateText += `\n-1 infection for ${userToHeal.quid.name}`;
				userToHeal.quid.profile.injuries.infections -= 1;
			}
			else if (userCondition?.includes('infections')) { userHasChangedCondition = true; }
		}

		if (itemInfo[item].healsColds) {

			if (userToHeal.quid.profile.injuries.cold == true) {

				isSuccessful = true;
				injuryUpdateText += `\ncold healed for ${userToHeal.quid.name}`;
				userToHeal.quid.profile.injuries.cold = false;
			}
			else if (userCondition?.includes('cold')) { userHasChangedCondition = true; }
		}

		if (itemInfo[item].healsSprains) {

			if (userToHeal.quid.profile.injuries.sprains > 0) {

				isSuccessful = true;
				injuryUpdateText += `\n-1 sprain for ${userToHeal.quid.name}`;
				userToHeal.quid.profile.injuries.sprains -= 1;
			}
			else if (userCondition?.includes('sprains')) { userHasChangedCondition = true; }
		}

		if (itemInfo[item].healsPoison) {

			if (userToHeal.quid.profile.injuries.poison == true) {

				isSuccessful = true;
				injuryUpdateText += `\npoison healed for ${userToHeal.quid.name}`;
				userToHeal.quid.profile.injuries.poison = false;
			}
			else if (userCondition?.includes('poison')) { userHasChangedCondition = true; }
		}

		if (itemInfo[item].givesEnergy) {

			if (userToHeal.quid.profile.energy <= 0) { isSuccessful = true; }
		}
	}

	if (isSuccessful === false && userHasChangedCondition === true) {

		const botReply = await (async function(messageObject) { return interaction.isMessageComponent() ? await update(interaction, messageObject) : await respond(interaction, messageObject, true); })({
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(userData.quid.color)
				.setTitle(`${userToHeal.quid.name}'s condition changed before you healed them. Please try again.`)],
			components: hurtQuids.length > 0 && quidsSelectMenuOptions.length > 0 ? [quidsSelectMenu] : [],
		});

		saveCommandDisablingInfo(userData, interaction.guildId, interaction.channelId, botReply.id);
		return;
	}

	if (isSuccessful === true && isUnlucky(userToHeal, userData, serverData)) { isSuccessful = false; }

	const denCondition = await wearDownDen(serverData, CurrentRegionType.MedicineDen);
	let embedDescription: string;
	let statsUpdateText = '';

	if (isSuccessful === true) {

		const chosenUserPlus = getStatsPoints(item, userToHeal);

		await userToHeal.update(
			(u) => {
				const p = getMapData(getMapData(u.quids, userToHeal.quid._id).profiles, interaction.guildId);
				p.thirst += chosenUserPlus.thirst;
				p.hunger += chosenUserPlus.hunger;
				p.energy += chosenUserPlus.energy;
				p.health += chosenUserPlus.health;
				p.injuries = userToHeal.quid.profile.injuries;
			},
		);

		if (chosenUserPlus.health > 0) { statsUpdateText += `\n+${chosenUserPlus.health} HP for ${userToHeal.quid.name} (${userToHeal.quid.profile.health}/${userToHeal.quid.profile.maxHealth})${injuryUpdateText}`; }
		if (chosenUserPlus.energy > 0) { statsUpdateText += `\n+${chosenUserPlus.energy} energy for ${userToHeal.quid.name} (${userToHeal.quid.profile.energy}/${userToHeal.quid.profile.maxEnergy})`; }
		if (chosenUserPlus.hunger > 0) { statsUpdateText += `\n+${chosenUserPlus.hunger} hunger for ${userToHeal.quid.name} (${userToHeal.quid.profile.hunger}/${userToHeal.quid.profile.maxHunger})`; }
		if (chosenUserPlus.thirst > 0) { statsUpdateText += `\n+${chosenUserPlus.thirst} thirst for ${userToHeal.quid.name} (${userToHeal.quid.profile.thirst}/${userToHeal.quid.profile.maxThirst})`; }

		if (item === 'water') {

			embedDescription = `*${userData.quid.name} takes ${userToHeal.quid.name}'s body, drags it over to the river, and positions ${userToHeal.quid.pronoun(2)} head right over the water. The ${userToHeal.quid.getDisplayspecies()} sticks ${userToHeal.quid.pronoun(2)} tongue out and slowly starts drinking. Immediately you can observe how the newfound energy flows through ${userToHeal.quid.pronoun(2)} body.*`;
		}
		else if (userData.quid._id === userToHeal.quid._id) {

			embedDescription = `*${userData.quid.name} takes a ${item}. After a bit of preparation, the ${userData.quid.getDisplayspecies()} can apply it correctly. Immediately you can see the effect. ${capitalizeString(userData.quid.pronounAndPlural(0, 'feel'))} much better!*`;
		}
		else {

			embedDescription = `*${userData.quid.name} takes a ${item}. After a bit of preparation, ${userData.quid.pronounAndPlural(0, 'give')} it to ${userToHeal.quid.name}. Immediately you can see the effect. ${capitalizeString(userToHeal.quid.pronounAndPlural(0, 'feel'))} much better!*`;
		}
	}
	else if (item === 'water') {

		if (userData.quid._id === userToHeal.quid._id) {

			embedDescription = `*${userData.quid.name} thinks about just drinking some water, but that won't help with ${userData.quid.pronoun(2)} issues...*`;
		}
		else if (userToHeal.quid.profile.thirst > 0) {

			embedDescription = `*${userToHeal.quid.name} looks at ${userData.quid.name} with indignation.* "Being hydrated is really not my biggest problem right now!"`;
		}
		else {

			embedDescription = `*${userData.quid.name} takes ${userToHeal.quid.name}'s body and tries to drag it over to the river. The ${userData.quid.getDisplayspecies()} attempts to position the ${userToHeal.quid.getDisplayspecies()}'s head right over the water, but every attempt fails miserably. ${capitalizeString(userData.quid.pronounAndPlural(0, 'need'))} to concentrate and try again.*`;
		}
	}
	else if (userData.quid._id === userToHeal.quid._id) {

		embedDescription = `*${userData.quid.name} holds the ${item} in ${userData.quid.pronoun(2)} mouth, trying to find a way to apply it. After a few attempts, the herb breaks into little pieces, rendering it useless. Guess ${userData.quid.pronounAndPlural(0, 'has', 'have')} to try again...*`;
	}
	else {

		embedDescription = `*${userData.quid.name} takes a ${item}. After a bit of preparation, ${userData.quid.pronounAndPlural(0, 'give')} it to ${userToHeal.quid.name}. But no matter how long ${userData.quid.pronoun(0)} wait, it does not seem to help. Looks like ${userData.quid.name} has to try again...*`;
	}

	const experiencePoints = isSuccessful === false ? 0 : userData.quid.profile.rank == RankType.Elderly ? getRandomNumber(41, 20) : userData.quid.profile.rank == RankType.Healer ? getRandomNumber(21, 10) : getRandomNumber(11, 5);
	const changedCondition = await changeCondition(userData, experiencePoints);
	const infectedEmbed = await infectWithChance(userData, userToHeal);
	const levelUpEmbed = await checkLevelUp(interaction, userData, serverData);

	const content = (userData._id !== userToHeal._id && isSuccessful === true ? `<@${userToHeal.userId[0]}>\n` : '') + messageContent;

	if (interaction.isMessageComponent()) {

		deleteCommandDisablingInfo(userData, interaction.guildId);
		await interaction.message.delete();
	}

	const botReply = await respond(interaction, {
		content: content,
		embeds: [
			...embedArray,
			new EmbedBuilder()
				.setColor(userData.quid.color)
				.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
				.setDescription(embedDescription)
				.setFooter({ text: `${changedCondition.statsUpdateText}${statsUpdateText === '' ? '' : `\n${statsUpdateText}`}\n\n${denCondition}${item !== 'water' ? `\n-1 ${item} for ${interaction.guild.name}` : ''}` }),
			...infectedEmbed,
			...changedCondition.injuryUpdateEmbed,
			...levelUpEmbed,
		],
		components: interaction.isMessageComponent() ? disableAllComponents(interaction.message.components) : [],
	}, true);

	await isPassedOut(interaction, userData, true);

	await restAdvice(interaction, userData);
	await drinkAdvice(interaction, userData);
	await eatAdvice(interaction, userData);

	if (userToHeal._id !== userData._id) { await addFriendshipPoints(botReply, userData, userToHeal); }

	return;
}

/**
 * It returns an object with the stats that will be added to the profile when the item is consumed
 * @param {CommonPlantNames | UncommonPlantNames | RarePlantNames | SpecialPlantNames | 'water'} item - The item that is being used.
 * @param {Profile} userToHeal.quid.profile - The profile that will be healed.
 * @returns An object with the keys: thirst, hunger, energy, health.
 */
export function getStatsPoints(
	item: CommonPlantNames | UncommonPlantNames | RarePlantNames | SpecialPlantNames | 'water',
	userToHeal: UserData<never, never>,
): { health: number, energy: number, hunger: number, thirst: number; } {

	const thirst = item === 'water' ? getSmallerNumber(getRandomNumber(10, 6), userToHeal.quid.profile.maxThirst - userToHeal.quid.profile.thirst) : 0;
	const health = item === 'water' ? 0 : getSmallerNumber(getRandomNumber(10, 6), userToHeal.quid.profile.maxHealth - userToHeal.quid.profile.health);
	const energy = (item !== 'water' && itemInfo[item].givesEnergy) ? getSmallerNumber(30, userToHeal.quid.profile.maxEnergy - userToHeal.quid.profile.energy) : 0;
	const hunger = (item !== 'water' && itemInfo[item].givesEnergy) ? getSmallerNumber(5, userToHeal.quid.profile.maxHunger - userToHeal.quid.profile.hunger) : 0;
	return { thirst, hunger, energy, health };
}

/**
 * It takes a message object and returns a number that represents the decreased success chance of a den
 */
function decreaseSuccessChance(
	serverData: ServerSchema,
): number {

	const denStats = serverData.dens.medicineDen.structure + serverData.dens.medicineDen.bedding + serverData.dens.medicineDen.thickness + serverData.dens.medicineDen.evenness;
	const multiplier = denStats / 400;
	return 20 - Math.round(20 * multiplier);
}

export function isUnlucky(
	userToHeal: UserData<never, never>,
	userData: UserData<never, never>,
	serverData: ServerSchema,
): boolean { return (userToHeal._id === userData._id && pullFromWeightedTable({ 0: 75, 1: 25 + userData.quid.profile.sapling.waterCycles - decreaseSuccessChance(serverData) }) === 0) || (userToHeal._id !== userData._id && (userData.quid.profile.rank === RankType.Apprentice || userData.quid.profile.rank === RankType.Hunter) && pullFromWeightedTable({ 0: userData.quid.profile.rank === RankType.Hunter ? 90 : 40, 1: 60 + userData.quid.profile.sapling.waterCycles - decreaseSuccessChance(serverData) }) === 0); }