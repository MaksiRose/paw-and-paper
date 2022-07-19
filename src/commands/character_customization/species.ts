import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, ModalBuilder, ModalSubmitInteraction, SelectMenuBuilder, SelectMenuInteraction, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { respond } from '../../events/interactionCreate';
import userModel from '../../models/userModel';
import { SlashCommand, UserSchema } from '../../typedef';
import { hasName } from '../../utils/checkAccountCompletion';
import { createCommandComponentDisabler } from '../../utils/componentDisabling';
import { pronoun, upperCasePronoun } from '../../utils/getPronouns';
import { speciesMap } from '../../utils/itemsInfo';

const speciesNameArray = [...speciesMap.keys()].sort();

const name: SlashCommand['name'] = 'species';
const description: SlashCommand['description'] = 'Change your character\'s species or displayed species.';
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

		const characterData = userData.characters[userData.currentCharacter[interaction.guildId || 'DM']];

		/* Define displayed species button */
		const displayedSpeciesButton = getDisplayedSpeciesButton(characterData._id);

		/* Define species select menu */
		const speciesMenu = getSpeciesSelectMenu(0, characterData._id);

		/* Define embeds */
		const newSpeciesEmbed = new EmbedBuilder()
			.setColor(characterData.color)
			.setAuthor({ name: characterData.name, iconURL: characterData.avatarURL })
			.setTitle(`What species is ${characterData.name}?`)
			.setDescription('Choosing a species is only necessary for the RPG parts of the bot, and is **permanent**. If you want an earthly, extant species added that is not on the list, [use this form](https://github.com/MaksiRose/paw-and-paper/issues/new?assignees=&labels=improvement%2Cnon-code&template=species_request.yaml&title=New+species%3A+) to suggest it. Alternatively, you can choose a species that\'s similar and use the button below to change what species is displayed to be anything you want. You can change the displayed species as many times as you want.');
		const existingSpeciesEmbed = new EmbedBuilder()
			.setColor(characterData.color)
			.setAuthor({ name: characterData.name, iconURL: characterData.avatarURL })
			.setDescription(`${characterData.name} is a ${characterData.displayedSpecies || characterData.species}! You cannot change ${pronoun(characterData, 2)} species, but you can create another character via \`/profile\`. Alternatively, you can use the button below to change what species is displayed to be anything you want.`)
			.setFooter({ text: `Here is a list of species that you can choose when making a new character: ${[...speciesMap.keys()].sort().join(', ')}` });

		const botReply = await respond(interaction, {
			embeds: characterData.species === '' ? [newSpeciesEmbed] : [existingSpeciesEmbed],
			components: [
				...(characterData.species === '' ? [new ActionRowBuilder<SelectMenuBuilder>().setComponents([speciesMenu])] : []),
				new ActionRowBuilder<ButtonBuilder>().setComponents([displayedSpeciesButton]),
			],
		}, true)
			.catch((error) => { throw new Error(error); });

		createCommandComponentDisabler(userData.uuid, interaction.guildId || 'DM', botReply);
	},
};

