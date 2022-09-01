import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, InteractionReplyOptions, MessageComponentInteraction, SelectMenuBuilder, SlashCommandBuilder, WebhookEditMessageOptions } from 'discord.js';
import serverModel from '../../models/serverModel';
import { MaterialNames, materialsInfo, Quid, RankType, ServerSchema, SlashCommand, UserSchema } from '../../typedef';
import { drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { changeCondition } from '../../utils/changeCondition';
import { hasCompletedAccount, isInGuild } from '../../utils/checkUserState';
import { isInvalid, isPassedOut } from '../../utils/checkValidity';
import { createCommandComponentDisabler, disableAllComponents } from '../../utils/componentDisabling';
import getInventoryElements from '../../utils/getInventoryElements';
import { pronoun } from '../../utils/getPronouns';
import { getMapData, getSmallerNumber, respond } from '../../utils/helperFunctions';
import { checkLevelUp } from '../../utils/levelHandling';
import { generateRandomNumber, pullFromWeightedTable } from '../../utils/randomizers';
import { remindOfAttack } from '../gameplay_primary/attack';

const denSelectMenu = new ActionRowBuilder<ButtonBuilder>()
	.addComponents([new ButtonBuilder()
		.setCustomId('repair_sleepingDens')
		.setLabel('Sleeping Dens')
		.setStyle(ButtonStyle.Secondary),
	new ButtonBuilder()
		.setCustomId('repair_foodDen')
		.setLabel('Food Den')
		.setStyle(ButtonStyle.Secondary),
	new ButtonBuilder()
		.setCustomId('repair_medicineDen')
		.setLabel('Medicine Den')
		.setStyle(ButtonStyle.Secondary)]);

const name: SlashCommand['name'] = 'repair';
const description: SlashCommand['description'] = 'Repair dens. Costs energy, but gives XP.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.addStringOption(option =>
			option.setName('den')
				.setDescription('The den that you want to repair')
				.addChoices({ name: 'sleeping dens', value: 'sleepingDens' }, { name: 'food den', value: 'foodDen' }, { name: 'medicine den', value: 'medicineDen' })
				.setRequired(false))
		.setDMPermission(false)
		.toJSON(),
	disablePreviousCommand: true,
	sendCommand: async (client, interaction, userData, serverData, embedArray) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (!isInGuild(interaction)) { return; }
		if (!serverData) { throw new Error('serverData is null'); }
		if (!hasCompletedAccount(interaction, userData)) { return; }

		/* Gets the current active quid and the server profile from the account */
		const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId));
		const profileData = getMapData(quidData.profiles, interaction.guildId);

		/* Checks if the profile is on a cooldown or passed out. */
		if (await isInvalid(interaction, userData, quidData, profileData, embedArray, name)) { return; }

		const messageContent = remindOfAttack(interaction.guildId);

		if (profileData.rank === RankType.Youngling) {

			await respond(interaction, {
				content: messageContent,
				embeds: [...embedArray, new EmbedBuilder()
					.setColor(quidData.color)
					.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL })
					.setDescription(`*A hunter rushes to stop the ${profileData.rank}.*\n"${quidData.name}, you are not trained to repair dens, it is very dangerous! You should be playing on the prairie instead."\n*${quidData.name} lowers ${pronoun(quidData, 2)} head and leaves in shame.*`)],
			}, true)
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		if (Object.values(serverData.inventory.materials).filter(value => value > 0).length <= 0) {

			await respond(interaction, {
				content: messageContent,
				embeds: [...embedArray, new EmbedBuilder()
					.setColor(quidData.color)
					.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL })
					.setDescription(`*${quidData.name} goes to look if any dens need to be repaired. But it looks like the pack has nothing that can be used to repair dens in the first place. Looks like the ${quidData.displayedSpecies || quidData.species} needs to go out and find materials first!*`)
					.setFooter({ text: 'Materials can be found through scavenging and adventuring.' })],
			}, true)
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		const chosenDen = interaction.options.getString('den');

		const botReply = await respond(interaction, (chosenDen !== 'sleepingDens' && chosenDen !== 'medicineDen' && chosenDen !== 'foodDen') ? {
			content: messageContent,
			embeds: [...embedArray, new EmbedBuilder()
				.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL })
				.setColor(quidData.color)
				.setDescription(`*${quidData.name} roams around the pack, looking if any dens need to be repaired.*`)],
			components: [denSelectMenu],
		} : getMaterials(quidData, serverData, chosenDen, embedArray, messageContent), true)
			.catch((error) => { throw new Error(error); });

		createCommandComponentDisabler(userData.uuid, interaction.guildId, botReply);
	},
};

