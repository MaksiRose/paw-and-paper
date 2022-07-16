import { SlashCommandBuilder } from '@discordjs/builders';
import { ButtonInteraction, CommandInteraction, Message, MessageActionRow, MessageButton, MessageEmbed, MessageSelectMenu, Modal, ModalSubmitInteraction, SelectMenuInteraction, TextInputComponent } from 'discord.js';
import { respond } from '../../events/interactionCreate';
import userModel from '../../models/userModel';
import { CustomClient, SlashCommand, UserSchema } from '../../typedef';
import { hasName } from '../../utils/checkAccountCompletion';
import { createCommandComponentDisabler } from '../../utils/componentDisabling';
import { pronoun, upperCasePronoun } from '../../utils/getPronouns';
import { speciesMap } from '../../utils/itemsInfo';

const speciesNameArray = [...speciesMap.keys()].sort();

const name: SlashCommand['name'] = 'species';
const description: SlashCommand['description'] = 'Get an overview of the available species for you character.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.toJSON(),
	disablePreviousCommand: true,
	sendCommand: async (client: CustomClient, interaction: CommandInteraction, userData: UserSchema | null) => {

		if (!hasName(interaction, userData)) { return; }

		const characterData = userData.characters[userData.currentCharacter[interaction.guildId || 'DM']];

		/* Define displayed species button */
		const displayedSpeciesButton = getDisplayedSpeciesButton(userData.uuid, characterData._id);

		/* Define species select menu */
		const speciesMenu = getSpeciesSelectMenu(0, userData.uuid, characterData._id);

		/* Define embeds */
		const newSpeciesEmbed = new MessageEmbed({
			color: characterData.color,
			author: { name: characterData.name, icon_url: characterData.avatarURL },
			title: `What species is ${characterData.name}?`,
			description: 'Choosing a species is only necessary for the RPG parts of the bot, and is **permanent**. If you want an earthly, extant species added that is not on the list, [use this form](https://github.com/MaksiRose/paw-and-paper/issues/new?assignees=&labels=improvement%2Cnon-code&template=species_request.yaml&title=New+species%3A+) to suggest it. Alternatively, you can choose a species that\'s similar and use the button below to change what species is displayed to be anything you want. You can change the displayed species as many times as you want.',
		});
		const existingSpeciesEmbed = new MessageEmbed({
			color: characterData.color,
			author: { name: characterData.name, icon_url: characterData.avatarURL },
			description: `${characterData.name} is a ${characterData.displayedSpecies || characterData.species}! You cannot change ${pronoun(characterData, 2)} species, but you can create another character via \`/profile\`. Alternatively, you can use the button below to change what species is displayed to be anything you want.`,
			footer: { text: `Here is a list of species that you can choose when making a new character: ${[...speciesMap.keys()].sort().join(', ')}` },
		});

		const botReply = await respond(interaction, {
			embeds: characterData.species === '' ? [newSpeciesEmbed] : [existingSpeciesEmbed],
			components: [
				...(characterData.species === '' ? [new MessageActionRow({ components: [speciesMenu] })] : []),
				new MessageActionRow({ components: [displayedSpeciesButton] }),
			],
		}, true)
			.catch((error) => { throw new Error(error); });

		createCommandComponentDisabler(userData.uuid, interaction.guildId || 'DM', botReply);
	},
};

function getSpeciesSelectMenu(page: number, uuid: string, characterId: string): MessageSelectMenu {

	const speciesMenu = new MessageSelectMenu({
		customId: `species_speciesselect_${uuid}_${characterId}`,
		placeholder: 'Select a species',
	});

	for (const speciesName of speciesNameArray.slice((page * 24), 24 + (page * 24))) {

		speciesMenu.addOptions({ label: speciesName, value: `species_${speciesName}` });
	}

	if (speciesNameArray.length > 25) {

		speciesMenu.addOptions({ label: 'Show more species options', value: `species_nextpage_${page}`, description: `You are currently on page ${page + 1}`, emoji: '📋' });
	}

	return speciesMenu;
}

function getDisplayedSpeciesButton(uuid: string, characterId: string): MessageButton {

	return new MessageButton({
		customId: `species_displayedspeciesmodal_${uuid}_${characterId}`,
		label: 'Change displayed species',
		emoji: '📝',
		style: 'SECONDARY',
	});
}

