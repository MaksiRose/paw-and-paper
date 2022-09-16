import { ChatInputCommandInteraction, EmbedBuilder, FormattingPatterns, SelectMenuInteraction, SlashCommandBuilder } from 'discord.js';
import Fuse from 'fuse.js';
import serverModel from '../../models/serverModel';
import userModel from '../../models/userModel';
import { CommonPlantNames, commonPlantsInfo, CurrentRegionType, PlantEdibilityType, Profile, Quid, RarePlantNames, rarePlantsInfo, ServerSchema, SlashCommand, SpecialPlantNames, specialPlantsInfo, SpeciesDietType, speciesInfo, SpeciesNames, StatIncreaseType, UncommonPlantNames, uncommonPlantsInfo, UserSchema } from '../../typedef';
import { hasCompletedAccount, isInGuild } from '../../utils/checkUserState';
import { isInvalid } from '../../utils/checkValidity';
import { disableAllComponents } from '../../utils/componentDisabling';
import { pronoun, pronounAndPlural, upperCasePronounAndPlural } from '../../utils/getPronouns';
import { getBiggerNumber, getMapData, getSmallerNumber, respond, unsafeKeys, update, widenValues } from '../../utils/helperFunctions';
import { getRandomNumber } from '../../utils/randomizers';
import wearDownDen from '../../utils/wearDownDen';
import { remindOfAttack } from '../gameplay_primary/attack';
import { showInventoryMessage } from './inventory';

const name: SlashCommand['name'] = 'eat';
const description: SlashCommand['description'] = 'Take the appropriate food for your species out of the packs food pile and fill up your hunger meter.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.setDMPermission(false)
		.addStringOption(option =>
			option.setName('food')
				.setDescription('The item that you would like to eat.')
				.setAutocomplete(true)
				.setRequired(false))
		.toJSON(),
	disablePreviousCommand: true,
	sendAutocomplete: async (client, interaction, userData, serverData) => {

		if (!serverData) { return; }
		const focusedValue = interaction.options.getFocused();
		let choices: string[] = [];

		const inventory_ = widenValues(serverData.inventory);
		for (const itemType of unsafeKeys(serverData.inventory)) {

			if (itemType === 'materials') { continue; }
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

		if (profileData.hunger >= profileData.maxHunger) {

			await respond(interaction, {
				content: messageContent,
				embeds: [...embedArray, new EmbedBuilder()
					.setColor(quidData.color)
					.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL })
					.setDescription(`*${quidData.name}'s stomach bloats as ${pronounAndPlural(quidData, 0, 'roll')} around camp, stuffing food into ${pronoun(quidData, 2)} mouth. The ${quidData.displayedSpecies || quidData.species} might need to take a break from food before ${pronounAndPlural(quidData, 0, 'goes', 'go')} into a food coma.*`)],
			}, true)
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		const chosenFood = interaction.options.getString('food');

		await sendEatMessage(interaction, chosenFood ?? '', userData, quidData, profileData, serverData, messageContent, embedArray);
	},
};

