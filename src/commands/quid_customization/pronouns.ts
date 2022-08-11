import { ActionRowBuilder, ButtonInteraction, EmbedBuilder, Message, ModalBuilder, ModalSubmitInteraction, RestOrArray, SelectMenuBuilder, SelectMenuComponentOptionData, SelectMenuInteraction, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { respond } from '../../utils/helperFunctions';
import userModel from '../../models/userModel';
import { Quid, SlashCommand, UserSchema } from '../../typedef';
import { hasName } from '../../utils/checkUserState';
import { createCommandComponentDisabler } from '../../utils/componentDisabling';
import { getMapData } from '../../utils/helperFunctions';
import { pronounCompromiser } from './profile';
const { error_color, default_color } = require('../../../config.json');

const maxPronounLength = 16;
const maxModalLength = (maxPronounLength * 5) + 8 + 5; // In the modal, the most you can input is 5 pronouns, the word 'singular' plus 5 slashes

const name: SlashCommand['name'] = 'pronouns';
const description: SlashCommand['description'] = 'Choose the pronouns you are using during roleplay.';
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

		/* Getting the quid data and sending the initial response */
		const quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId || 'DM'));

		const botReply = await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(default_color)
				.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL })
				.setTitle(`What pronouns does ${quidData.name} have?`)
				.setDescription('To change your quids pronouns, select an existing one from the drop-down menu below to edit it, or select "Add another pronoun" to add another one. A pop-up with a text box will open.\n\nTo set the pronouns to they/them for example, type `they/them/their/theirs/themselves/plural`.\nThe 6th spot should be either `singular` ("he/she __is__") or `plural` ("they __are__").\nTo set the pronouns to your own name, you can type `none`.\nTo delete the pronouns, leave the text box empty.\n\nThis is how it would look during roleplay:\n> **They** and the friend that came with **them** laid in **their** den. It was **theirs** because they built it **themselves**. \nYou can use this as reference when thinking about how to add your own (neo-)pronouns.')],
			components: [new ActionRowBuilder<SelectMenuBuilder>().setComponents([getPronounsMenu(userData, quidData)])],
		}, true)
			.catch((error) => { throw new Error(error); });

		createCommandComponentDisabler(userData.uuid, interaction.guildId || 'DM', botReply);
		return;
	},
};

/** Creating a drop - down menu with all the pronouns the quid has. */
function getPronounsMenu(userData: UserSchema, quidData: Quid) {

	/* Getting the remaining length for the pronoun field in the profile command. */
	const profilePronounFieldLengthLeft = 1024 - quidData.pronounSets.map(pronounSet => `${pronounSet[0]}/${pronounSet[1]} (${pronounSet[2]}/${pronounSet[3]}/${pronounSet[4]})`).join('\n').length;

	/* Creating the pronouns menu options */
	const pronounsMenuOptions: RestOrArray<SelectMenuComponentOptionData> = [];

	quidData.pronounSets.forEach((pronounSet, value) => {

		pronounsMenuOptions.push({ label: `${pronounSet[0]}/${pronounSet[1]}`, description: `(${pronounSet[2]}/${pronounSet[3]}/${pronounSet[4]}/${pronounSet[5]})`, value: `pronouns_${value}` });
	});

	if (pronounsMenuOptions.length < 25 && profilePronounFieldLengthLeft >= 4) {

		pronounsMenuOptions.push({ label: 'Add another pronoun', value: 'pronouns_add' });
	}

	return new SelectMenuBuilder()
		.setCustomId(`pronouns_selectmodal_${userData.uuid}_${quidData._id}`)
		.setPlaceholder('Select a pronoun to change')
		.setOptions(pronounsMenuOptions);
}

export const pronounsInteractionCollector = async (
	interaction: ButtonInteraction | SelectMenuInteraction,
): Promise<void> => {

	if (interaction.isSelectMenu() && interaction.customId.includes('selectmodal')) {

		const userData = await userModel.findOne(u => u.uuid === interaction.customId.split('_')[2]);
		const quidData = getMapData(userData.quids, interaction.customId.split('_')[3] || '');

		/* Getting the position of the pronoun in the array, and the existing pronoun in that place */
		const pronounNumber = interaction.values[0]?.split('_')[1] || 'add';
		const pronounSet = pronounNumber === 'add' ? [] : quidData.pronounSets[Number(pronounNumber)] || [];

		/* Getting the remaining length for the pronoun field in the profile command. */
		const profilePronounFieldLengthLeft = 1024 - quidData.pronounSets.map(pSet => pronounCompromiser(pSet)).join('\n').length + pronounCompromiser(pronounSet).length;

		await interaction
			.showModal(new ModalBuilder()
				.setCustomId(`pronouns_${userData.uuid}_${quidData._id}_${pronounNumber}`)
				.setTitle('Change pronouns')
				.addComponents(
					new ActionRowBuilder<TextInputBuilder>()
						.setComponents([new TextInputBuilder()
							.setCustomId('pronouns_textinput')
							.setLabel('Text')
							.setStyle(TextInputStyle.Short)
							.setMinLength(quidData.pronounSets.length > 1 ? 0 : 4)
							// Max Length is either maxModalLength or, if that would exceed the max field value length, make it what is left for a field value length.
							.setMaxLength((profilePronounFieldLengthLeft < maxModalLength) ? profilePronounFieldLengthLeft : maxModalLength)
							.setValue(pronounSet.join('/')),
						]),
				),
			);

		if (interaction.message instanceof Message) {

			await interaction.message
				.edit({
					components: [new ActionRowBuilder<SelectMenuBuilder>().setComponents([getPronounsMenu(userData, quidData)])],
				})
				.catch((error) => { throw new Error(error); });
		}
		return;
	}
};

