import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, InteractionReplyOptions, SelectMenuBuilder, SelectMenuInteraction, SlashCommandBuilder, WebhookEditMessageOptions } from 'discord.js';
import { materialsInfo } from '../..';
import serverModel from '../../models/serverModel';
import { MaterialNames } from '../../typings/data/general';
import { ServerSchema } from '../../typings/data/server';
import { RankType, UserData } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { changeCondition } from '../../utils/changeCondition';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid, isPassedOut } from '../../utils/checkValidity';
import { createCommandComponentDisabler, disableAllComponents } from '../../utils/componentDisabling';
import getInventoryElements from '../../utils/getInventoryElements';
import { getArrayElement, getSmallerNumber, respond, update } from '../../utils/helperFunctions';
import { checkLevelUp } from '../../utils/levelHandling';
import { missingPermissions } from '../../utils/permissionHandler';
import { getRandomNumber, pullFromWeightedTable } from '../../utils/randomizers';
import { remindOfAttack } from '../gameplay_primary/attack';

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('repair')
		.setDescription('Improve a den\'s functionality. Not available to Younglings. Less effective as Apprentice or Healer.')
		.addStringOption(option =>
			option.setName('den')
				.setDescription('The den that you want to repair')
				.addChoices({ name: 'sleeping dens', value: 'sleepingDens' }, { name: 'food den', value: 'foodDen' }, { name: 'medicine den', value: 'medicineDen' })
				.setRequired(false))
		.setDMPermission(false)
		.toJSON(),
	category: 'page3',
	position: 8,
	disablePreviousCommand: true,
	modifiesServerProfile: true,
	sendCommand: async (interaction, userData, serverData) => {

		if (await missingPermissions(interaction, [
			'ViewChannel', // Needed because of createCommandComponentDisabler
		]) === true) { return; }

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
					.setDescription(`*A hunter rushes to stop the ${userData.quid.profile.rank}.*\n"${userData.quid.name}, you are not trained to repair dens, it is very dangerous! You should be playing on the prairie instead."\n*${userData.quid.name} lowers ${userData.quid.pronoun(2)} head and leaves in shame.*`)],
			}, true);
			return;
		}

		if (Object.values(serverData.inventory.materials).filter(value => value > 0).length <= 0) {

			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(userData.quid.color)
					.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
					.setDescription(`*${userData.quid.name} goes to look if any dens need to be repaired. But it looks like the pack has nothing that can be used to repair dens in the first place. Looks like the ${userData.quid.getDisplayspecies()} needs to go out and find materials first!*`)
					.setFooter({ text: 'Materials can be found through scavenging and adventuring.' })],
			}, true);
			return;
		}

		const chosenDen = interaction.options.getString('den');

		const botReply = await respond(interaction, (chosenDen !== 'sleepingDens' && chosenDen !== 'medicineDen' && chosenDen !== 'foodDen') ? {
			content: messageContent,
			embeds: [...restEmbed, new EmbedBuilder()
				.setColor(userData.quid.color)
				.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
				.setDescription(`*${userData.quid.name} roams around the pack, looking if any dens need to be repaired.*`)],
			components: [getDenButtons(userData._id)],
		} : getMaterials(userData, serverData, chosenDen, restEmbed, messageContent), true);

		createCommandComponentDisabler(userData._id, interaction.guildId, botReply);
	},
};

