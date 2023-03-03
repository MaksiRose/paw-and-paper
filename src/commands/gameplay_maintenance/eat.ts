import { ChatInputCommandInteraction, EmbedBuilder, FormattingPatterns, AnySelectMenuInteraction, SlashCommandBuilder } from 'discord.js';
import Fuse from 'fuse.js';
import { commonPlantsInfo, rarePlantsInfo, specialPlantsInfo, speciesInfo, uncommonPlantsInfo } from '../..';
import serverModel from '../../oldModels/serverModel';
import { userModel, getUserData } from '../../oldModels/userModel';
import { ServerSchema } from '../../typings/data/server';
import { CurrentRegionType, StatIncreaseType, UserData } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { PlantEdibilityType, SpeciesDietType } from '../../typings/main';
import { hasName, hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid } from '../../utils/checkValidity';
import { disableAllComponents } from '../../utils/componentDisabling';
import { capitalize, getBiggerNumber, getMapData, getSmallerNumber, keyInObject, respond, unsafeKeys, widenValues } from '../../utils/helperFunctions';
import { getRandomNumber } from '../../utils/randomizers';
import { wearDownDen } from '../../utils/wearDownDen';
import { remindOfAttack } from '../gameplay_primary/attack';
import { showInventoryMessage } from './inventory';

const allPlantsInfo = { ...commonPlantsInfo, ...uncommonPlantsInfo, ...rarePlantsInfo, ...specialPlantsInfo };

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('eat')
		.setDescription('Take the appropriate food for your species out of the packs food pile and fill up your hunger meter.')
		.setDMPermission(false)
		.addStringOption(option =>
			option.setName('food')
				.setDescription('The item that you would like to eat.')
				.setAutocomplete(true)
				.setRequired(false))
		.toJSON(),
	category: 'page3',
	position: 3,
	disablePreviousCommand: true,
	modifiesServerProfile: true,
	sendAutocomplete: async (interaction, userData, serverData) => {

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
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer, server }) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(userData, interaction)) { return; } // This is always a reply

		/* Checks if the profile is resting, on a cooldown or passed out. */
		const restEmbed = await isInvalid(interaction, userData);
		if (restEmbed === false) { return; }

		const messageContent = remindOfAttack(interaction.guildId);

		if (userData.quid.profile.hunger >= userData.quid.profile.maxHunger) {

			// This is always a reply
			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(userData.quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setDescription(`*${userData.quid.name}'s stomach bloats as ${userData.quid.pronounAndPlural(0, 'roll')} around camp, stuffing food into ${userData.quid.pronoun(2)} mouth. The ${userData.quid.getDisplayspecies()} might need to take a break from food before ${userData.quid.pronounAndPlural(0, 'goes', 'go')} into a food coma.*`)],
			});
			return;
		}

		const chosenFood = interaction.options.getString('food');

		await sendEatMessage(interaction, chosenFood ?? '', userData, serverData, messageContent, restEmbed);
	},
};