export const sendEditPronounsModalResponse = async (
	interaction: ModalSubmitInteraction,
): Promise<void> => {

	const userData = await userModel.findOne(u => u.uuid === interaction.customId.split('_')[1]);
	const quidData = getMapData(userData.quids, interaction.customId.split('_')[2] || '');

	/* Getting the array position of the pronoun that is being edited, the pronouns that are being set, whether
	the pronouns are being deleted, and whether the pronouns are being set to none. */
	const pronounNumber = Number(interaction.customId.split('_')[3]);
	const chosenPronouns = interaction.fields.getTextInputValue('pronouns_textinput').split('/');
	const willBeDeleted = interaction.fields.getTextInputValue('pronouns_textinput') === '';
	let isNone = false;

	/* If the pronouns won't be deleted, the first chosen pronoun is none and there are no other pronouns chosen, set isNone to true. */
	if (!willBeDeleted && chosenPronouns[0] === 'none' && chosenPronouns.length == 1) { isNone = true; }

	/* Checking if the user has provided the correct amount of arguments. If they haven't, it will send an error message. */
	if (!willBeDeleted && !isNone && chosenPronouns.length !== 6) {

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

	/* Checking if the 6th spot is either singular or plural. */
	if (!willBeDeleted && !isNone && chosenPronouns[5] !== 'singular' && chosenPronouns[5] !== 'plural') {

		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(error_color)
				.setDescription(`For the 6th spot, you wrote "${chosenPronouns[5]}". The 6th spot should be either "singular" or "plural".`)],
			ephemeral: true,
		}, false);
		return;
	}

	/* It checks if the quid already has the pronouns that are being set. */
	if (!willBeDeleted && quidData.pronounSets.map(pronounSet => pronounSet.join('/')).includes(chosenPronouns.join('/'))) {

		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(error_color)
				.setDescription('The quid already has this pronoun!')],
			ephemeral: true,
		}, false);
		return;
	}

	/* Checking if the pronouns are not being deleted, and if the pronouns are not being set to none, and if so, it is checking if the length of each pronoun is between 1 quid and the maximum pronoun length long. If it is not, it will send an error message. */
	!willBeDeleted && !isNone && chosenPronouns.forEach(async (pronoun) => {
		if (pronoun.length < 1 || pronoun.length > maxPronounLength) {

			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setDescription(`Each pronoun must be between 1 and ${maxPronounLength} characters long.`)],
				ephemeral: true,
			}, false)
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}
	});


	/* Add the pronouns, send a success message and update the original one. */
	await userModel.findOneAndUpdate(
		u => u.uuid === userData?.uuid,
		(u) => {
			const q = getMapData(u.quids, quidData._id);
			if (willBeDeleted) {
				q.pronounSets.splice(pronounNumber, 1);
			}
			else {
				q.pronounSets[isNaN(pronounNumber) ? quidData.pronounSets.length : pronounNumber] = chosenPronouns;
			}
		},
	);

	const addedOrEditedTo = isNaN(pronounNumber) ? 'added pronoun' : `edited pronoun from ${quidData.pronounSets[pronounNumber]?.join('/')} to`;

	await respond(interaction, {
		embeds: [new EmbedBuilder()
			.setColor(quidData.color)
			.setAuthor({ name: quidData.name, iconURL: quidData.avatarURL })
			.setTitle(`Successfully ${willBeDeleted ? `deleted pronoun ${quidData.pronounSets[pronounNumber]?.join('/')}` : `${addedOrEditedTo} ${chosenPronouns.join('/')}`}!`)],
	}, false)
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});

	if (interaction.message) {

		await interaction.message
			.edit({ components: [new ActionRowBuilder<SelectMenuBuilder>().setComponents([getPronounsMenu(userData, quidData)])] })
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
	}
	return;
};