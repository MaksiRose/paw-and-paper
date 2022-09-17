import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, MessageComponentInteraction, RestOrArray, SelectMenuBuilder, SelectMenuComponentOptionData, SlashCommandBuilder } from 'discord.js';
import Fuse from 'fuse.js';
import serverModel from '../../models/serverModel';
import userModel from '../../models/userModel';
import { CommonPlantNames, commonPlantsInfo, CurrentRegionType, Inventory, PlantEdibilityType, Quid, RankType, RarePlantNames, rarePlantsInfo, ServerSchema, SlashCommand, SpecialPlantNames, specialPlantsInfo, SpeciesDietType, speciesInfo, SpeciesNames, UncommonPlantNames, uncommonPlantsInfo, UserSchema } from '../../typedef';
import { drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { changeCondition, infectWithChance } from '../../utils/changeCondition';
import { hasCompletedAccount, isInGuild } from '../../utils/checkUserState';
import { isInvalid, isPassedOut } from '../../utils/checkValidity';
import { createCommandComponentDisabler, disableAllComponents } from '../../utils/componentDisabling';
import { addFriendshipPoints } from '../../utils/friendshipHandling';
import getInventoryElements from '../../utils/getInventoryElements';
import { pronoun, pronounAndPlural, upperCasePronounAndPlural } from '../../utils/getPronouns';
import { getMapData, getSmallerNumber, keyInObject, respond, unsafeKeys, update, widenValues } from '../../utils/helperFunctions';
import { checkLevelUp } from '../../utils/levelHandling';
import { getRandomNumber, pullFromWeightedTable } from '../../utils/randomizers';
import wearDownDen from '../../utils/wearDownDen';
import { remindOfAttack } from '../gameplay_primary/attack';

const name: SlashCommand['name'] = 'heal';
const description: SlashCommand['description'] = 'Heal your packmates. Costs energy, but gives XP.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
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
	disablePreviousCommand: true,
	sendAutocomplete: async (client, interaction, userData, serverData) => {

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
	sendCommand: async (client, interaction, userData, serverData, embedArray) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (!isInGuild(interaction)) { return; }
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!hasCompletedAccount(interaction, userData)) { return; }

		/* Gets the current active quid and the server profile from the account */
		const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId));
		const profileData = getMapData(quidData.profiles, interaction.guildId);

		/* Checks if the profile is resting, on a cooldown or passed out. */
		if (await isInvalid(interaction, userData, quidData, profileData, embedArray)) { return; }

		const messageContent = remindOfAttack(interaction.guildId);

		if (profileData.rank === RankType.Youngling) {

			await respond(interaction, {
				content: messageContent,
				embeds: [...embedArray, new EmbedBuilder()
					.setColor(quidData.color)
					.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL })
					.setDescription(`*A healer rushes into the medicine den in fury.*\n"${quidData.name}, you are not trained to heal yourself, and especially not to heal others! I don't ever wanna see you again in here without supervision!"\n*${quidData.name} lowers ${pronoun(quidData, 2)} head and leaves in shame.*`)],
			}, true)
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		// Make a function that makes a message for you. If you give it a valid user or quid, it will give you the problems the user has + a list of herbs. if you give it a page (1 | 2), it will give you a list of herbs from that page. If you give it an available herb as well, it will check whether there was an existing message where a problem was mentioned that the user already not has anymore (in which case it will refresh the info and tell the user to pick again) and if not, apply the herb.
		const chosenUser = interaction.options.getUser('user');
		const chosenUserData = !chosenUser ? undefined : await userModel.findOne(u => u.userId.includes(chosenUser.id)).catch(() => { return undefined; });
		const quidToHeal = !chosenUserData ? undefined : Object
			.values(chosenUserData.quids)
			.filter(q => {
				const p = q.profiles[interaction.guildId];
				return p && (p.energy === 0 || p.health === 0 || p.hunger === 0 || p.thirst === 0 || Object.values(p.injuries).filter(i => i > 0).length > 0);
			})[0];

		let chosenItem = interaction.options.getString('item') ?? undefined;
		if (!chosenItem || !stringIsAvailableItem(chosenItem, serverData.inventory)) { chosenItem = undefined; }

		await getHealResponse(interaction, userData, serverData, messageContent, embedArray, 0, quidToHeal, 1, chosenItem);
	},
};

