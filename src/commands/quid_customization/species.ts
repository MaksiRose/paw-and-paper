import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, RestOrArray, StringSelectMenuBuilder, SelectMenuComponentOptionData, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { capitalizeString, keyInObject, respond } from '../../utils/helperFunctions';
import { hasName } from '../../utils/checkUserState';
import { saveCommandDisablingInfo } from '../../utils/componentDisabling';
import { getMapData } from '../../utils/helperFunctions';
import { missingPermissions } from '../../utils/permissionHandler';
import { speciesInfo } from '../..';
import { SpeciesNames } from '../../typings/data/general';
import { SlashCommand } from '../../typings/handle';
import { constructCustomId, constructSelectOptions, deconstructCustomId, deconstructSelectOptions } from '../../utils/customId';

type CustomIdArgs = ['speciesselect' | 'displayedspeciesmodal'] | []
type SelectOptionArgs = [SpeciesNames] | ['nextpage', `${number}`]

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

		if (!hasName(userData, interaction)) { return; } // this would always be a reply

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

		// This is always a reply
		const botReply = await respond(interaction, {
			embeds: userData.quid.species === '' ? [newSpeciesEmbed] : [existingSpeciesEmbed],
			components: [
				...(userData.quid.species === '' ? [new ActionRowBuilder<StringSelectMenuBuilder>().setComponents([speciesMenu])] : []),
				new ActionRowBuilder<ButtonBuilder>().setComponents([displayedSpeciesButton]),
			],
		});

		saveCommandDisablingInfo(userData, interaction.guildId || 'DMs', interaction.channelId, botReply.id, interaction);
	},
	async sendMessageComponentResponse(interaction, userData) {

		if (await missingPermissions(interaction, [
			'ViewChannel', interaction.channel?.isThread() ? 'SendMessagesInThreads' : 'SendMessages', 'EmbedLinks', // Needed for channel.send call
		]) === true) { return; }

		const customId = deconstructCustomId<CustomIdArgs>(interaction.customId);
		if (!hasName(userData) || !customId) { return; }

		if (interaction.isButton() && customId.args[0] === 'displayedspeciesmodal') {

			await interaction
				.showModal(new ModalBuilder()
					.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, userData.quid._id, []))
					.setTitle('Change displayed species')
					.setComponents(
						new ActionRowBuilder<TextInputBuilder>()
							.setComponents([new TextInputBuilder()
								.setCustomId('displayedspecies')
								.setLabel('Displayed species')
								.setStyle(TextInputStyle.Short)
								.setMaxLength(24)
								.setValue(userData.quid.displayedSpecies),
							]),
					),
				);
			return;
		}
		else if (interaction.isButton()) { return; }

		const selectOptionId = deconstructSelectOptions<SelectOptionArgs>(interaction);

		if (interaction.isStringSelectMenu() && customId.args[0] === 'speciesselect' && selectOptionId[0] === 'nextpage') {

			/* Getting the speciesPage from the value Id, incrementing it by one or setting it to zero if the page number is bigger than the total amount of pages. */
			let speciesPage = Number(selectOptionId[1]) + 1;
			if (speciesPage >= Math.ceil(speciesNameArray.length / 24)) { speciesPage = 0; }

			// This should always be an update on the message
			await respond(interaction, {
				components: [
					new ActionRowBuilder<StringSelectMenuBuilder>().setComponents([getSpeciesSelectMenu(speciesPage, customId.executorId)]),
					new ActionRowBuilder<ButtonBuilder>().setComponents([getDisplayedSpeciesButton(customId.executorId)]),
				],
			}, 'update', '@original');
			return;
		}
		else if (interaction.isStringSelectMenu() && customId.args[0] === 'speciesselect' && keyInObject(speciesInfo, selectOptionId[0])) {

			const chosenSpecies = selectOptionId[0];
			await userData.update(
				(u) => {
					const q = getMapData(u.quids, customId.executorId);
					q.species = chosenSpecies;
				},
			);

			// This should always be an update on the message
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(userData.quid.color)
					.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
					.setDescription(`*A stranger carefully steps over the pack's borders. ${capitalizeString(userData.quid.pronoun(2))} face seems friendly. Curious eyes watch ${userData.quid.pronoun(1)} as ${userData.quid.pronoun(0)} come close to the Alpha.* "Welcome," *the Alpha says.* "What is your name?" \n"${userData.quid.name}," *the ${chosenSpecies} responds. The Alpha takes a friendly step towards ${userData.quid.pronoun(1)}.* "It's nice to have you here, ${userData.quid.name}," *they say. More and more packmates come closer to greet the newcomer.*`)
					.setFooter({ text: 'You are now done setting up your quid for RPGing! Type "/profile" to look at it.\nWith "/help" you can see how else you can customize your profile, as well as your other options.\nYou can use the button below to change your displayed species.' })],
				components: [
					new ActionRowBuilder<ButtonBuilder>().setComponents([getDisplayedSpeciesButton(customId.executorId)]),
				],
			}, 'update', '@original');

			// This should always be a followUp
			await respond(interaction, {
				content: `${interaction.user.toString()} ❓ **Tip:**\nGo playing via \`/play\` to find quests and rank up!`,
			});
			return;
		}
	},
	async sendModalResponse(interaction, userData) {

		const customId = deconstructCustomId<CustomIdArgs>(interaction.customId);
		if (!hasName(userData) || !customId) { return; }

		const displayedSpecies = interaction.fields.getTextInputValue('displayedspecies');

		await userData.update(
			(u) => {
				const q = getMapData(u.quids, customId.executorId);
				q.displayedSpecies = displayedSpecies;
			},
		);

		// This is always a reply
		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(userData.quid.color)
				.setAuthor({ name: userData.quid.getDisplayname(), iconURL: userData.quid.avatarURL })
				.setTitle(displayedSpecies === '' ? 'Successfully removed your displayed species!' : `Successfully changed displayed species to ${displayedSpecies}!`)],
		});
		return;

	},
};

function getSpeciesSelectMenu(page: number, quidId: string): StringSelectMenuBuilder {

	let speciesMenuOptions: RestOrArray<SelectMenuComponentOptionData> = speciesNameArray.map(speciesName => ({
		label: speciesName,
		value: constructSelectOptions<SelectOptionArgs>([speciesName]),
	}));

	if (speciesMenuOptions.length > 25) {

		speciesMenuOptions = speciesMenuOptions.splice(page * 24, 24);
		speciesMenuOptions.push({
			label: 'Show more species options',
			value: constructSelectOptions<SelectOptionArgs>(['nextpage', `${page}`]),
			description: `You are currently on page ${page + 1}`, emoji: '📋',
		});
	}

	return new StringSelectMenuBuilder()
		.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, quidId, ['speciesselect']))
		.setPlaceholder('Select a species')
		.setOptions(speciesMenuOptions);
}

function getDisplayedSpeciesButton(quidId: string): ButtonBuilder {

	return new ButtonBuilder()
		.setCustomId(constructCustomId<CustomIdArgs>(command.data.name, quidId, ['displayedspeciesmodal']))
		.setLabel('Change displayed species')
		.setEmoji('📝')
		.setStyle(ButtonStyle.Secondary);
}