function getSpeciesSelectMenu(page: number, characterId: string): SelectMenuBuilder {

	const speciesMenu = new SelectMenuBuilder()
		.setCustomId(`species_speciesselect_${characterId}`)
		.setPlaceholder('Select a species');

	for (const speciesName of speciesNameArray.slice((page * 24), 24 + (page * 24))) {

		speciesMenu.addOptions({ label: speciesName, value: `species_${speciesName}` });
	}

	if (speciesNameArray.length > 25) {

		speciesMenu.addOptions({ label: 'Show more species options', value: `species_nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return speciesMenu;
}

function getDisplayedSpeciesButton(characterId: string): ButtonBuilder {

	return new ButtonBuilder()
		.setCustomId(`species_displayedspeciesmodal_${characterId}`)
		.setLabel('Change displayed species')
		.setEmoji('📝')
		.setStyle(ButtonStyle.Secondary);
}

export async function speciesInteractionCollector(interaction: ButtonInteraction | SelectMenuInteraction, userData: UserSchema | null): Promise<void> {

	if (interaction.isButton() && interaction.customId.includes('displayedspeciesmodal')) {

		if (!userData) { throw new Error('userData is null'); }
		const characterData = userData.characters[interaction.customId.split('_')[2]];

		await interaction
			.showModal(new ModalBuilder()
				.setCustomId(`species_${characterData._id}`)
				.setTitle('Change displayed species')
				.setComponents(
					new ActionRowBuilder<TextInputBuilder>()
						.setComponents([new TextInputBuilder()
							.setCustomId('species_textinput')
							.setLabel('Displayed species')
							.setStyle(TextInputStyle.Short)
							.setMaxLength(24)
							.setValue(characterData.displayedSpecies),
						]),
				),
			);
		return;
	}

	if (interaction.isSelectMenu() && interaction.values[0].includes('nextpage')) {

		/* Getting the characterId from the customId */
		const characterId = interaction.customId.split('_')[2];

		/* Getting the charactersPage from the value Id, incrementing it by one or setting it to zero if the page number is bigger than the total amount of pages. */
		let speciesPage = Number(interaction.values[0].split('_')[2]) + 1;
		if (speciesPage >= Math.ceil(speciesNameArray.length / 24)) { speciesPage = 0; }

		/* Editing the message if its a Message object, else throw an error. */
		await interaction
			.update({
				components: [
					new ActionRowBuilder<SelectMenuBuilder>().setComponents([getSpeciesSelectMenu(speciesPage, characterId)]),
					new ActionRowBuilder<ButtonBuilder>().setComponents([getDisplayedSpeciesButton(characterId)]),
				],
			})
			.catch((error) => { throw new Error(error); });
		return;
	}

	if (interaction.isSelectMenu() && speciesMap.has(interaction.values[0].split('_')[0])) {

		/* Getting the characterId from the customId */
		const characterId = interaction.customId.split('_')[2];

		/* getting the species from the value */
		const chosenSpecies = interaction.values[0].split('_')[0];

		userData = await userModel.findOneAndUpdate(
			{ uuid: userData?.uuid },
			(u) => {
				u.characters[characterId].species = chosenSpecies;
			},
		);
		const characterData = userData.characters[characterId];

		await interaction
			.update({
				embeds: [new EmbedBuilder()
					.setColor(characterData.color)
					.setAuthor({ name: characterData.name, iconURL: characterData.avatarURL })
					.setDescription(`*A stranger carefully steps over the pack's borders. ${upperCasePronoun(characterData, 2)} face seems friendly. Curious eyes watch ${pronoun(characterData, 1)} as ${pronoun(characterData, 0)} come close to the Alpha.* "Welcome," *the Alpha says.* "What is your name?" \n"${characterData.name}," *the ${chosenSpecies} responds. The Alpha takes a friendly step towards ${pronoun(characterData, 1)}.* "It's nice to have you here, ${characterData.name}," *they say. More and more packmates come closer to greet the newcomer.*`)
					.setFooter({ text: 'You are now done setting up your character for RPGing! Type "/profile" to look at it.\nWith "/help" you can see how else you can customize your profile, as well as your other options.\nYou can use the button below to change your displayed species.' })],
				components: [
					new ActionRowBuilder<ButtonBuilder>().setComponents([getDisplayedSpeciesButton(characterId)]),
				],
			})
			.catch((error) => { throw new Error(error); });

		await interaction.message.channel
			.send({
				content: `${interaction.user.toString()} ❓ **Tip:**\nGo playing via \`/play\` to find quests and rank up!`,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}
}

export async function sendEditDisplayedSpeciesModalResponse(interaction: ModalSubmitInteraction, userData: UserSchema | null): Promise<void> {

	const characterId = interaction.customId.split('_')[1];
	const displayedSpecies = interaction.fields.getTextInputValue('species_textinput');

	userData = await userModel.findOneAndUpdate(
		{ uuid: userData?.uuid },
		(u) => {
			u.characters[characterId].displayedSpecies = displayedSpecies;
		},
	);

	await respond(interaction, {
		embeds: [new EmbedBuilder()
			.setColor(userData.characters[characterId].color)
			.setAuthor({ name: userData.characters[characterId].name, iconURL: userData.characters[characterId].avatarURL })
			.setTitle(displayedSpecies === '' ? 'Successfully removed your displayed species!' : `Successfully changed displayed species to ${displayedSpecies}!`)],
	}, false);
	return;
}