export async function healInteractionCollector(
	interaction: MessageComponentInteraction,
	userData: UserSchema | null,
	serverData: ServerSchema | null,
): Promise<void> {

	if (!interaction.inCachedGuild()) { throw new Error('Interaction is not in cached guild'); }
	if (serverData === null) { throw new TypeError('serverData is null'); }
	if (userData === null) { throw new TypeError('userData is null'); }

	if (interaction.isSelectMenu() && interaction.customId === 'heal_quids_options') {

		const value = interaction.values[0];
		if (value === undefined) { throw new TypeError('value is undefined'); }

		if (value.startsWith('newpage_')) {

			const page = Number(value.replace('newpage_', ''));
			if (isNaN(page)) { throw new TypeError('page is NaN'); }

			await getHealResponse(interaction, userData, serverData, null, [], page);
		}
		else {

			const quidToHeal = getMapData((await userModel.findOne(u => Object.keys(u.quids).includes(value))).quids, value);
			await getHealResponse(interaction, userData, serverData, null, [], 0, quidToHeal);
		}
	}
	else if (interaction.customId.startsWith('heal_page_')) {

		const inventoryPage = Number(interaction.customId.split('_')[2]);
		if (isNaN(inventoryPage)) { throw new TypeError('inventoryPage is NaN'); }
		if (inventoryPage !== 1 && inventoryPage !== 2) { throw new TypeError('inventoryPage is not 1 or 2'); }
		const quidId = interaction.customId.split('_')[2];
		if (quidId === undefined) { throw new TypeError('quidId is undefined'); }

		const quidToHeal = getMapData((await userModel.findOne(u => Object.keys(u.quids).includes(quidId))).quids, quidId);
		await getHealResponse(interaction, userData, serverData, null, [], 0, quidToHeal, inventoryPage);
	}
	else if (interaction.isSelectMenu() && interaction.customId.startsWith('heal_inventory_options_')) {

		const quidId = interaction.customId.replace('heal_inventory_options_', '');
		if (quidId === undefined) { throw new TypeError('quidId is undefined'); }

		const quidToHeal = getMapData((await userModel.findOne(u => Object.keys(u.quids).includes(quidId))).quids, quidId);

		let chosenItem = interaction.values[0];
		if (!chosenItem || !stringIsAvailableItem(chosenItem, serverData.inventory)) { chosenItem = undefined; }

		await getHealResponse(interaction, userData, serverData, null, [], 0, quidToHeal, 1, chosenItem);
	}
}