export async function repairInteractionCollector(
	interaction: ButtonInteraction | SelectMenuInteraction,
	userData: UserData<undefined, ''> | null,
	serverData: ServerSchema | null,
): Promise<void> {

	/* This ensures that the user is in a guild and has a completed account. */
	if (serverData === null) { throw new Error('serverData is null'); }
	if (!isInGuild(interaction) || !hasNameAndSpecies(userData, interaction)) { return; }

	if (interaction.isButton()) {

		const chosenDen = getArrayElement(interaction.customId.split('_'), 1);
		if (chosenDen !== 'sleepingDens' && chosenDen !== 'medicineDen' && chosenDen !== 'foodDen') { throw new Error('chosenDen is not a den'); }

		await update(interaction, getMaterials(userData, serverData, chosenDen, [], ''));
		return;
	}

	if (interaction.isSelectMenu()) {

		const chosenDen = getArrayElement(interaction.customId.split('_'), 2);
		if (chosenDen !== 'sleepingDens' && chosenDen !== 'medicineDen' && chosenDen !== 'foodDen') { throw new Error('chosenDen is not a den'); }

		const chosenItem = getArrayElement(interaction.values, 0) as MaterialNames;

		const repairKind = materialsInfo[chosenItem].reinforcesStructure ? 'structure' : materialsInfo[chosenItem].improvesBedding ? 'bedding' : materialsInfo[chosenItem].thickensWalls ? 'thickness' : materialsInfo[chosenItem].removesOverhang ? 'evenness' : undefined;
		if (repairKind === undefined) { throw new TypeError('repairKind is undefined'); }

		const repairAmount = getSmallerNumber(addMaterialPoints(), 100 - serverData.dens[chosenDen][repairKind]);

		/** True when the repairAmount is bigger than zero. If the user isn't of  rank Hunter or Elderly, a weighted table decided whether they are successful. */
		const isSuccessful = repairAmount > 0 && !isUnlucky(userData);

		serverData = await serverModel.findOneAndUpdate(
			s => s.serverId === serverData!.serverId,
			(s) => {
				s.inventory.materials[chosenItem] -= 1;
				if (isSuccessful) { s.dens[chosenDen][repairKind] += repairAmount; }
			},
		);

		const experiencePoints = isSuccessful === false ? 0 : userData.quid.profile.rank == RankType.Elderly ? getRandomNumber(41, 20) : userData.quid.profile.rank == RankType.Healer ? getRandomNumber(21, 10) : getRandomNumber(11, 5);
		const changedCondition = await changeCondition(userData, experiencePoints);
		const levelUpEmbed = await checkLevelUp(interaction, userData, serverData);

		const denName = chosenDen.split(/(?=[A-Z])/).join(' ').toLowerCase();

		await update(interaction, {
			embeds: [
				new EmbedBuilder()
					.setColor(userData.quid.color)
					.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
					.setDescription(`*${userData.quid.name} takes a ${chosenItem} and tries to ${repairKind === 'structure' ? 'tuck it into parts of the walls and ceiling that look less stable.' : repairKind === 'bedding' ? 'spread it over parts of the floor that look harsh and rocky.' : repairKind === 'thickness' ? 'cover parts of the walls that look a little thin with it.' : 'drag it over parts of the walls with bumps and material sticking out.'} ` + (isSuccessful ? `Immediately you can see the ${repairKind} of the den improving. What a success!*` : `After a few attempts, the material breaks into little pieces, rendering it useless. Looks like the ${userData.quid.getDisplayspecies()} has to try again...*`))
					.setFooter({ text: `${changedCondition.statsUpdateText}\n\n-1 ${chosenItem} for ${interaction.guild.name}\n${isSuccessful ? `+${repairAmount}% ${repairKind} for ${denName} (${serverData.dens[chosenDen][repairKind]}%  total)` : ''}` }),
				...changedCondition.injuryUpdateEmbed,
				...levelUpEmbed,
			],
			components: disableAllComponents(interaction.message.components),
		});

		await isPassedOut(interaction, userData, true);

		await restAdvice(interaction, userData);
		await drinkAdvice(interaction, userData);
		await eatAdvice(interaction, userData);
	}
}

function getDenButtons(
	_id: string,
) {

	return new ActionRowBuilder<ButtonBuilder>()
		.addComponents([new ButtonBuilder()
			.setCustomId(`repair_sleepingDens_@${_id}`)
			.setLabel('Sleeping Dens')
			.setStyle(ButtonStyle.Secondary),
		new ButtonBuilder()
			.setCustomId(`repair_foodDen_@${_id}`)
			.setLabel('Food Den')
			.setStyle(ButtonStyle.Secondary),
		new ButtonBuilder()
			.setCustomId(`repair_medicineDen@${_id}`)
			.setLabel('Medicine Den')
			.setStyle(ButtonStyle.Secondary)]);
}

/**
 * Displays the condition of the currently chosen den, as well as a list of the packs materials.
 */
function getMaterials(
	userData: UserData<never, never>,
	serverData: ServerSchema,
	chosenDen: 'sleepingDens' | 'foodDen' | 'medicineDen',
	restEmbed: EmbedBuilder[],
	messageContent: string,
): Omit<InteractionReplyOptions & WebhookEditMessageOptions, 'flags'> {

	const { selectMenuOptions, embedDescription: description } = getInventoryElements(serverData.inventory, 4);

	return {
		content: messageContent,
		embeds: [
			...restEmbed,
			new EmbedBuilder()
				.setColor(userData.quid.color)
				.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
				.setDescription(`*${userData.quid.name} patrols around the den, looking for anything that has to be repaired. The condition isn't perfect, and reinforcing it would definitely improve its quality. But what would be the best way?*`)
				.setFooter({ text: `Structure: ${serverData.dens[chosenDen].structure}%\nBedding: ${serverData.dens[chosenDen].bedding}%\nThickness: ${serverData.dens[chosenDen].thickness}%\nEvenness: ${serverData.dens[chosenDen].evenness}%` }),
			new EmbedBuilder()
				.setColor(userData.quid.color)
				.setTitle(`Inventory of ${serverData.name} - Materials`)
				.setDescription(description)
				.setFooter({ text: 'Choose one of the materials above to repair the den with it!' }),
		],
		components: [
			getDenButtons(userData._id),
			...selectMenuOptions.length > 0
				? [new ActionRowBuilder<SelectMenuBuilder>()
					.setComponents(new SelectMenuBuilder()
						.setCustomId(`repair_options_${chosenDen}_@${userData._id}`)
						.setPlaceholder('Select an item to repair the den with')
						.addOptions(selectMenuOptions))]
				: [],
		],
	};
}

export function addMaterialPoints() { return getRandomNumber(5, 6); }

export function isUnlucky(
	userData: UserData<never, never>,
): boolean { return userData.quid.profile.rank !== RankType.Hunter && userData.quid.profile.rank !== RankType.Elderly && pullFromWeightedTable({ 0: userData.quid.profile.rank === RankType.Healer ? 90 : 40, 1: 60 + userData.quid.profile.sapling.waterCycles }) === 0; }