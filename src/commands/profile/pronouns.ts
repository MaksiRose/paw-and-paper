import { ActionRowBuilder, ButtonInteraction, EmbedBuilder, Message, ModalBuilder, ModalSubmitInteraction, SelectMenuBuilder, SelectMenuInteraction, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { respond } from '../../events/interactionCreate';
import userModel from '../../models/userModel';
import { SlashCommand } from '../../typedef';
import { hasName } from '../../utils/checkAccountCompletion';
import { createCommandComponentDisabler } from '../../utils/componentDisabling';
const { error_color, default_color } = require('../../../config.json');

export const name: SlashCommand['name'] = 'pronouns';
export const description: SlashCommand['description'] = 'Choose the pronouns you are using during roleplay.';
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

		const pronounsMenu = new SelectMenuBuilder()
			.setCustomId(`pronouns_selectmodal_${userData.uuid}_${characterData._id}`)
			.setPlaceholder('Select a pronoun to change');

		characterData.pronounSets.forEach((pronounSet, value) => {

			pronounsMenu.addOptions({ label: `${pronounSet[0]}/${pronounSet[1]}`, description: `(${pronounSet[2]}/${pronounSet[3]}/${pronounSet[4]}/${pronounSet[5]})`, value: `pronouns_${value}` });
		});

		if (characterData.pronounSets.length < 25) {

			pronounsMenu.addOptions({ label: 'Add another pronoun', value: 'pronouns_add' });
		}

		const botReply = await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(default_color)
				.setAuthor({ name: characterData.name, iconURL: characterData.avatarURL })
				.setTitle(`What pronouns does ${characterData.name} have?`)
				.setDescription('To change your characters pronouns, select an existing one from the drop-down menu below to edit it, or select "Add another pronoun" to add another one. A pop-up with a text box will open.\n\nTo set the pronouns to they/them for example, type `they/them/their/theirs/themselves/plural`.\nThe 6th spot should be either `singular` ("he/she __is__") or `plural` ("they __are__").\nTo set the pronouns to your own name, you can type `none`.\nTo delete the pronouns, leave the text box empty.\n\nThis is how it would look during roleplay:\n> **They** and the friend that came with **them** laid in **their** den. It was **theirs** because they built it **themselves**. \nYou can use this as reference when thinking about how to add your own (neo-)pronouns.')],
			components: [new ActionRowBuilder<SelectMenuBuilder>().setComponents([pronounsMenu])],
		}, true)
			.catch((error) => { throw new Error(error); });

		createCommandComponentDisabler(userData.uuid, interaction.guildId || 'DM', botReply);
		return;
	},
};

export async function pronounsInteractionCollector(interaction: ButtonInteraction | SelectMenuInteraction): Promise<void> {

	if (interaction.isSelectMenu() && interaction.customId.includes('selectmodal')) {

		const userData = await userModel.findOne({ uuid: interaction.customId.split('_')[2] });
		const characterData = userData.characters[interaction.customId.split('_')[3]];

		const pronounNumber = interaction.values[0].split('_')[0];
		const pronounSet = pronounNumber === 'add' ? [] : characterData.pronounSets[Number(pronounNumber)];

		await interaction
			.showModal(new ModalBuilder()
				.setCustomId(`pronouns_${userData.uuid}_${characterData._id}_${pronounNumber}`)
				.setTitle('Change pronouns')
				.addComponents(
					new ActionRowBuilder<TextInputBuilder>()
						.setComponents([new TextInputBuilder()
							.setCustomId('pronouns_textinput')
							.setLabel('Text')
							.setStyle(TextInputStyle.Short)
							.setMinLength(characterData.pronounSets.length > 1 ? 0 : 4)
							.setMaxLength(138)
							.setValue(pronounSet.join('/')),
						]),
				),
			);

		if (interaction.message instanceof Message) {

			await interaction.message
				.edit({
					components: interaction.message.components,
				})
				.catch((error) => { throw new Error(error); });
		}
		return;
	}
}

export async function sendEditPronounsModalResponse(interaction: ModalSubmitInteraction): Promise<void> {

	const userData = await userModel.findOne({ uuid: interaction.customId.split('_')[1] });
	const characterData = userData.characters[interaction.customId.split('_')[2]];

	const pronounNumber = Number(interaction.customId.split('_')[3]);
	let chosenPronouns = interaction.fields.getTextInputValue('pronouns_textinput').split('/');
	const willBeDeleted = interaction.fields.getTextInputValue('pronouns_textinput') === '';

	if (!willBeDeleted && chosenPronouns[0] === 'none') {

		chosenPronouns = [characterData.name, characterData.name, `${characterData.name}'s`, `${characterData.name}'s`, characterData.name, 'singular'];
	}

	if (!willBeDeleted && chosenPronouns.length !== 6) {

		chosenPronouns.forEach((pronoun, value) => chosenPronouns[value] = `"${pronoun}"`);
		chosenPronouns[chosenPronouns.length - 1] = `and ${chosenPronouns[chosenPronouns.length - 1]}`;

		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(error_color)
				.setDescription(`You provided **${chosenPronouns.length}** arguments: ${chosenPronouns.join(', ')}.\nThe first 5 arguments should be of the pronoun you want, and the 6th argument should be either "singular" or "plural".`)],
			ephemeral: true,
		}, false);
		return;
	}

	if (!willBeDeleted && chosenPronouns[5] !== 'singular' && chosenPronouns[5] !== 'plural') {

		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(error_color)
				.setDescription(`For the 6th spot, you wrote "${chosenPronouns[5]}". The 6th spot should be either "singular" or "plural".`)],
			ephemeral: true,
		}, false);
		return;
	}

	!willBeDeleted && chosenPronouns.forEach(async (pronoun) => {
		if (pronoun.length < 1 || pronoun.length > 25) {

			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setDescription('Each pronoun must be between 1 and 25 characters long.')],
				ephemeral: true,
			}, false)
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}
	});


	await userModel.findOneAndUpdate(
		{ uuid: userData.uuid },
		(u) => {
			if (willBeDeleted) {
				u.characters[characterData._id].pronounSets.splice(pronounNumber, 1);
			}
			else {
				u.characters[characterData._id].pronounSets[isNaN(pronounNumber) ? characterData.pronounSets.length : pronounNumber] = chosenPronouns;
			}
		},
	);

	const addedOrEditedTo = isNaN(pronounNumber) ? 'added pronoun' : `edited pronoun from ${characterData.pronounSets[pronounNumber].join('/')} to`;

	await respond(interaction, {
		embeds: [new EmbedBuilder()
			.setColor(characterData.color)
			.setAuthor({ name: characterData.name, iconURL: characterData.avatarURL })
			.setTitle(`Succcessfully ${willBeDeleted ? `deleted pronoun ${characterData.pronounSets[pronounNumber].join('/')}` : `${addedOrEditedTo} ${chosenPronouns.join('/')}`}!`)],
	}, false);
	return;
}