export async function sendEatMessage(
	interaction: ChatInputCommandInteraction<'cached'> | SelectMenuInteraction<'cached'>,
	chosenFood: string,
	userData: UserSchema,
	quidData: Quid,
	profileData: Profile,
	serverData: ServerSchema,
	messageContent: string | null,
	embedArray: EmbedBuilder[],
): Promise<void> {

	const embed = new EmbedBuilder()
		.setColor(quidData.color)
		.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL });

	const mentionedUserMatch = chosenFood.match(FormattingPatterns.User);
	if (mentionedUserMatch) {

		const taggedUserData = await userModel.findOne(u => u.userId.includes(mentionedUserMatch[1] || ''));
		const taggedQuidData = taggedUserData.quids[taggedUserData.currentQuid[interaction.guildId] || ''];

		if (taggedQuidData) {

			embed.setDescription(`*${quidData.name} looks down at ${taggedQuidData.name} as ${pronounAndPlural(taggedQuidData, 0, 'nom')} on the ${taggedQuidData.displayedSpecies || taggedQuidData.species}'s leg.* "No eating packmates here!" *${taggedQuidData.name} chuckled, shaking off ${quidData.name}.*`);
			await (async function(messageObject) { return interaction.isSelectMenu() ? await update(interaction, messageObject) : await respond(interaction, messageObject, true); })({
				content: messageContent,
				embeds: [...embedArray, embed],
				components: interaction.isSelectMenu() ? disableAllComponents(interaction.message.components) : [],
			})
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}
	}

	let finalHungerPoints = 0;
	let finalHealthPoints = 0;
	let finalEnergyPoints = 0;

	let increasedStatType: 'health' | 'energy' | 'hunger' | 'thirst' | null = null;
	let increasedMaxStatType: StatIncreaseType | null = null;

	let footerText = '';
	const inventory_ = widenValues(serverData.inventory);

	const allPlantsInfo = { ...commonPlantsInfo, ...uncommonPlantsInfo, ...rarePlantsInfo, ...specialPlantsInfo };

	if (chosenFoodIsPlant(allPlantsInfo, chosenFood)) {

		let plantType: 'commonPlants' | 'uncommonPlants' | 'rarePlants' | 'specialPlants';

		if (Object.hasOwn(commonPlantsInfo, chosenFood)) {

			plantType = 'commonPlants';
		}
		else if (Object.hasOwn(uncommonPlantsInfo, chosenFood)) {

			plantType = 'uncommonPlants';
		}
		else if (Object.hasOwn(rarePlantsInfo, chosenFood)) {

			plantType = 'rarePlants';
		}
		else if (Object.hasOwn(specialPlantsInfo, chosenFood)) {

			plantType = 'specialPlants';

			const pickIncreasedStatType = (['health', 'energy', 'hunger', 'thirst'] as const)[getRandomNumber(4)];
			if (pickIncreasedStatType === undefined) { throw new TypeError('pickIncreasedStatType is undefined'); }
			increasedStatType = pickIncreasedStatType;

			const pickIncreasedMaxStatType = ([StatIncreaseType.MaxHealth, StatIncreaseType.MaxEnergy, StatIncreaseType.MaxHunger, StatIncreaseType.MaxThirst] as const)[(['health', 'energy', 'hunger', 'thirst'] as const).findIndex(v => v === increasedStatType)];
			if (pickIncreasedMaxStatType === undefined) { throw new TypeError('pickIncreasedMaxStatType is undefined'); }
			increasedMaxStatType = pickIncreasedMaxStatType;

			await userModel.findOneAndUpdate(
				u => u.uuid === userData.uuid,
				(u) => {
					const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
					p.temporaryStatIncrease[Date.now()] = increasedMaxStatType!;
				},
			);
		}
		else { throw new Error('chosenFood could not be assigned to any plant type'); }

		if (inventory_[plantType][chosenFood] <= 0) {

			await sendNoItemMessage(embed, quidData, chosenFood, interaction, messageContent, embedArray);
			return;
		}
		inventory_[plantType][chosenFood] -= 1;

		if (allPlantsInfo[chosenFood].edibility === PlantEdibilityType.Toxic) {

			finalHungerPoints = getBiggerNumber(-profileData.hunger, getRandomNumber(3, -5) - removeHungerPoints(serverData));
			finalHealthPoints = getBiggerNumber(-profileData.health, getRandomNumber(3, -10));

			embed.setDescription(`*A yucky feeling drifts down ${quidData.name}'s throat. ${upperCasePronounAndPlural(quidData, 0, 'shakes and spits', 'shake and spit')} it out, trying to rid ${pronoun(quidData, 2)} mouth of the taste. The plant is poisonous!*`);
		}

		if (allPlantsInfo[chosenFood].edibility === PlantEdibilityType.Inedible) {

			finalHungerPoints = getBiggerNumber(-profileData.hunger, getRandomNumber(3, -3) - removeHungerPoints(serverData));

			embed.setDescription(`*${quidData.name} slowly opens ${pronoun(quidData, 2)} mouth and chomps onto the ${chosenFood}. The ${quidData.displayedSpecies || quidData.species} swallows it, but ${pronoun(quidData, 2)} face has a look of disgust. That wasn't very tasty!*`);
		}

		if (allPlantsInfo[chosenFood].edibility === PlantEdibilityType.Edible) {

			if (speciesInfo[quidData.species as SpeciesNames].diet === SpeciesDietType.Carnivore) {

				finalHungerPoints = getBiggerNumber(-profileData.hunger, getSmallerNumber(profileData.maxHunger - profileData.hunger, getRandomNumber(5, 1) - removeHungerPoints(serverData)));

				embed.setDescription(`*${quidData.name} plucks a ${chosenFood} from the pack storage and nibbles away at it. It has a bitter, foreign taste, not the usual meaty meal the ${quidData.displayedSpecies || quidData.species} prefers.*`);
			}
			else {

				finalHungerPoints = getSmallerNumber(profileData.maxHunger - profileData.hunger, getRandomNumber(4, 15) - removeHungerPoints(serverData));

				embed.setDescription(`*Leaves flutter into the storage den, landing near ${quidData.name}'s feet. The ${quidData.displayedSpecies || quidData.species} searches around the inventory determined to find the perfect meal, and that ${pronounAndPlural(quidData, 0, 'does', 'do')}. ${quidData.name} plucks a ${chosenFood} from the pile and eats until ${pronoun(quidData, 2)} stomach is pleased.*`);
			}
		}

		if (allPlantsInfo[chosenFood].givesEnergy === true) {

			finalEnergyPoints = getSmallerNumber(profileData.maxEnergy - profileData.energy, 20);
		}

		if (allPlantsInfo[chosenFood].increasesMaxCondition === true) {

			if (finalHungerPoints < 0) { finalHungerPoints = 0; }

			embed.setDescription(`*${quidData.name} decides to have a special treat today. Slowly, ${pronounAndPlural(quidData, 0, 'chew')} on the ${chosenFood}, enjoying the fresh taste. It doesn't take long for the ${quidData.displayedSpecies || quidData.species} to feel a special effect kick in: It's as if ${pronoun(quidData, 0)} can have much more ${increasedStatType} than before. What an enchanting sensation!*`);
		}
	}
	else if (chosenFoodIsMeat(chosenFood)) {

		if (inventory_.meat[chosenFood] <= 0) {

			await sendNoItemMessage(embed, quidData, chosenFood, interaction, messageContent, embedArray);
			return;
		}
		inventory_.meat[chosenFood] -= 1;

		if (speciesInfo[quidData.species as SpeciesNames].diet === SpeciesDietType.Herbivore) {

			finalHungerPoints = getBiggerNumber(-profileData.hunger, getSmallerNumber(profileData.maxHunger - profileData.hunger, getRandomNumber(5, 1) - removeHungerPoints(serverData)));

			embed.setDescription(`*${quidData.name} stands by the storage den, eyeing the varieties of food. A ${chosenFood} catches ${pronoun(quidData, 2)} attention. The ${quidData.displayedSpecies || quidData.species} walks over to it and begins to eat.* "This isn't very good!" *${quidData.name} whispers to ${pronoun(quidData, 4)} and leaves the den, stomach still growling, and craving for plants to grow.*`);
		}
		else {

			finalHungerPoints = getSmallerNumber(profileData.maxHunger - profileData.hunger, getRandomNumber(4, 15) - removeHungerPoints(serverData));

			embed.setDescription(`*${quidData.name} sits chewing maliciously on a ${chosenFood}. A dribble of blood escapes out of ${pronoun(quidData, 2)} jaw as the ${quidData.displayedSpecies || quidData.species} finishes off the meal. It was a delicious feast, but very messy!*`);
		}
	}
	else {

		await showInventoryMessage(interaction, userData, profileData, serverData, 1, false);
		return;
	}

	const previousRegion = profileData.currentRegion;
	userData = await userModel.findOneAndUpdate(
		u => u.uuid === userData.uuid,
		(u) => {
			u.advice.eating = true;
			const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
			p.currentRegion = CurrentRegionType.FoodDen;
			p.hunger += finalHungerPoints;
			p.energy += finalEnergyPoints;
			p.health += finalHealthPoints;
			if (increasedMaxStatType) { p[increasedMaxStatType] += 10; }
		},
	);
	quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId));
	profileData = getMapData(quidData.profiles, interaction.guildId);

	serverData = await serverModel.findOneAndUpdate(
		s => s.serverId === interaction.guildId,
		(s) => {
			s.inventory = inventory_;
		},
	);

	footerText += `${finalHungerPoints >= 0 ? '+' : ''}${finalHungerPoints} hunger (${profileData.hunger}/${profileData.maxHunger})`;

	if (finalEnergyPoints !== 0) { footerText += `\n+${finalEnergyPoints} energy (${profileData.energy}/${profileData.maxHunger})`; }
	if (finalHealthPoints !== 0) { footerText += `\n${finalHealthPoints} health (${profileData.health}/${profileData.maxHealth})`; }
	if (increasedMaxStatType !== null && increasedStatType !== null) { footerText += `\n+10 maximum ${increasedStatType} (${profileData[increasedMaxStatType]}) for one week`; }
	if (previousRegion !== CurrentRegionType.FoodDen) { footerText += '\nYou are now at the food den'; }
	embed.setFooter({ text: `${footerText}\n\n${await wearDownDen(serverData, CurrentRegionType.FoodDen)}\n-1 ${chosenFood} for ${interaction.guild.name}` });

	await (async function(messageObject) { return interaction.isSelectMenu() ? await update(interaction, messageObject) : await respond(interaction, messageObject, true); })({
		content: messageContent,
		embeds: [...embedArray, embed],
		components: interaction.isSelectMenu() ? disableAllComponents(interaction.message.components) : [],
	})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});
	return;
}

