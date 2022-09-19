import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, ModalBuilder, ModalSubmitInteraction, RestOrArray, SelectMenuBuilder, SelectMenuComponentOptionData, SelectMenuInteraction, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { getQuidDisplayname, respond, update } from '../../utils/helperFunctions';
import userModel from '../../models/userModel';
import { SlashCommand, speciesInfo, SpeciesNames, UserSchema } from '../../typedef';
import { hasName } from '../../utils/checkUserState';
import { createCommandComponentDisabler } from '../../utils/componentDisabling';
import { getMapData } from '../../utils/helperFunctions';
import { pronoun, upperCasePronoun } from '../../utils/getPronouns';

const speciesNameArray = (Object.keys(speciesInfo) as SpeciesNames[]).sort();

const name: SlashCommand['name'] = 'species';
const description: SlashCommand['description'] = 'Change your quid\'s species or displayed species.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.toJSON(),
	disablePreviousCommand: true,
	sendCommand: async (client, interaction, userData) => {

		if (!hasName(interaction, userData)) { return; }
		const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId || 'DM'));

		/* Define displayed species button */
		const displayedSpeciesButton = getDisplayedSpeciesButton(quidData._id);
		/* Define species select menu */
		const speciesMenu = getSpeciesSelectMenu(0, quidData._id);

		/* Define embeds */
		const newSpeciesEmbed = new EmbedBuilder()
			.setColor(quidData.color)
			.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId ?? ''), iconURL: quidData.avatarURL })
			.setTitle(`What species is ${quidData.name}?`)
			.setDescription('Choosing a species is only necessary for the RPG parts of the bot, and is **permanent**. If you want an earthly, extant species added that is not on the list, [use this form](https://github.com/MaksiRose/paw-and-paper/issues/new?assignees=&labels=improvement%2Cnon-code&template=species_request.yaml&title=New+species%3A+) to suggest it. Alternatively, you can choose a species that\'s similar and use the button below to change what species is displayed to be anything you want. You can change the displayed species as many times as you want.');
		const existingSpeciesEmbed = new EmbedBuilder()
			.setColor(quidData.color)
			.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId ?? ''), iconURL: quidData.avatarURL })
			.setDescription(`${quidData.name} is a ${quidData.displayedSpecies || quidData.species}! You cannot change ${pronoun(quidData, 2)} species, but you can create another quid via \`/profile\`. Alternatively, you can use the button below to change what species is displayed to be anything you want.`)
			.setFooter({ text: `Here is a list of species that you can choose when making a new quid: ${speciesNameArray.join(', ')}` });

		const botReply = await respond(interaction, {
			embeds: quidData.species === '' ? [newSpeciesEmbed] : [existingSpeciesEmbed],
			components: [
				...(quidData.species === '' ? [new ActionRowBuilder<SelectMenuBuilder>().setComponents([speciesMenu])] : []),
				new ActionRowBuilder<ButtonBuilder>().setComponents([displayedSpeciesButton]),
			],
		}, true);

		createCommandComponentDisabler(userData.uuid, interaction.guildId || 'DM', botReply);
	},
};

