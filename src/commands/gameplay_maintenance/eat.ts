import { generateId } from 'crystalid';
import { ChatInputCommandInteraction, EmbedBuilder, FormattingPatterns, AnySelectMenuInteraction, SlashCommandBuilder } from 'discord.js';
import Fuse from 'fuse.js';
import { commonPlantsInfo, materialsInfo, rarePlantsInfo, specialPlantsInfo, speciesInfo, uncommonPlantsInfo } from '../..';
import Den from '../../models/den';
import DiscordUser from '../../models/discordUser';
import Quid from '../../models/quid';
import QuidToServer from '../../models/quidToServer';
import Server from '../../models/server';
import TemporaryStatIncrease from '../../models/temporaryStatIncrease';
import User from '../../models/user';
import UserToServer from '../../models/userToServer';
import { CurrentRegionType, StatIncreaseType } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { PlantEdibilityType, SpeciesDietType } from '../../typings/main';
import { hasName, hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid } from '../../utils/checkValidity';
import { disableAllComponents } from '../../utils/componentDisabling';
import { getDisplayname, getDisplayspecies, pronoun, pronounAndPlural } from '../../utils/getQuidInfo';
import { capitalize, keyInObject, respond } from '../../utils/helperFunctions';
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
	sendAutocomplete: async (interaction, { quidToServer }) => {

		if (!quidToServer) { return; }
		const focusedValue = interaction.options.getFocused();
		let choices: string[] = [...new Set(quidToServer.inventory)].filter(i => !keyInObject(materialsInfo, i));

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

		if (quidToServer.hunger >= quidToServer.maxHunger) {

			// This is always a reply
			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setDescription(`*${quid.name}'s stomach bloats as ${pronounAndPlural(quid, 0, 'roll')} around camp, stuffing food into ${pronoun(quid, 2)} mouth. The ${getDisplayspecies(quid)} might need to take a break from food before ${pronounAndPlural(quid, 0, 'goes', 'go')} into a food coma.*`)],
			});
			return;
		}

		const chosenFood = interaction.options.getString('food');

		await sendEatMessage(interaction, chosenFood ?? '', user, quid, userToServer, quidToServer, server, messageContent, restEmbed);
	},
};