function chosenFoodIsPlant(
	allPlantsInfo: typeof commonPlantsInfo & typeof uncommonPlantsInfo & typeof rarePlantsInfo & typeof specialPlantsInfo,
	chosenFood: string,
): chosenFood is CommonPlantNames | UncommonPlantNames | RarePlantNames | SpecialPlantNames {

	return Object.hasOwn(allPlantsInfo, chosenFood);
}

function chosenFoodIsMeat(
	chosenFood: string,
): chosenFood is SpeciesNames {

	return Object.hasOwn(speciesInfo, chosenFood);
}

async function sendNoItemMessage(
	embed: EmbedBuilder,
	quidData: Quid,
	chosenFood: string,
	interaction: ChatInputCommandInteraction<'cached'> | SelectMenuInteraction<'cached'>,
	messageContent: string | null,
	embedArray: EmbedBuilder[],
): Promise<void> {

	embed.setDescription(`*${quidData.name} searches for a ${chosenFood} all over the pack, but couldn't find one...*`);
	await (async function(messageObject) { return interaction.isSelectMenu() ? await update(interaction, messageObject) : await respond(interaction, messageObject, true); })({
		content: messageContent,
		embeds: [...embedArray, embed],
		components: interaction.isSelectMenu() ? disableAllComponents(interaction.message.components) : [],
	})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});
}

/**
 * It takes a message, finds the server data, calculates the den stats, calculates the multiplier, and
 * returns the amount of hunger points to remove
 * @param serverData - The server data.
 * @returns the number of hunger points that will be removed from the user's character.
 */
function removeHungerPoints(
	serverData: ServerSchema,
): number {

	const denStats = serverData.dens.foodDen.structure + serverData.dens.foodDen.bedding + serverData.dens.foodDen.thickness + serverData.dens.foodDen.evenness;
	const multiplier = denStats / 400;
	return 10 - Math.round(10 * multiplier);
}