export async function repairInteractionCollector(
	interaction: MessageComponentInteraction,
	userData: UserSchema | null,
	serverData: ServerSchema | null,
): Promise<void> {

	if (!interaction.inCachedGuild()) { throw new Error('Interaction is not in cached guild'); }
	if (!serverData) { throw new TypeError('serverData is null'); }
	if (!userData) { throw new TypeError('userData is null'); }

	/* Gets the current active quid and the server profile from the account */
	const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId));
	const profileData = getMapData(quidData.profiles, interaction.guildId);

	if (interaction.isButton()) {

		const chosenDen = interaction.customId.replace('repair_', '');
		if (chosenDen !== 'sleepingDens' && chosenDen !== 'medicineDen' && chosenDen !== 'foodDen') { throw new Error('chosenDen is not a den'); }


		await interaction
			.update(getMaterials(quidData, serverData, chosenDen, [], null))
			.catch((error) => { throw new Error(error); });
		return;
	}

	if (interaction.isSelectMenu()) {

		const chosenDen = interaction.customId.replace('repair_options_', '');
		if (chosenDen !== 'sleepingDens' && chosenDen !== 'medicineDen' && chosenDen !== 'foodDen') { throw new Error('chosenDen is not a den'); }

		const chosenItem = interaction.values[0] as MaterialNames | undefined;
		if (!chosenItem) { throw new TypeError('chosenItem is undefined'); }

		const repairKind = materialsInfo[chosenItem].reinforcesStructure ? 'structure' : materialsInfo[chosenItem].improvesBedding ? 'bedding' : materialsInfo[chosenItem].thickensWalls ? 'thickness' : materialsInfo[chosenItem].removesOverhang ? 'evenness' : undefined;
		if (!repairKind) { throw new TypeError('repairKind is undefined'); }

		const repairAmount = getSmallerNumber(generateRandomNumber(5, 6), 100 - serverData.dens[chosenDen][repairKind]);

		/** True when the repairAmount is bigger than zero. If the user isn't of  rank Hunter or Elderly, a weighted table decided whether they are successful. */
		const isSuccessful = repairAmount > 0 && (profileData.rank === RankType.Hunter || profileData.rank === RankType.Elderly || pullFromWeightedTable({ 0: profileData.rank === RankType.Healer ? 90 : 40, 1: 60 + profileData.sapling.waterCycles }) === 1);

		await serverModel.findOneAndUpdate(
			s => s.serverId === serverData.serverId,
			(s) => {
				s.inventory.materials[chosenItem] -= 1;
				if (isSuccessful) { s.dens[chosenDen][repairKind] += repairAmount; }
			},
		);

		const experiencePoints = isSuccessful === false ? 0 : profileData.rank == RankType.Elderly ? generateRandomNumber(41, 20) : profileData.rank == RankType.Healer ? generateRandomNumber(21, 10) : generateRandomNumber(11, 5);
		const changedCondition = await changeCondition(userData, quidData, profileData, experiencePoints);
		const levelUpEmbed = (await checkLevelUp(interaction, userData, quidData, profileData, serverData)).levelUpEmbed;

		const denName = chosenDen.split(/(?=[A-Z])/).join(' ').toLowerCase();

		await interaction
			.update({
				embeds: [
					new EmbedBuilder()
						.setColor(quidData.color)
						.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL })
						.setDescription(`*${quidData.name} takes a ${chosenItem} and tries to ${repairKind === 'structure' ? 'tuck it into parts of the walls and ceiling that look less stable.' : repairKind === 'bedding' ? 'spread it over parts of the floor that look harsh and rocky.' : repairKind === 'thickness' ? 'cover parts of the walls that look a little thin with it.' : 'drag it over parts of the walls with bumps and material sticking out.'} ` + (isSuccessful ? `Immediately you can see the ${repairKind} of the den improving. What a success!*` : `After a few attempts, the material breaks into little pieces, rendering it useless. Looks like the ${quidData.displayedSpecies || quidData.species} has to try again...*`))
						.setFooter({ text: `${changedCondition.statsUpdateText}\n\n-1 ${chosenItem} for ${interaction.guild.name}\n${isSuccessful ? `+${repairAmount}% ${repairKind} for ${denName} (${serverData.dens[chosenDen][repairKind]}%  total)` : ''}` }),
					...(changedCondition.injuryUpdateEmbed ? [changedCondition.injuryUpdateEmbed] : []),
					...(levelUpEmbed ? [levelUpEmbed] : []),
				],
				components: disableAllComponents(interaction.message.components.map(component => component.toJSON())),
			})
			.catch((error) => { throw new Error(error); });

		await isPassedOut(interaction, userData, quidData, profileData, true);

		await restAdvice(interaction, userData, profileData);
		await drinkAdvice(interaction, userData, profileData);
		await eatAdvice(interaction, userData, profileData);
	}
}

/**
 * Displays the condition of the currently chosen den, as well as a list of the packs materials.
 */
function getMaterials(
	quidData: Quid,
	serverData: ServerSchema,
	chosenDen: 'sleepingDens' | 'foodDen' | 'medicineDen',
	embedArray: EmbedBuilder[],
	messageContent: string | null,
): Omit<InteractionReplyOptions & WebhookEditMessageOptions, 'flags'> {

	const { selectMenuOptions, embedDescription: description } = getInventoryElements(serverData.inventory, 4);

	return {
		content: messageContent,
		embeds: [
			...embedArray,
			new EmbedBuilder()
				.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL })
				.setColor(quidData.color)
				.setDescription(`*${quidData.name} patrols around the den, looking for anything that has to be repaired. The condition isn't perfect, and reinforcing it would definitely improve its quality. But what would be the best way?*`)
				.setFooter({ text: `Structure: ${serverData.dens[chosenDen].structure}%\nBedding: ${serverData.dens[chosenDen].bedding}%\nThickness: ${serverData.dens[chosenDen].thickness}%\nEvenness: ${serverData.dens[chosenDen].evenness}%` }),
			new EmbedBuilder()
				.setColor(quidData.color)
				.setTitle(`Inventory of ${serverData.name} - Materials`)
				.setDescription(description)
				.setFooter({ text: 'Choose one of the materials above to repair the den with it!' }),
		],
		components: [
			denSelectMenu,
			...selectMenuOptions.length > 0
				? [new ActionRowBuilder<SelectMenuBuilder>()
					.setComponents(new SelectMenuBuilder()
						.setCustomId(`repair_options_${chosenDen}`)
						.setPlaceholder('Select an item to repair the den with')
						.addOptions(selectMenuOptions))]
				: [],
		],
	};
}