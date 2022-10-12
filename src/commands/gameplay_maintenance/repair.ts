import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, InteractionReplyOptions, SelectMenuBuilder, SelectMenuInteraction, SlashCommandBuilder, WebhookEditMessageOptions } from 'discord.js';
import serverModel from '../../models/serverModel';
import { MaterialNames, materialsInfo, Profile, Quid, RankType, ServerSchema, SlashCommand, UserSchema } from '../../typedef';
import { drinkAdvice, eatAdvice, restAdvice } from '../../utils/adviceMessages';
import { changeCondition } from '../../utils/changeCondition';
import { hasName, hasSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid, isPassedOut } from '../../utils/checkValidity';
import { createCommandComponentDisabler, disableAllComponents } from '../../utils/componentDisabling';
import getInventoryElements from '../../utils/getInventoryElements';
import { pronoun } from '../../utils/getPronouns';
import { getArrayElement, getMapData, getQuidDisplayname, getSmallerNumber, respond, update } from '../../utils/helperFunctions';
import { checkLevelUp } from '../../utils/levelHandling';
import { getRandomNumber, pullFromWeightedTable } from '../../utils/randomizers';
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
	sendCommand: async (client, interaction, userData, serverData, embedArray) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (!isInGuild(interaction)) { return; }
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!hasName(interaction, userData)) { return; }

		/* Gets the current active quid and the server profile from the account */
		const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId));
		const profileData = getMapData(quidData.profiles, interaction.guildId);
		if (!hasSpecies(interaction, quidData)) { return; }

		/* Checks if the profile is on a cooldown or passed out. */
		if (await isInvalid(interaction, userData, quidData, profileData, embedArray)) { return; }

		const messageContent = remindOfAttack(interaction.guildId);

		if (profileData.rank === RankType.Youngling) {

			await respond(interaction, {
				content: messageContent,
				embeds: [...embedArray, new EmbedBuilder()
					.setColor(quidData.color)
					.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId), iconURL: quidData.avatarURL })
					.setDescription(`*A hunter rushes to stop the ${profileData.rank}.*\n"${quidData.name}, you are not trained to repair dens, it is very dangerous! You should be playing on the prairie instead."\n*${quidData.name} lowers ${pronoun(quidData, 2)} head and leaves in shame.*`)],
			}, true);
			return;
		}

		if (Object.values(serverData.inventory.materials).filter(value => value > 0).length <= 0) {

			await respond(interaction, {
				content: messageContent,
				embeds: [...embedArray, new EmbedBuilder()
					.setColor(quidData.color)
					.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId), iconURL: quidData.avatarURL })
					.setDescription(`*${quidData.name} goes to look if any dens need to be repaired. But it looks like the pack has nothing that can be used to repair dens in the first place. Looks like the ${quidData.displayedSpecies || quidData.species} needs to go out and find materials first!*`)
					.setFooter({ text: 'Materials can be found through scavenging and adventuring.' })],
			}, true);
			return;
		}

		const chosenDen = interaction.options.getString('den');

		const botReply = await respond(interaction, (chosenDen !== 'sleepingDens' && chosenDen !== 'medicineDen' && chosenDen !== 'foodDen') ? {
			content: messageContent,
			embeds: [...embedArray, new EmbedBuilder()
				.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId), iconURL: quidData.avatarURL })
				.setColor(quidData.color)
				.setDescription(`*${quidData.name} roams around the pack, looking if any dens need to be repaired.*`)],
			components: [denSelectMenu],
		} : getMaterials(userData, quidData, serverData, chosenDen, embedArray, messageContent), true);

		createCommandComponentDisabler(userData._id, interaction.guildId, botReply);
	},
};