function getSpeciesSelectMenu(page: number, quidId: string): SelectMenuBuilder {

	let speciesMenuOptions: RestOrArray<SelectMenuComponentOptionData> = speciesNameArray.map(speciesName => ({ label: speciesName, value: `species_${speciesName}` }));

	if (speciesMenuOptions.length > 25) {

		speciesMenuOptions = speciesMenuOptions.splice(page * 24, 24);
		speciesMenuOptions.push({ label: 'Show more species options', value: `species_nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return new SelectMenuBuilder()
		.setCustomId(`species_speciesselect_${quidId}`)
		.setPlaceholder('Select a species')
		.setOptions(speciesMenuOptions);
}

function getDisplayedSpeciesButton(quidId: string): ButtonBuilder {

	return new ButtonBuilder()
		.setCustomId(`species_displayedspeciesmodal_${quidId}`)
		.setLabel('Change displayed species')
		.setEmoji('📝')
		.setStyle(ButtonStyle.Secondary);
}

export async function speciesInteractionCollector(
	interaction: ButtonInteraction | SelectMenuInteraction,
	userData: UserSchema | null,
): Promise<void> {

	const selectOptionId = interaction.isSelectMenu() ? interaction.values[0] : undefined;

	if (interaction.isButton() && interaction.customId.includes('displayedspeciesmodal')) {

		if (userData === null) { throw new Error('userData is null'); }
		const quidId = interaction.customId.split('_')[2] || '';
		const quidData = getMapData(userData.quids, quidId);

		await interaction
			.showModal(new ModalBuilder()
				.setCustomId(`species_${quidData._id}`)
				.setTitle('Change displayed species')
				.setComponents(
					new ActionRowBuilder<TextInputBuilder>()
						.setComponents([new TextInputBuilder()
							.setCustomId('species_textinput')
							.setLabel('Displayed species')
							.setStyle(TextInputStyle.Short)
							.setMaxLength(24)
							.setValue(quidData.displayedSpecies),
						]),
				),
			);
		return;
	}

	if (interaction.isSelectMenu() && selectOptionId && selectOptionId.includes('nextpage')) {

		/* Getting the quidId from the customId */
		const quidId = interaction.customId.split('_')[2] || '';

		/* Getting the speciesPage from the value Id, incrementing it by one or setting it to zero if the page number is bigger than the total amount of pages. */
		let speciesPage = Number(selectOptionId.split('_')[2]) + 1;
		if (speciesPage >= Math.ceil(speciesNameArray.length / 24)) { speciesPage = 0; }

		await update(interaction, {
			components: [
				new ActionRowBuilder<SelectMenuBuilder>().setComponents([getSpeciesSelectMenu(speciesPage, quidId)]),
				new ActionRowBuilder<ButtonBuilder>().setComponents([getDisplayedSpeciesButton(quidId)]),
			],
		});
		return;
	}

	if (interaction.isSelectMenu() && selectOptionId && (selectOptionId.split('_')[1] || '') in speciesInfo) {

		/* Getting the quidId from the customId */
		const quidId = interaction.customId.split('_')[2] || '';
		/* Getting the species from the value */
		const chosenSpecies = selectOptionId.split('_')[1] as SpeciesNames;

		userData = await userModel.findOneAndUpdate(
			u => u.uuid === userData?.uuid,
			(u) => {
				const q = getMapData(u.quids, quidId);
				q.species = chosenSpecies;
			},
		);
		const quidData = getMapData(userData.quids, quidId);

		await update(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(quidData.color)
				.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId ?? ''), iconURL: quidData.avatarURL })
				.setDescription(`*A stranger carefully steps over the pack's borders. ${upperCasePronoun(quidData, 2)} face seems friendly. Curious eyes watch ${pronoun(quidData, 1)} as ${pronoun(quidData, 0)} come close to the Alpha.* "Welcome," *the Alpha says.* "What is your name?" \n"${quidData.name}," *the ${chosenSpecies} responds. The Alpha takes a friendly step towards ${pronoun(quidData, 1)}.* "It's nice to have you here, ${quidData.name}," *they say. More and more packmates come closer to greet the newcomer.*`)
				.setFooter({ text: 'You are now done setting up your quid for RPGing! Type "/profile" to look at it.\nWith "/help" you can see how else you can customize your profile, as well as your other options.\nYou can use the button below to change your displayed species.' })],
			components: [
				new ActionRowBuilder<ButtonBuilder>().setComponents([getDisplayedSpeciesButton(quidId)]),
			],
		});

		await interaction.message.channel
			.send({
				content: `${interaction.user.toString()} ❓ **Tip:**\nGo playing via \`/play\` to find quests and rank up!`,
			});
		return;
	}
}

export async function sendEditDisplayedSpeciesModalResponse(
	interaction: ModalSubmitInteraction,
	userData: UserSchema | null,
): Promise<void> {

	const quidId = interaction.customId.split('_')[1] || '';
	const displayedSpecies = interaction.fields.getTextInputValue('species_textinput');

	userData = await userModel.findOneAndUpdate(
		u => u.uuid === userData?.uuid,
		(u) => {
			const q = getMapData(u.quids, quidId);
			q.displayedSpecies = displayedSpecies;
		},
	);
	const quidData = getMapData(userData.quids, quidId);

	await respond(interaction, {
		embeds: [new EmbedBuilder()
			.setColor(quidData.color)
			.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId ?? ''), iconURL: quidData.avatarURL })
			.setTitle(displayedSpecies === '' ? 'Successfully removed your displayed species!' : `Successfully changed displayed species to ${displayedSpecies}!`)],
	}, false);
	return;
}