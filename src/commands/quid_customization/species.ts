import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, ModalBuilder, ModalSubmitInteraction, RestOrArray, SelectMenuBuilder, SelectMenuComponentOptionData, SelectMenuInteraction, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { capitalizeString, getArrayElement, respond, update } from '../../utils/helperFunctions';
import { hasName } from '../../utils/checkUserState';
import { createCommandComponentDisabler } from '../../utils/componentDisabling';
import { getMapData } from '../../utils/helperFunctions';
import { missingPermissions } from '../../utils/permissionHandler';
import { speciesInfo } from '../..';
import { SpeciesNames } from '../../typings/data/general';
import { SlashCommand } from '../../typings/handle';
import userModel, { getUserData } from '../../models/userModel';

const speciesNameArray = (Object.keys(speciesInfo) as SpeciesNames[]).sort();

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('species')
		.setDescription('Change your quid\'s species or displayed species.')
		.toJSON(),
	category: 'page1',
	position: 1,
	disablePreviousCommand: true,
	modifiesServerProfile: false,
	sendCommand: async (interaction, userData) => {

		if (await missingPermissions(interaction, [
			'ViewChannel', // Needed because of createCommandComponentDisabler
		]) === true) { return; }

		if (!hasName(userData, interaction)) { return; }

		/* Define displayed species button */
		const displayedSpeciesButton = getDisplayedSpeciesButton(userData.quid._id);
		/* Define species select menu */
		const speciesMenu = getSpeciesSelectMenu(0, userData.quid._id);

		/* Define embeds */
		const newSpeciesEmbed = new EmbedBuilder()
			.setColor(userData.quid.color)
			.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
			.setTitle(`What species is ${userData.quid.name}?`)
			.setDescription('Choosing a species is only necessary for the RPG parts of the bot, and is **permanent**. If you want an earthly, extant species added that is not on the list, [use this form](https://github.com/MaksiRose/paw-and-paper/issues/new?assignees=&labels=improvement%2Cnon-code&template=species_request.yaml&title=New+species%3A+) to suggest it. Alternatively, you can choose a species that\'s similar and use the button below to change what species is displayed to be anything you want. You can change the displayed species as many times as you want.');
		const existingSpeciesEmbed = new EmbedBuilder()
			.setColor(userData.quid.color)
			.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
			.setDescription(`${userData.quid.name} is a ${userData.quid.getDisplayspecies()}! You cannot change ${userData.quid.pronoun(2)} species, but you can create another quid via \`/profile\`. Alternatively, you can use the button below to change what species is displayed to be anything you want.`)
			.setFooter({ text: `Here is a list of species that you can choose when making a new quid: ${speciesNameArray.join(', ')}` });

		const botReply = await respond(interaction, {
			embeds: userData.quid.species === '' ? [newSpeciesEmbed] : [existingSpeciesEmbed],
			components: [
				...(userData.quid.species === '' ? [new ActionRowBuilder<SelectMenuBuilder>().setComponents([speciesMenu])] : []),
				new ActionRowBuilder<ButtonBuilder>().setComponents([displayedSpeciesButton]),
			],
		}, true);

		createCommandComponentDisabler(userData._id, interaction.guildId || 'DM', botReply);
	},
};

function getSpeciesSelectMenu(page: number, quidId: string): SelectMenuBuilder {

	let speciesMenuOptions: RestOrArray<SelectMenuComponentOptionData> = speciesNameArray.map(speciesName => ({ label: speciesName, value: `species_${speciesName}` }));

	if (speciesMenuOptions.length > 25) {

		speciesMenuOptions = speciesMenuOptions.splice(page * 24, 24);
		speciesMenuOptions.push({ label: 'Show more species options', value: `species_nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return new SelectMenuBuilder()
		.setCustomId(`species_speciesselect_@${quidId}`)
		.setPlaceholder('Select a species')
		.setOptions(speciesMenuOptions);
}

function getDisplayedSpeciesButton(quidId: string): ButtonBuilder {

	return new ButtonBuilder()
		.setCustomId(`species_displayedspeciesmodal_@${quidId}`)
		.setLabel('Change displayed species')
		.setEmoji('📝')
		.setStyle(ButtonStyle.Secondary);
}

export async function speciesInteractionCollector(
	interaction: ButtonInteraction | SelectMenuInteraction,
): Promise<void> {

	if (await missingPermissions(interaction, [
		'ViewChannel', interaction.channel?.isThread() ? 'SendMessagesInThreads' : 'SendMessages', 'EmbedLinks', // Needed for channel.send call
	]) === true) { return; }

	const selectOptionId = interaction.isSelectMenu() ? interaction.values[0] : undefined;

	const quidId = getArrayElement(interaction.customId.split('_'), 2).replace('@', '');
	const _userData = await userModel.findOne(u => Object.keys(u.quids).includes(quidId));
	const userData = getUserData(_userData, interaction.guildId || 'DM', getMapData(_userData.quids, quidId));

	if (interaction.isButton() && interaction.customId.includes('displayedspeciesmodal')) {

		await interaction
			.showModal(new ModalBuilder()
				.setCustomId(`species_${userData.quid._id}`)
				.setTitle('Change displayed species')
				.setComponents(
					new ActionRowBuilder<TextInputBuilder>()
						.setComponents([new TextInputBuilder()
							.setCustomId('species_textinput')
							.setLabel('Displayed species')
							.setStyle(TextInputStyle.Short)
							.setMaxLength(24)
							.setValue(userData.quid.displayedSpecies),
						]),
				),
			);
		return;
	}

	if (interaction.isSelectMenu() && selectOptionId && selectOptionId.includes('nextpage')) {

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
		/* Getting the species from the value */
		const chosenSpecies = selectOptionId.split('_')[1] as SpeciesNames;

		await userData.update(
			(u) => {
				const q = getMapData(u.quids, quidId);
				q.species = chosenSpecies;
			},
		);

		await update(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(userData.quid.color)
				.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
				.setDescription(`*A stranger carefully steps over the pack's borders. ${ capitalizeString(userData.quid.pronoun(2))} face seems friendly. Curious eyes watch ${userData.quid.pronoun(1)} as ${userData.quid.pronoun(0)} come close to the Alpha.* "Welcome," *the Alpha says.* "What is your name?" \n"${userData.quid.name}," *the ${chosenSpecies} responds. The Alpha takes a friendly step towards ${userData.quid.pronoun(1)}.* "It's nice to have you here, ${userData.quid.name}," *they say. More and more packmates come closer to greet the newcomer.*`)
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
): Promise<void> {

	const quidId = getArrayElement(interaction.customId.split('_'), 1).replace('@', '');
	const _userData = await userModel.findOne(u => Object.keys(u.quids).includes(quidId));
	const userData = getUserData(_userData, interaction.guildId || 'DM', getMapData(_userData.quids, quidId));

	const displayedSpecies = interaction.fields.getTextInputValue('species_textinput');

	await userData.update(
		(u) => {
			const q = getMapData(u.quids, quidId);
			q.displayedSpecies = displayedSpecies;
		},
	);

	await respond(interaction, {
		embeds: [new EmbedBuilder()
			.setColor(userData.quid.color)
			.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
			.setTitle(displayedSpecies === '' ? 'Successfully removed your displayed species!' : `Successfully changed displayed species to ${displayedSpecies}!`)],
	}, false);
	return;
}