export async function sendEatMessage(
	interaction: ChatInputCommandInteraction<'cached'> | AnySelectMenuInteraction<'cached'>,
	chosenFood: string,
	userData: UserData<never, never>,
	serverData: ServerSchema,
	messageContent: string,
	restEmbed: EmbedBuilder[],
): Promise<void> {

	const embed = new EmbedBuilder()
		.setColor(userData.quid.color)
		.setAuthor({
			name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
			iconURL: quid.avatarURL,
		});

	const mentionedUserMatch = chosenFood.match(FormattingPatterns.User);
	if (mentionedUserMatch) {

		const _taggedUserData = userModel.findOne(u => Object.keys(u.userIds).includes(mentionedUserMatch[1] || ''));
		const taggedUserData = getUserData(_taggedUserData, interaction.guildId, _taggedUserData.quids[_taggedUserData.servers[interaction.guildId ?? '']?.currentQuid ?? '']);

		if (hasName(taggedUserData)) {

			embed.setDescription(`*${taggedUserData.quid.name} looks down at ${taggedUserData.quid.name} as ${taggedUserData.quid.pronounAndPlural(0, 'nom')} on the ${taggedUserData.quid.getDisplayspecies()}'s leg.* "No eating packmates here!" *${taggedUserData.quid.name} chuckled, shaking off ${taggedUserData.quid.name}.*`);

			// If the interaction is a ChatInputCommand, this is a reply, else this is an update to the message with the component
			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, embed],
				components: interaction.isStringSelectMenu() ? disableAllComponents(interaction.message.components) : [],
			}, 'update', interaction.isAnySelectMenu() ? interaction.message.id : undefined);
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

	if (keyInObject(allPlantsInfo, chosenFood)) {

		let plantType: 'commonPlants' | 'uncommonPlants' | 'rarePlants' | 'specialPlants';

		if (keyInObject(commonPlantsInfo, chosenFood)) {

			plantType = 'commonPlants';
		}
		else if (keyInObject(uncommonPlantsInfo, chosenFood)) {

			plantType = 'uncommonPlants';
		}
		else if (keyInObject(rarePlantsInfo, chosenFood)) {

			plantType = 'rarePlants';
		}
		else if (keyInObject(specialPlantsInfo, chosenFood)) {

			plantType = 'specialPlants';

			const statArray = ['health', 'energy', 'hunger', 'thirst'] as const;

			const pickIncreasedStatType = statArray[getRandomNumber(4)];
			if (pickIncreasedStatType === undefined) { throw new TypeError('pickIncreasedStatType is undefined'); }
			increasedStatType = pickIncreasedStatType;

			const pickIncreasedMaxStatType = ([StatIncreaseType.MaxHealth, StatIncreaseType.MaxEnergy, StatIncreaseType.MaxHunger, StatIncreaseType.MaxThirst] as const)[statArray.findIndex(v => v === increasedStatType)];
			if (pickIncreasedMaxStatType === undefined) { throw new TypeError('pickIncreasedMaxStatType is undefined'); }
			increasedMaxStatType = pickIncreasedMaxStatType;

			await userData.update(
				(u) => {
					const p = getMapData(getMapData(u.quids, getMapData(u.servers, interaction.guildId).currentQuid ?? '').profiles, interaction.guildId);
					p.temporaryStatIncrease[Date.now()] = increasedMaxStatType!;
				},
			);
		}
		else { throw new Error('chosenFood could not be assigned to any plant type'); }

		if (inventory_[plantType][chosenFood] <= 0) {

			// If this is a ChatInputCommand, this is a reply, else this is an update to the message with the component
			await sendNoItemMessage(embed, userData, chosenFood, interaction, messageContent, restEmbed);
			return;
		}
		inventory_[plantType][chosenFood] -= 1;

		if (allPlantsInfo[chosenFood].edibility === PlantEdibilityType.Toxic) {

			finalHungerPoints = getBiggerNumber(-userData.quid.profile.hunger, getRandomNumber(3, -5) - removeHungerPoints(serverData));
			finalHealthPoints = getBiggerNumber(-userData.quid.profile.health, getRandomNumber(3, -10));

			embed.setDescription(`*A yucky feeling drifts down ${userData.quid.name}'s throat. ${capitalize(userData.quid.pronounAndPlural(0, 'shakes and spits', 'shake and spit'))} it out, trying to rid ${userData.quid.pronoun(2)} mouth of the taste. The plant is poisonous!*`);
		}

		if (allPlantsInfo[chosenFood].edibility === PlantEdibilityType.Inedible) {

			finalHungerPoints = getBiggerNumber(-userData.quid.profile.hunger, getRandomNumber(3, -3) - removeHungerPoints(serverData));

			embed.setDescription(`*${userData.quid.name} slowly opens ${userData.quid.pronoun(2)} mouth and chomps onto the ${chosenFood}. The ${userData.quid.getDisplayspecies()} swallows it, but ${userData.quid.pronoun(2)} face has a look of disgust. That wasn't very tasty!*`);
		}

		if (allPlantsInfo[chosenFood].edibility === PlantEdibilityType.Edible) {

			if (speciesInfo[userData.quid.species].diet === SpeciesDietType.Carnivore) {

				finalHungerPoints = getBiggerNumber(-userData.quid.profile.hunger, getSmallerNumber(userData.quid.profile.maxHunger - userData.quid.profile.hunger, addIncorrectDietHungerPoints() - removeHungerPoints(serverData)));

				embed.setDescription(`*${userData.quid.name} plucks a ${chosenFood} from the pack storage and nibbles away at it. It has a bitter, foreign taste, not the usual meaty meal the ${userData.quid.getDisplayspecies()} prefers.*`);
			}
			else {

				finalHungerPoints = getSmallerNumber(userData.quid.profile.maxHunger - userData.quid.profile.hunger, addCorrectDietHungerPoints() - removeHungerPoints(serverData));

				embed.setDescription(`*Leaves flutter into the storage den, landing near ${userData.quid.name}'s feet. The ${userData.quid.getDisplayspecies()} searches around the inventory determined to find the perfect meal, and that ${userData.quid.pronounAndPlural(0, 'does', 'do')}. ${userData.quid.name} plucks a ${chosenFood} from the pile and eats until ${userData.quid.pronoun(2)} stomach is pleased.*`);
			}
		}

		if (allPlantsInfo[chosenFood].givesEnergy === true) {

			finalEnergyPoints = getSmallerNumber(userData.quid.profile.maxEnergy - userData.quid.profile.energy, 20);
		}

		if (allPlantsInfo[chosenFood].increasesMaxCondition === true) {

			if (finalHungerPoints < 0) { finalHungerPoints = 0; }

			embed.setDescription(`*${userData.quid.name} decides to have a special treat today. Slowly, ${userData.quid.pronounAndPlural(0, 'chew')} on the ${chosenFood}, enjoying the fresh taste. It doesn't take long for the ${userData.quid.getDisplayspecies()} to feel a special effect kick in: It's as if ${userData.quid.pronoun(0)} can have much more ${increasedStatType} than before. What an enchanting sensation!*`);
		}
	}
	else if (keyInObject(speciesInfo, chosenFood)) {

		if (inventory_.meat[chosenFood] <= 0) {

			// If this is a ChatInputCommand, this is a reply, else this is an update to the message with the component
			await sendNoItemMessage(embed, userData, chosenFood, interaction, messageContent, restEmbed);
			return;
		}
		inventory_.meat[chosenFood] -= 1;

		if (speciesInfo[userData.quid.species].diet === SpeciesDietType.Herbivore) {

			finalHungerPoints = getBiggerNumber(-userData.quid.profile.hunger, getSmallerNumber(userData.quid.profile.maxHunger - userData.quid.profile.hunger, addIncorrectDietHungerPoints() - removeHungerPoints(serverData)));

			embed.setDescription(`*${userData.quid.name} stands by the storage den, eyeing the varieties of food. A ${chosenFood} catches ${userData.quid.pronoun(2)} attention. The ${userData.quid.getDisplayspecies()} walks over to it and begins to eat.* "This isn't very good!" *${userData.quid.name} whispers to ${userData.quid.pronoun(4)} and leaves the den, stomach still growling, and craving for plants to grow.*`);
		}
		else {

			finalHungerPoints = getSmallerNumber(userData.quid.profile.maxHunger - userData.quid.profile.hunger, addCorrectDietHungerPoints() - removeHungerPoints(serverData));

			embed.setDescription(`*${userData.quid.name} sits chewing maliciously on a ${chosenFood}. A dribble of blood escapes out of ${userData.quid.pronoun(2)} jaw as the ${userData.quid.getDisplayspecies()} finishes off the meal. It was a delicious feast, but very messy!*`);
		}
	}
	else {

		await showInventoryMessage(interaction, userData, serverData, 1, false);
		return;
	}

	const previousRegion = userData.quid.profile.currentRegion;
	await userData.update(
		(u) => {
			u.advice.eating = true;
			const p = getMapData(getMapData(u.quids, getMapData(u.servers, interaction.guildId).currentQuid ?? '').profiles, interaction.guildId);
			p.currentRegion = CurrentRegionType.FoodDen;
			p.hunger += finalHungerPoints;
			p.energy += finalEnergyPoints;
			p.health += finalHealthPoints;
			if (increasedMaxStatType) { p[increasedMaxStatType] += 10; }
		},
	);

	serverData = await serverModel.findOneAndUpdate(
		s => s._id === serverData._id,
		(s) => {
			s.inventory = inventory_;
		},
	);

	footerText += `${finalHungerPoints >= 0 ? '+' : ''}${finalHungerPoints} hunger (${userData.quid.profile.hunger}/${userData.quid.profile.maxHunger})`;

	if (finalEnergyPoints !== 0) { footerText += `\n+${finalEnergyPoints} energy (${userData.quid.profile.energy}/${userData.quid.profile.maxHunger})`; }
	if (finalHealthPoints !== 0) { footerText += `\n${finalHealthPoints} health (${userData.quid.profile.health}/${userData.quid.profile.maxHealth})`; }
	if (increasedMaxStatType !== null && increasedStatType !== null) { footerText += `\n+10 maximum ${increasedStatType} (${userData.quid.profile[increasedMaxStatType]}) for one week`; }
	if (previousRegion !== CurrentRegionType.FoodDen) { footerText += '\nYou are now at the food den'; }
	embed.setFooter({ text: `${footerText}\n\n${await wearDownDen(serverData, CurrentRegionType.FoodDen)}\n-1 ${chosenFood} for ${interaction.guild.name}` });

	// If interaction is a ChatInputCommand, this is a reply, else this is an update to the message with the component
	await respond(interaction, {
		content: messageContent,
		embeds: [...restEmbed, embed],
		components: interaction.isStringSelectMenu() ? disableAllComponents(interaction.message.components) : [],
	}, 'update', interaction.isAnySelectMenu() ? interaction.message.id : undefined);
	return;
}