export async function sendEatMessage(
	interaction: ChatInputCommandInteraction<'cached'> | AnySelectMenuInteraction<'cached'>,
	chosenFood: string,
	user: User,
	quid: Quid<true>,
	userToServer: UserToServer,
	quidToServer: QuidToServer,
	server: Server,
	messageContent: string,
	restEmbed: EmbedBuilder[],
): Promise<void> {

	const embed = new EmbedBuilder()
		.setColor(quid.color)
		.setAuthor({
			name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
			iconURL: quid.avatarURL,
		});

	const mentionedUserMatch = chosenFood.match(FormattingPatterns.User);
	if (mentionedUserMatch) {

		const taggedDiscordUser = await DiscordUser.findByPk(interaction.user.id, {
			include: [{ model: User, as: 'user' }],
		}) ?? undefined;
		const taggedUser = taggedDiscordUser?.user;
		const taggedQuid: Quid | null = taggedUser?.lastGlobalActiveQuidId ? await Quid.findByPk(taggedUser.lastGlobalActiveQuidId) : null;

		if (hasName(taggedQuid)) {

			embed.setDescription(`*${quid.name} looks down at ${taggedQuid.name} as ${pronounAndPlural(taggedQuid, 0, 'nom')} on the ${getDisplayspecies(quid)}'s leg.* "No eating packmates here!" *${quid.name} chuckled, shaking off ${taggedQuid.name}.*`);

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

	if (keyInObject(allPlantsInfo, chosenFood)) {

		if (keyInObject(specialPlantsInfo, chosenFood)) {

			const statArray = ['health', 'energy', 'hunger', 'thirst'] as const;

			const pickIncreasedStatType = statArray[getRandomNumber(4)];
			if (pickIncreasedStatType === undefined) { throw new TypeError('pickIncreasedStatType is undefined'); }
			increasedStatType = pickIncreasedStatType;

			const pickIncreasedMaxStatType = ([StatIncreaseType.MaxHealth, StatIncreaseType.MaxEnergy, StatIncreaseType.MaxHunger, StatIncreaseType.MaxThirst] as const)[statArray.findIndex(v => v === increasedStatType)];
			if (pickIncreasedMaxStatType === undefined) { throw new TypeError('pickIncreasedMaxStatType is undefined'); }
			increasedMaxStatType = pickIncreasedMaxStatType;

			await TemporaryStatIncrease.create({ id: generateId(), type: increasedMaxStatType, startedTimestamp: Date.now(), quidToServerId: quidToServer.id });
		}

		if (server.inventory.filter(i => i === chosenFood).length <= 0) {

			// If this is a ChatInputCommand, this is a reply, else this is an update to the message with the component
			await sendNoItemMessage(embed, quid, chosenFood, interaction, messageContent, restEmbed);
			return;
		}
		server.inventory.splice(server.inventory.findIndex(i => i === chosenFood), 1);

		const foodDen = await Den.findByPk(server.foodDenId, { rejectOnEmpty: true });

		if (allPlantsInfo[chosenFood].edibility === PlantEdibilityType.Toxic) {

			finalHungerPoints = Math.max(-quidToServer.hunger, getRandomNumber(3, -5) - removeHungerPoints(foodDen));
			finalHealthPoints = Math.max(-quidToServer.health, getRandomNumber(3, -10));

			embed.setDescription(`*A yucky feeling drifts down ${quid.name}'s throat. ${capitalize(pronounAndPlural(quid, 0, 'shakes and spits', 'shake and spit'))} it out, trying to rid ${pronoun(quid, 2)} mouth of the taste. The plant is poisonous!*`);
		}

		if (allPlantsInfo[chosenFood].edibility === PlantEdibilityType.Inedible) {

			finalHungerPoints = Math.max(-quidToServer.hunger, getRandomNumber(3, -3) - removeHungerPoints(foodDen));

			embed.setDescription(`*${quid.name} slowly opens ${pronoun(quid, 2)} mouth and chomps onto the ${chosenFood}. The ${getDisplayspecies(quid)} swallows it, but ${pronoun(quid, 2)} face has a look of disgust. That wasn't very tasty!*`);
		}

		if (allPlantsInfo[chosenFood].edibility === PlantEdibilityType.Edible) {

			if (speciesInfo[quid.species].diet === SpeciesDietType.Carnivore) {

				finalHungerPoints = Math.max(-quidToServer.hunger, Math.min(quidToServer.maxHunger - quidToServer.hunger, addIncorrectDietHungerPoints() - removeHungerPoints(foodDen)));

				embed.setDescription(`*${quid.name} plucks a ${chosenFood} from the pack storage and nibbles away at it. It has a bitter, foreign taste, not the usual meaty meal the ${getDisplayspecies(quid)} prefers.*`);
			}
			else {

				finalHungerPoints = Math.min(quidToServer.maxHunger - quidToServer.hunger, addCorrectDietHungerPoints() - removeHungerPoints(foodDen));

				embed.setDescription(`*Leaves flutter into the storage den, landing near ${quid.name}'s feet. The ${getDisplayspecies(quid)} searches around the inventory determined to find the perfect meal, and that ${pronounAndPlural(quid, 0, 'does', 'do')}. ${quid.name} plucks a ${chosenFood} from the pile and eats until ${pronoun(quid, 2)} stomach is pleased.*`);
			}
		}

		if (allPlantsInfo[chosenFood].givesEnergy === true) {

			finalEnergyPoints = Math.min(quidToServer.maxEnergy - quidToServer.energy, 20);
		}

		if (allPlantsInfo[chosenFood].increasesMaxCondition === true) {

			if (finalHungerPoints < 0) { finalHungerPoints = 0; }

			embed.setDescription(`*${quid.name} decides to have a special treat today. Slowly, ${pronounAndPlural(quid, 0, 'chew')} on the ${chosenFood}, enjoying the fresh taste. It doesn't take long for the ${getDisplayspecies(quid)} to feel a special effect kick in: It's as if ${pronoun(quid, 0)} can have much more ${increasedStatType} than before. What an enchanting sensation!*`);
		}
	}
	else if (keyInObject(speciesInfo, chosenFood)) {

		if (server.inventory.filter(i => i === chosenFood).length <= 0) {

			// If this is a ChatInputCommand, this is a reply, else this is an update to the message with the component
			await sendNoItemMessage(embed, quid, chosenFood, interaction, messageContent, restEmbed);
			return;
		}
		server.inventory.splice(server.inventory.findIndex(i => i === chosenFood), 1);

		const foodDen = await Den.findByPk(server.foodDenId, { rejectOnEmpty: true });

		if (speciesInfo[quid.species].diet === SpeciesDietType.Herbivore) {

			finalHungerPoints = Math.max(-quidToServer.hunger, Math.min(quidToServer.maxHunger - quidToServer.hunger, addIncorrectDietHungerPoints() - removeHungerPoints(foodDen)));

			embed.setDescription(`*${quid.name} stands by the storage den, eyeing the varieties of food. A ${chosenFood} catches ${pronoun(quid, 2)} attention. The ${getDisplayspecies(quid)} walks over to it and begins to eat.* "This isn't very good!" *${quid.name} whispers to ${pronoun(quid, 4)} and leaves the den, stomach still growling, and craving for plants to grow.*`);
		}
		else {

			finalHungerPoints = Math.min(quidToServer.maxHunger - quidToServer.hunger, addCorrectDietHungerPoints() - removeHungerPoints(foodDen));

			embed.setDescription(`*${quid.name} sits chewing maliciously on a ${chosenFood}. A dribble of blood escapes out of ${pronoun(quid, 2)} jaw as the ${getDisplayspecies(quid)} finishes off the meal. It was a delicious feast, but very messy!*`);
		}
	}
	else {

		await showInventoryMessage(interaction, userToServer, quidToServer, server, 1, false);
		return;
	}

	const previousRegion = quidToServer.currentRegion;
	if (user.advice_eating === false) { await user.update({ advice_eating: true }); }
	await quidToServer.update({
		...{
			currentRegion: CurrentRegionType.FoodDen,
			hunger: quidToServer.hunger + finalHungerPoints,
			energy: quidToServer.energy + finalEnergyPoints,
			health: quidToServer.health + finalHealthPoints,
		},
		...(increasedMaxStatType ? { [increasedMaxStatType]: quidToServer[increasedMaxStatType] + 10 } : {}),
	});
	await server.update({ inventory: [...server.inventory] });

	footerText += `${finalHungerPoints >= 0 ? '+' : ''}${finalHungerPoints} hunger (${quidToServer.hunger}/${quidToServer.maxHunger})`;

	if (finalEnergyPoints !== 0) { footerText += `\n+${finalEnergyPoints} energy (${quidToServer.energy}/${quidToServer.maxHunger})`; }
	if (finalHealthPoints !== 0) { footerText += `\n${finalHealthPoints} health (${quidToServer.health}/${quidToServer.maxHealth})`; }
	if (increasedMaxStatType !== null && increasedStatType !== null) { footerText += `\n+10 maximum ${increasedStatType} (${quidToServer[increasedMaxStatType]}) for one week`; }
	if (previousRegion !== CurrentRegionType.FoodDen) { footerText += '\nYou are now at the food den'; }
	embed.setFooter({ text: `${footerText}\n\n${await wearDownDen(server, CurrentRegionType.FoodDen)}\n-1 ${chosenFood} for ${interaction.guild.name}` });

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
	quid: Quid,
	chosenFood: string,
	interaction: ChatInputCommandInteraction<'cached'> | AnySelectMenuInteraction<'cached'>,
	messageContent: string,
	restEmbed: EmbedBuilder[],
): Promise<void> {

	embed.setDescription(`*${quid.name} searches for a ${chosenFood} all over the pack, but couldn't find one...*`);

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
	foodDen: Den,
): number {

	const denStats = foodDen.structure + foodDen.bedding + foodDen.thickness + foodDen.evenness;
	const multiplier = denStats / 400;
	return 10 - Math.round(10 * multiplier);
}