async function getHurtQuids(
	guildId: string,
): Promise<Quid[]> {

	return (await userModel
		.find(
			(u) => {
				const thisServerProfiles = Object.values(u.quids).filter(q => q.profiles[guildId] !== undefined).map(q => getMapData(q.profiles, guildId));
				return thisServerProfiles.filter(p => {
					return p.energy === 0 || p.health === 0 || p.hunger === 0 || p.thirst === 0 || Object.values(p.injuries).filter(i => i > 0).length > 0;
				}).length > 0;
			}))
		.map(user => Object.values(user.quids))
		.flat();
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
	interaction: ChatInputCommandInteraction<'cached'> | MessageComponentInteraction<'cached'>,
	userData: UserSchema,
	serverData: ServerSchema,
	messageContent: string | null,
	embedArray: EmbedBuilder[],
	quidPage = 0,
	quidToHeal?: Quid,
	inventoryPage: 1 | 2 = 1,
	item?: CommonPlantNames | UncommonPlantNames | RarePlantNames | SpecialPlantNames | 'water',
): Promise<void> {

	/* Gets the current active quid and the server profile from the account */
	const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId));
	const profileData = getMapData(quidData.profiles, interaction.guildId);

	const hurtQuids = await getHurtQuids(interaction.guildId);

	let quidsSelectMenuOptions: RestOrArray<SelectMenuComponentOptionData> = hurtQuids.map(quid => ({ label: quid.name, value: quid._id }));
	if (quidsSelectMenuOptions.length > 25) {

		const totalQuidPages = Math.ceil(quidsSelectMenuOptions.length / 24);
		quidsSelectMenuOptions = quidsSelectMenuOptions.splice(quidPage * 24, 24);

		const newQuidPage = 1 + quidPage >= totalQuidPages ? 0 : quidPage;
		quidsSelectMenuOptions.push({ label: 'Show more user options', value: `newpage_${newQuidPage}`, description: `You are currently on page ${quidPage + 1}`, emoji: '📋' });
	}

	const quidsSelectMenu = new ActionRowBuilder<SelectMenuBuilder>()
		.setComponents(new SelectMenuBuilder()
			.setCustomId('heal_quids_options')
			.setPlaceholder('Select a quid to heal')
			.setOptions(quidsSelectMenuOptions));

	if (!quidToHeal) {

		const botReply = await respond(interaction, {
			content: messageContent,
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(quidData.color)
				.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL })
				.setDescription(`*${quidData.name} sits in front of the medicine den, looking if anyone needs help with injuries or illnesses.*`)],
			components: hurtQuids.length > 0 && quidsSelectMenuOptions.length > 0 ? [quidsSelectMenu] : [],
		}, true);

		createCommandComponentDisabler(userData.uuid, interaction.guildId, botReply);
		return;
	}

	let userToHeal = await userModel.findOne(u => Object.hasOwn(u.quids, quidToHeal!._id));
	let profileToHeal = getMapData(quidToHeal.profiles, interaction.guildId);

	if (!item) {

		const pagesButtons = new ActionRowBuilder<ButtonBuilder>()
			.setComponents([new ButtonBuilder()
				.setCustomId(`heal_page_1_${quidToHeal._id}`)
				.setLabel('Page 1')
				.setEmoji('🌱')
				.setStyle(ButtonStyle.Secondary),
			new ButtonBuilder()
				.setCustomId(`heal_page_2_${quidToHeal._id}`)
				.setLabel('Page 2')
				.setEmoji('🍀')
				.setStyle(ButtonStyle.Secondary)]);

		let healUserConditionText = '';

		healUserConditionText += (profileToHeal.health <= 0) ? '\nHealth: 0' : '';
		healUserConditionText += (profileToHeal.energy <= 0) ? '\nEnergy: 0' : '';
		healUserConditionText += (profileToHeal.hunger <= 0) ? '\nHunger: 0' : '';
		healUserConditionText += (profileToHeal.thirst <= 0) ? '\nThirst: 0' : '';
		healUserConditionText += (profileToHeal.injuries.wounds > 0) ? `\nWounds: ${profileToHeal.injuries.wounds}` : '';
		healUserConditionText += (profileToHeal.injuries.infections > 0) ? `\nInfections: ${profileToHeal.injuries.infections}` : '';
		healUserConditionText += (profileToHeal.injuries.cold == true) ? '\nCold: yes' : '';
		healUserConditionText += (profileToHeal.injuries.sprains > 0) ? `\nSprains: ${profileToHeal.injuries.sprains}` : '';
		healUserConditionText += (profileToHeal.injuries.poison == true) ? '\nPoison: yes' : '';

		if (healUserConditionText === '') {

			const botReply = await respond(interaction, {
				content: messageContent,
				embeds: [...embedArray, new EmbedBuilder()
					.setColor(quidData.color)
					.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL })
					.setDescription(`*${quidData.name} approaches ${quidToHeal.name}, desperately searching for someone to help.*\n"Do you have any injuries or illnesses you know of?" *the ${quidData.displayedSpecies || quidData.species} asks.\n${quidToHeal.name} shakes ${pronoun(quidToHeal, 2)} head.* "Not that I know of, no."\n*Disappointed, ${quidData.name} goes back to the medicine den.*`)],
				components: hurtQuids.length > 0 && quidsSelectMenuOptions.length > 0 ? [quidsSelectMenu] : [],
			}, true);

			createCommandComponentDisabler(userData.uuid, interaction.guildId, botReply);
			return;
		}

		const quidConditionEmbed = new EmbedBuilder()
			.setColor(quidData.color)
			.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL })
			.setDescription(userToHeal.uuid === userData.uuid
				? `*${quidToHeal.name} pushes aside the leaves acting as the entrance to the healer's den. With tired eyes ${pronounAndPlural(quidToHeal, 0, 'inspect')} the rows of herbs, hoping to find one that can ease ${pronoun(quidToHeal, 2)} pain.*`
				: profileToHeal.energy <= 0 || profileToHeal.health <= 0 || profileToHeal.hunger <= 0 || profileToHeal.thirst <= 0
					? `*${quidData.name} runs towards the pack borders, where ${quidToHeal.name} lies, only barely conscious. The ${profileData.rank} immediately looks for the right herbs to help the ${quidToHeal.displayedSpecies || quidToHeal.species}.*`
					: `*${quidToHeal.name} enters the medicine den with tired eyes.* "Please help me!" *${pronounAndPlural(quidToHeal, 0, 'say')}, ${pronoun(quidToHeal, 2)} face contorted in pain. ${quidData.name} looks up with worry.* "I'll see what I can do for you."`)
			.setFooter({ text: `${quidToHeal.name}'s condition:${healUserConditionText}` });

		let { embedDescription, selectMenuOptions } = getInventoryElements(serverData.inventory, inventoryPage);
		if (inventoryPage === 2) {

			embedDescription = `**water** - Found lots and lots of in the river that flows through the pack!\n${embedDescription}`;
			selectMenuOptions.unshift({ label: 'water', value: 'water' });
		}

		const inventoryEmbed = new EmbedBuilder()
			.setColor(quidData.color)
			.setTitle(`Inventory of ${interaction.guild.name} - Page ${inventoryPage}`)
			.setDescription(embedDescription);
		const inventorySelectMenu = new ActionRowBuilder<SelectMenuBuilder>()
			.setComponents(new SelectMenuBuilder()
				.setCustomId(`heal_inventory_options_${quidToHeal._id}`)
				.setPlaceholder('Select an item')
				.setOptions(selectMenuOptions));

		const botReply = await respond(interaction, {
			content: messageContent,
			embeds: [...embedArray, quidConditionEmbed, inventoryEmbed],
			components: [quidsSelectMenu, pagesButtons, inventorySelectMenu],
		}, true);

		createCommandComponentDisabler(userData.uuid, interaction.guildId, botReply);
		return;
	}

	// This part of the code is only executed if a herb has been given

	if (interaction instanceof MessageComponentInteraction) {

		await update(interaction, {
			components: disableAllComponents(interaction.message.components),
		})
			.catch((error) => { console.trace(error); });
	}

	if (!hurtQuids.some(quid => quid._id === quidToHeal!._id)) {

		const botReply = await respond(interaction, {
			content: messageContent,
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(quidData.color)
				.setTitle(`${quidToHeal.name} doesn't need to be healed anymore. Please select another quid to heal if available.`)],
			components: hurtQuids.length > 0 && quidsSelectMenuOptions.length > 0 ? [quidsSelectMenu] : [],
		}, true);

		createCommandComponentDisabler(userData.uuid, interaction.guildId, botReply);
		return;
	}

	const userCondition = interaction instanceof MessageComponentInteraction ? interaction.message.embeds[interaction.message.embeds.length - 2]?.footer?.text.toLowerCase() : undefined;
	let userHasChangedCondition = false;

	let chosenUserEnergyPoints = 0;
	let chosenUserHungerPoints = 0;
	let statsUpdateText = '';
	let injuryUpdateText = '';

	const embed = new EmbedBuilder()
		.setColor(quidData.color)
		.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL });

	let isSuccessful = false;

	const itemInfo = { ...commonPlantsInfo, ...uncommonPlantsInfo, ...rarePlantsInfo, ...specialPlantsInfo };

	if (item === 'water') {

		if (profileToHeal.thirst <= 0) { isSuccessful = true; }
		else if (userCondition?.includes('thirst')) { userHasChangedCondition = true; }
	}
	else {

		if (keyInObject(serverData.inventory.commonPlants, item)) { serverData.inventory.commonPlants[item] -= 1; }
		else if (keyInObject(serverData.inventory.uncommonPlants, item)) { serverData.inventory.uncommonPlants[item] -= 1; }
		else if (keyInObject(serverData.inventory.rarePlants, item)) { serverData.inventory.rarePlants[item] -= 1; }
		else if (keyInObject(serverData.inventory.specialPlants, item)) { serverData.inventory.specialPlants[item] -= 1; }
		else { throw new Error('item does not exist in serverData.inventory'); }
		serverData = await serverModel.findOneAndUpdate(
			s => s.serverId === serverData.serverId,
			(s) => { s.inventory = serverData.inventory; },
		);

		if (itemInfo[item].edibility === PlantEdibilityType.Edible) {

			if (profileToHeal.hunger <= 0) { isSuccessful = true; }
			else if (userCondition?.includes('hunger')) { userHasChangedCondition = true; }

			if (speciesInfo[quidToHeal.species as SpeciesNames].diet === SpeciesDietType.Carnivore) { chosenUserHungerPoints = 1; }
			else { chosenUserHungerPoints = 5; }
		}

		if (profileToHeal.health <= 0) { isSuccessful = true; }
		else if (userCondition?.includes('health')) { userHasChangedCondition = true; }

		if (itemInfo[item].healsWounds) {

			if (profileToHeal.injuries.wounds > 0) {

				isSuccessful = true;
				injuryUpdateText += `\n-1 wound for ${quidToHeal.name}`;
				profileToHeal.injuries.wounds -= 1;
			}
			else if (userCondition?.includes('wounds')) { userHasChangedCondition = true; }
		}

		if (itemInfo[item].healsInfections) {

			if (profileToHeal.injuries.infections > 0) {

				isSuccessful = true;
				injuryUpdateText += `\n-1 infection for ${quidToHeal.name}`;
				profileToHeal.injuries.infections -= 1;
			}
			else if (userCondition?.includes('infections')) { userHasChangedCondition = true; }
		}

		if (itemInfo[item].healsColds) {

			if (profileToHeal.injuries.cold == true) {

				isSuccessful = true;
				injuryUpdateText += `\ncold healed for ${quidToHeal.name}`;
				profileToHeal.injuries.cold = false;
			}
			else if (userCondition?.includes('cold')) { userHasChangedCondition = true; }
		}

		if (itemInfo[item].healsSprains) {

			if (profileToHeal.injuries.sprains > 0) {

				isSuccessful = true;
				injuryUpdateText += `\n-1 sprain for ${quidToHeal.name}`;
				profileToHeal.injuries.sprains -= 1;
			}
			else if (userCondition?.includes('sprains')) { userHasChangedCondition = true; }
		}

		if (itemInfo[item].healsPoison) {

			if (profileToHeal.injuries.poison == true) {

				isSuccessful = true;
				injuryUpdateText += `\npoison healed for ${quidToHeal.name}`;
				profileToHeal.injuries.poison = false;
			}
			else if (userCondition?.includes('poison')) { userHasChangedCondition = true; }
		}

		if (itemInfo[item].givesEnergy) {

			if (profileToHeal.energy <= 0) { isSuccessful = true; }
			chosenUserEnergyPoints = 30;
		}
	}

	if (isSuccessful && userToHeal.uuid === userData.uuid && pullFromWeightedTable({ 0: 75, 1: 25 + profileData.sapling.waterCycles - decreaseSuccessChance(serverData) }) === 0) {

		isSuccessful = false;
	}
	else if (isSuccessful === false && userHasChangedCondition === true) {

		const botReply = await respond(interaction, {
			embeds: [...embedArray, new EmbedBuilder()
				.setColor(quidData.color)
				.setTitle(`${quidToHeal.name}'s condition changed before you healed them. Please try again.`)],
			components: hurtQuids.length > 0 && quidsSelectMenuOptions.length > 0 ? [quidsSelectMenu] : [],
		}, true)
			.catch((error) => { throw new Error(error); });

		createCommandComponentDisabler(userData.uuid, interaction.guildId, botReply);
		return;
	}

	const denCondition = await wearDownDen(serverData, CurrentRegionType.MedicineDen);
	let embedFooter = '';

	if (isSuccessful === true && (profileData.rank === RankType.Apprentice || profileData.rank === RankType.Hunter) && pullFromWeightedTable({ 0: profileData.rank === RankType.Hunter ? 90 : 40, 1: 60 + profileData.sapling.waterCycles - decreaseSuccessChance(serverData) }) === 0) {

		isSuccessful = false;
	}

	if (isSuccessful === true) {

		const chosenUserThirstPoints = item === 'water' ? getSmallerNumber(getRandomNumber(10, 6), profileToHeal.maxThirst - profileToHeal.thirst) : 0;
		const chosenUserHealthPoints = item === 'water' ? 0 : getSmallerNumber(getRandomNumber(10, 6), profileToHeal.maxHealth - profileToHeal.health);
		/* We do this over here rather than at the top in the if statements for edibality and givesEnergy, because if chosenUserData === userData, then these might not be accurate. ie, the hunger/energy might have gone down enough in order not to decrease chosenUserHungerPoints/chosenUserEnergyPoints, as well as the stats not showing the correct amount based on what was lost from changeCondition() in changeCondition(), the chosenUserData, chosenCharacterData and chosenProfileData is updated to account for this */
		chosenUserEnergyPoints = getSmallerNumber(chosenUserEnergyPoints, profileToHeal.maxEnergy - profileToHeal.energy);
		chosenUserHungerPoints = getSmallerNumber(chosenUserHungerPoints, profileToHeal.maxHunger - profileToHeal.hunger);

		userToHeal = await userModel.findOneAndUpdate(
			u => u.uuid === userToHeal.uuid,
			(u) => {
				const p = getMapData(getMapData(u.quids, quidToHeal!._id).profiles, interaction.guildId);
				p.thirst += chosenUserThirstPoints;
				p.hunger += chosenUserHungerPoints;
				p.energy += chosenUserEnergyPoints;
				p.health += chosenUserHealthPoints;
				p.injuries = profileToHeal.injuries;
			},
		);
		quidToHeal = getMapData(userToHeal.quids, quidToHeal._id);
		profileToHeal = getMapData(quidToHeal.profiles, interaction.guildId);

		if (chosenUserHealthPoints >= 1) { statsUpdateText += `\n+${chosenUserHealthPoints} HP for ${quidToHeal.name} (${profileToHeal.health}/${profileToHeal.maxHealth})${injuryUpdateText}`; }
		if (chosenUserEnergyPoints >= 1) { statsUpdateText += `\n+${chosenUserEnergyPoints} energy for ${quidToHeal.name} (${profileToHeal.energy}/${profileToHeal.maxEnergy})`; }
		if (chosenUserHungerPoints > 0) { statsUpdateText += `\n+${chosenUserHungerPoints} hunger for ${quidToHeal.name} (${profileToHeal.hunger}/${profileToHeal.maxHunger})`; }
		if (chosenUserThirstPoints > 0) { statsUpdateText += `\n+${chosenUserThirstPoints} thirst for ${quidToHeal.name} (${profileToHeal.thirst}/${profileToHeal.maxThirst})`; }

		if (item === 'water') {

			embed.setDescription(`*${quidData.name} takes ${quidToHeal.name}'s body, drags it over to the river, and positions ${pronoun(quidToHeal, 2)} head right over the water. The ${quidToHeal.displayedSpecies || quidToHeal.species} sticks ${pronoun(quidToHeal, 2)} tongue out and slowly starts drinking. Immediately you can observe how the newfound energy flows through ${pronoun(quidToHeal, 2)} body.*`);
		}
		else if (userToHeal.uuid === userData.uuid) {

			embed.setDescription(`*${quidData.name} takes a ${item}. After a bit of preparation, the ${quidData.displayedSpecies || quidData.species} can apply it correctly. Immediately you can see the effect. ${upperCasePronounAndPlural(quidData, 0, 'feel')} much better!*`);
		}
		else {

			embed.setDescription(`*${quidData.name} takes a ${item}. After a bit of preparation, ${pronounAndPlural(quidData, 0, 'give')} it to ${quidToHeal.name}. Immediately you can see the effect. ${upperCasePronounAndPlural(quidToHeal, 0, 'feel')} much better!*`);
		}

		embedFooter = `\n${statsUpdateText}`;
	}
	else if (item === 'water') {

		if (userData.uuid === userToHeal.uuid) {

			embed.setDescription(`*${quidData.name} thinks about just drinking some water, but that won't help with ${pronoun(quidData, 2)} issues...*"`);
		}
		else if (profileToHeal.thirst > 0) {

			embed.setDescription(`*${quidToHeal.name} looks at ${quidData.name} with indignation.* "Being hydrated is really not my biggest problem right now!"`);
		}
		else {

			embed.setDescription(`*${quidData.name} takes ${quidToHeal.name}'s body and tries to drag it over to the river. The ${quidData.displayedSpecies || quidData.species} attempts to position the ${quidToHeal.displayedSpecies || quidToHeal.species}'s head right over the water, but every attempt fails miserably. ${upperCasePronounAndPlural(quidData, 0, 'need')} to concentrate and try again.*`);
		}
	}
	else if (userData.uuid === userToHeal.uuid) {

		embed.setDescription(`*${quidData.name} holds the ${item} in ${pronoun(quidData, 2)} mouth, trying to find a way to apply it. After a few attempts, the herb breaks into little pieces, rendering it useless. Guess ${pronounAndPlural(quidData, 0, 'has', 'have')} to try again...*`);
	}
	else {

		embed.setDescription(`*${quidData.name} takes a ${item}. After a bit of preparation, ${pronounAndPlural(quidData, 0, 'give')} it to ${quidToHeal.name}. But no matter how long ${pronoun(quidData, 0)} wait, it does not seem to help. Looks like ${quidData.name} has to try again...*`);
	}

	const experiencePoints = isSuccessful === false ? 0 : profileData.rank == RankType.Elderly ? getRandomNumber(41, 20) : profileData.rank == RankType.Healer ? getRandomNumber(21, 10) : getRandomNumber(11, 5);
	const changedCondition = await changeCondition(userData, quidData, profileData, experiencePoints);
	embed.setFooter({ text: `${changedCondition.statsUpdateText}${embedFooter}\n\n${denCondition}${item !== 'water' ? `\n-1 ${item} for ${interaction.guild.name}` : ''}` });

	const infectedEmbed = await infectWithChance(userData, quidData, profileData, quidToHeal, profileToHeal);

	const content = userToHeal.uuid !== userToHeal.uuid && isSuccessful === true ? `<@${userToHeal.userId[0]}>\n` : '' + (messageContent ?? '');
	const levelUpEmbed = (await checkLevelUp(interaction, userData, quidData, profileData, serverData)).levelUpEmbed;

	if (interaction instanceof MessageComponentInteraction) {

		await interaction.update({ components: disableAllComponents(interaction.message.components) })
			.catch((error) => { console.error(error); });
	}

	const botReply = await respond(interaction, {
		content: content === '' ? null : content,
		embeds: [
			...embedArray,
			embed,
			...(infectedEmbed === null ? [] : [infectedEmbed]),
			...(changedCondition.injuryUpdateEmbed ? [changedCondition.injuryUpdateEmbed] : []),
			...(levelUpEmbed ? [levelUpEmbed] : []),
		],
	}, false)
		.catch((error) => { throw new Error(error); });

	await isPassedOut(interaction, userData, quidData, profileData, true);

	await restAdvice(interaction, userData, profileData);
	await drinkAdvice(interaction, userData, profileData);
	await eatAdvice(interaction, userData, profileData);

	if (userToHeal.uuid !== userData.uuid) { await addFriendshipPoints(botReply, userData, quidData._id, userToHeal, quidToHeal._id); }

	return;
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