async function sendNoItemMessage(
	embed: EmbedBuilder,
	userData: UserData<never, never>,
	chosenFood: string,
	interaction: ChatInputCommandInteraction<'cached'> | AnySelectMenuInteraction<'cached'>,
	messageContent: string,
	restEmbed: EmbedBuilder[],
): Promise<void> {

	embed.setDescription(`*${userData.quid.name} searches for a ${chosenFood} all over the pack, but couldn't find one...*`);

	// If this is a ChatInputCommand, this is a reply, else this is an update to the message with the component
	await respond(interaction, {
		content: messageContent,
		embeds: [...restEmbed, embed],
		components: interaction.isStringSelectMenu() ? disableAllComponents(interaction.message.components) : [],
	}, 'update', interaction.isAnySelectMenu() ? interaction.message.id : undefined);
}

function addIncorrectDietHungerPoints() { return getRandomNumber(5, 1); }
export function addCorrectDietHungerPoints() { return getRandomNumber(4, 15); }

/**
 * It takes a message, finds the server data, calculates the den stats, calculates the multiplier, and
 * returns the amount of hunger points to remove
 * @param serverData - The server data.
 * @returns the number of hunger points that will be removed from the user's character.
 */
export function removeHungerPoints(
	serverData: ServerSchema,
): number {

	const denStats = serverData.dens.foodDen.structure + serverData.dens.foodDen.bedding + serverData.dens.foodDen.thickness + serverData.dens.foodDen.evenness;
	const multiplier = denStats / 400;
	return 10 - Math.round(10 * multiplier);
}