export async function speciesInteractionCollector(interaction: ButtonInteraction | SelectMenuInteraction): Promise<void> {

	if (interaction.isButton() && interaction.customId.includes('displayedspeciesmodal')) {

		const userData = await userModel.findOne({ uuid: interaction.customId.split('_')[2] });
		const characterData = userData.characters[interaction.customId.split('_')[3]];

		await interaction
			.showModal(new Modal()
				.setCustomId(`species_${userData.uuid}_${characterData._id}`)
				.setTitle('Change displayed species')
				.addComponents(
					new MessageActionRow({
						components: [ new TextInputComponent()
							.setCustomId('species_textinput')
							.setLabel('Text')
							.setStyle('SHORT')
							.setMaxLength(25)
							.setValue(characterData.displayedSpecies),
						],
					}),
				),
			);
		return;
	}

	if (interaction.isSelectMenu() && interaction.values[0].includes('nextpage')) {

		/* Getting the UUID and characterId from the customId */
		const userDataUUID = interaction.customId.split('_')[2];
		const characterId = interaction.customId.split('_')[3];

		/* Getting the charactersPage from the value Id, incrementing it by one or setting it to zero if the page number is bigger than the total amount of pages. */
		let speciesPage = Number(interaction.values[0].split('_')[2]) + 1;
		if (speciesPage >= Math.ceil(speciesNameArray.length / 24)) { speciesPage = 0; }

		/* Editing the message if its a Message object, else throw an error. */
		if (interaction.message instanceof Message) {

			await interaction.message
				.edit({
					components: [
						new MessageActionRow({ components: [getSpeciesSelectMenu(speciesPage, userDataUUID, characterId)] }),
						new MessageActionRow({ components: [getDisplayedSpeciesButton(userDataUUID, characterId)] }),
					],
				})
				.catch((error) => { throw new Error(error); });
			await interaction.deferUpdate();
		}
		else { throw new Error('Message could not be found.'); }
		return;
	}

	if (interaction.isSelectMenu() && speciesMap.has(interaction.values[0].split('_')[0])) {

		/* Getting the UUID and characterId from the customId */
		const userDataUUID = interaction.customId.split('_')[2];
		const characterId = interaction.customId.split('_')[3];

		/* getting the species from the value */
		const chosenSpecies = interaction.values[0].split('_')[0];

		const userData = await userModel.findOneAndUpdate(
			{ uuid: userDataUUID },
			(u) => {
				u.characters[characterId].species = chosenSpecies;
			},
		);
		const characterData = userData.characters[characterId];

		/* Editing the message if its a Message object, else throw an error. */
		if (interaction.message instanceof Message) {

			await interaction.deferUpdate();

			await interaction.message
				.edit({
					embeds: [new MessageEmbed({
						color: characterData.color,
						author: { name: characterData.name, icon_url: characterData.avatarURL },
						description: `*A stranger carefully steps over the pack's borders. ${upperCasePronoun(characterData, 2)} face seems friendly. Curious eyes watch ${pronoun(characterData, 1)} as ${pronoun(characterData, 0)} come close to the Alpha.* "Welcome," *the Alpha says.* "What is your name?" \n"${characterData.name}," *the ${chosenSpecies} responds. The Alpha takes a friendly step towards ${pronoun(characterData, 1)}.* "It's nice to have you here, ${characterData.name}," *they say. More and more packmates come closer to greet the newcomer.*`,
						footer: { text: 'You are now done setting up your character for RPGing! Type "/profile" to look at it.\nWith "/help" you can see how else you can customize your profile, as well as your other options.\nYou can use the button below to change your displayed species.' },
					})],
					components: [
						new MessageActionRow({ components: [getDisplayedSpeciesButton(userDataUUID, characterId)] }),
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
		}
		else { throw new Error('Message could not be found.'); }
		return;
	}
}

export async function sendEditDisplayedSpeciesModalResponse(interaction: ModalSubmitInteraction): Promise<void> {

	const uuid = interaction.customId.split('_')[1];
	const characterId = interaction.customId.split('_')[2];
	const displayedSpecies = interaction.components[0].components[0].value;

	const userData = await userModel.findOneAndUpdate(
		{ uuid: uuid },
		(u) => {
			u.characters[characterId].displayedSpecies = displayedSpecies;
		},
	);

	await respond(interaction, {
		embeds: [new MessageEmbed({
			color: userData.characters[characterId].color,
			author: { name: userData.characters[characterId].name, icon_url: userData.characters[characterId].avatarURL },
			title: displayedSpecies === '' ? 'Successfully removed your displayed species!' : `Successfully changed displayed species to ${displayedSpecies}!`,
		})],
	}, false);
	return;
}