export async function repairInteractionCollector(
	interaction: ButtonInteraction | SelectMenuInteraction,
	userData: UserSchema | null,
	serverData: ServerSchema | null,
): Promise<void> {

	if (!interaction.inCachedGuild()) { throw new Error('Interaction is not in cached guild'); }
	if (serverData === null) { throw new TypeError('serverData is null'); }
	if (userData === null) { throw new TypeError('userData is null'); }

	/* Gets the current active quid and the server profile from the account */
	const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId));
	let profileData = getMapData(quidData.profiles, interaction.guildId);

	if (interaction.isButton()) {

		const chosenDen = interaction.customId.replace('repair_', '');
		if (chosenDen !== 'sleepingDens' && chosenDen !== 'medicineDen' && chosenDen !== 'foodDen') { throw new Error('chosenDen is not a den'); }

		await update(interaction, getMaterials(userData, quidData, serverData, chosenDen, [], ''));
		return;
	}

	if (interaction.isSelectMenu()) {

		const chosenDen = interaction.customId.replace('repair_options_', '');
		if (chosenDen !== 'sleepingDens' && chosenDen !== 'medicineDen' && chosenDen !== 'foodDen') { throw new Error('chosenDen is not a den'); }

		const chosenItem = getArrayElement(interaction.values, 0) as MaterialNames;

		const repairKind = materialsInfo[chosenItem].reinforcesStructure ? 'structure' : materialsInfo[chosenItem].improvesBedding ? 'bedding' : materialsInfo[chosenItem].thickensWalls ? 'thickness' : materialsInfo[chosenItem].removesOverhang ? 'evenness' : undefined;
		if (repairKind === undefined) { throw new TypeError('repairKind is undefined'); }

		const repairAmount = getSmallerNumber(addMaterialPoints(), 100 - serverData.dens[chosenDen][repairKind]);

		/** True when the repairAmount is bigger than zero. If the user isn't of  rank Hunter or Elderly, a weighted table decided whether they are successful. */
		const isSuccessful = repairAmount > 0 && !isUnlucky(profileData);

		serverData = await serverModel.findOneAndUpdate(
			s => s.serverId === serverData!.serverId,
			(s) => {
				s.inventory.materials[chosenItem] -= 1;
				if (isSuccessful) { s.dens[chosenDen][repairKind] += repairAmount; }
			},
		);

		const experiencePoints = isSuccessful === false ? 0 : profileData.rank == RankType.Elderly ? getRandomNumber(41, 20) : profileData.rank == RankType.Healer ? getRandomNumber(21, 10) : getRandomNumber(11, 5);
		const changedCondition = await changeCondition(userData, quidData, profileData, experiencePoints);
		profileData = changedCondition.profileData;

		const levelUpCheck = await checkLevelUp(interaction, userData, quidData, profileData, serverData);
		profileData = levelUpCheck.profileData;

		const denName = chosenDen.split(/(?=[A-Z])/).join(' ').toLowerCase();

		await update(interaction, {
			embeds: [
				new EmbedBuilder()
					.setColor(quidData.color)
					.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId), iconURL: quidData.avatarURL })
					.setDescription(`*${quidData.name} takes a ${chosenItem} and tries to ${repairKind === 'structure' ? 'tuck it into parts of the walls and ceiling that look less stable.' : repairKind === 'bedding' ? 'spread it over parts of the floor that look harsh and rocky.' : repairKind === 'thickness' ? 'cover parts of the walls that look a little thin with it.' : 'drag it over parts of the walls with bumps and material sticking out.'} ` + (isSuccessful ? `Immediately you can see the ${repairKind} of the den improving. What a success!*` : `After a few attempts, the material breaks into little pieces, rendering it useless. Looks like the ${quidData.displayedSpecies || quidData.species} has to try again...*`))
					.setFooter({ text: `${changedCondition.statsUpdateText}\n\n-1 ${chosenItem} for ${interaction.guild.name}\n${isSuccessful ? `+${repairAmount}% ${repairKind} for ${denName} (${serverData.dens[chosenDen][repairKind]}%  total)` : ''}` }),
				...(changedCondition.injuryUpdateEmbed ? [changedCondition.injuryUpdateEmbed] : []),
				...(levelUpCheck.levelUpEmbed ? [levelUpCheck.levelUpEmbed] : []),
			],
			components: disableAllComponents(interaction.message.components),
		});

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
	userData: UserSchema,
	quidData: Quid<true>,
	serverData: ServerSchema,
	chosenDen: 'sleepingDens' | 'foodDen' | 'medicineDen',
	embedArray: EmbedBuilder[],
	messageContent: string,
): Omit<InteractionReplyOptions & WebhookEditMessageOptions, 'flags'> {

	const { selectMenuOptions, embedDescription: description } = getInventoryElements(serverData.inventory, 4);

	return {
		content: messageContent,
		embeds: [
			...embedArray,
			new EmbedBuilder()
				.setAuthor({ name: getQuidDisplayname(userData, quidData, serverData.serverId), iconURL: quidData.avatarURL })
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

export function addMaterialPoints() { return getRandomNumber(5, 6); }

export function isUnlucky(
	profileData: Profile,
): boolean { return profileData.rank !== RankType.Hunter && profileData.rank !== RankType.Elderly && pullFromWeightedTable({ 0: profileData.rank === RankType.Healer ? 90 : 40, 1: 60 + profileData.sapling.waterCycles }) === 0; }