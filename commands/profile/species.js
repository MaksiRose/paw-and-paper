// @ts-check
const profileModel = require('../../models/profileModel');
const startCooldown = require('../../utils/startCooldown');
const { speciesMap } = require('../../utils/itemsInfo');
const { hasNoName } = require('../../utils/checkAccountCompletion');
const { pronoun, upperCasePronoun } = require('../../utils/getPronouns');
const { playAdvice } = require('../../utils/adviceMessages');
const { MessageSelectMenu, MessageActionRow, MessageEmbed, MessageButton, Modal, TextInputComponent } = require('discord.js');
const disableAllComponents = require('../../utils/disableAllComponents');
const { createCommandCollector } = require('../../utils/commandCollector');

module.exports.name = 'species';

/**
 *
 * @param {import('../../paw').client} client
 * @param {import('discord.js').Message} message
 * @param {Array<string>} argumentsArray
 * @param {import('../../typedef').ProfileSchema} userData
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, userData) => {

	const characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild?.id || 'DM']];

	if (await hasNoName(message, characterData)) {

		return;
	}

	userData = await startCooldown(message);

	const chosenSpecies = argumentsArray.join(' ').toLowerCase();
	const speciesNameArray = [...speciesMap.keys()].sort();

	const displayedSpeciesButton = new MessageButton({
		customId: 'displayedspecies-modal',
		label: 'Change displayed species',
		emoji: '📝',
		style: 'SECONDARY',
	});

	const speciesMenu = new MessageSelectMenu({
		customId: 'species-options',
		placeholder: 'Select a species',
	});

	const newSpeciesEmbed = new MessageEmbed({
		color: characterData.color,
		author: { name: characterData.name, icon_url: characterData.avatarURL },
		title: `What species is ${characterData.name}?`,
		description: 'Choosing a species is only necessary for the RPG parts of the bot, and is **permanent**. If you want an earthly, extant species added that is not on the list, [use this form](https://github.com/MaksiRose/paw-and-paper/issues/new?assignees=&labels=improvement%2Cnon-code&template=species_request.yaml&title=New+species%3A+) to suggest it. Alternatively, you can choose a species that\'s similar and use the button below to change what species is displayed to anything you want. You can change the displayed species as many times as you want.',
	});

	const existingSpeciesEmbed = new MessageEmbed({
		color: characterData.color,
		author: { name: characterData.name, icon_url: characterData.avatarURL },
		title: `${characterData.name} is a ${characterData.displayedSpecies || characterData.species}! You cannot change ${pronoun(characterData, 2)} species, but you can create another character via \`rp profile\`. Alternatively, you can use the button below to change what species is displayed to others to anything you want.`,
		description: `Here is a list of species that you can choose when making a new character: ${[...speciesMap.keys()].sort().join(', ')}`,
	});

	let speciesPage = 0;

	for (const speciesName of speciesNameArray.slice(0, 24)) {

		speciesMenu.addOptions({ label: speciesName, value: speciesName });
	}

	if (speciesNameArray.length > 25) {

		speciesMenu.addOptions({ label: 'Show more species options', value: 'species_page', description: 'You are currently on page 1', emoji: '📋' });
	}


	if (characterData.species === '' && chosenSpecies !== null && speciesMap.has(chosenSpecies)) {

		await successMessage(message, chosenSpecies, characterData);

		return;
	}

	const botReply = await message
		.reply({
			embeds: (characterData.species === '') ? [newSpeciesEmbed] : [existingSpeciesEmbed],
			components: [
				...(characterData.species === '' ? [new MessageActionRow({ components: [speciesMenu] })] : []),
				new MessageActionRow({ components: [displayedSpeciesButton] }),
			],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	createCommandCollector(message.author.id, message.guild?.id || '', botReply);
	interactionCollector();

	async function interactionCollector() {

		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => (i.isSelectMenu() && i.values[0] == 'species_page' || i.isSelectMenu() && speciesMap.has(i.values[0]) || i.isButton() && i.customId === 'displayedspecies-modal') && i.user.id == message.author.id;

		/** @type {import('discord.js').MessageComponentInteraction | null} */
		await botReply
			.awaitMessageComponent({ filter, time: 120_000 })
			.then(async interaction => {

				if (interaction.isButton() && interaction.customId === 'displayedspecies-modal') {

					interaction.showModal(new Modal()
						.setCustomId(`displayedspecies-${message.author.id}-${characterData._id}`)
						.setTitle('Change displayed species')
						.addComponents(
							new MessageActionRow({
								components: [ new TextInputComponent()
									.setCustomId('displayedspecies-textinput')
									.setLabel('Text')
									.setStyle('SHORT')
									.setMaxLength(25)
									.setValue(characterData.displayedSpecies),
								],
							}),
						),
					);

					return await interactionCollector();
				}

				if (interaction.isSelectMenu() && interaction.values[0] === 'species_page') {

					speciesPage++;
					if (speciesPage >= Math.ceil(speciesNameArray.length / 24)) {

						speciesPage = 0;
					}

					speciesMenu.options = [];

					for (const speciesName of speciesNameArray.slice((speciesPage * 24), 24 + (speciesPage * 24))) {

						speciesMenu.addOptions({ label: speciesName, value: speciesName });
					}

					speciesMenu.addOptions({ label: 'Show more species options', value: 'species_page', description: `You are currently on page ${speciesPage + 1}`, emoji: '📋' });

					await /** @type {import('discord.js').Message} */ (interaction.message)
						.edit({
							components: [
								new MessageActionRow({ components: [speciesMenu] }),
								new MessageActionRow({ components: [displayedSpeciesButton] }),
							],
						})
						.catch((error) => {
							if (error.httpStatus !== 404) { throw new Error(error); }
						});

					return await interactionCollector();
				}

				if (interaction.isSelectMenu() && speciesMap.has(interaction.values[0])) {

					await successMessage(message, interaction.values[0], characterData);

					return;
				}
			})
			.catch(async () => {

				await botReply
					.edit({
						components: disableAllComponents(botReply.components),
					})
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
				return;
			});
	}
};


/**
 * It sends a message to the user who ran the command, and it's supposed to be a success message.
 * @param {import('discord.js').Message} message - The message object.
 * @param {string} chosenSpecies - The species the user chose.
 * @param {import('../../typedef').Character} characterData - {
 */
async function successMessage(message, chosenSpecies, characterData) {

	await profileModel.findOneAndUpdate(
		{ userId: message.author.id },
		(/** @type {import('../../typedef').ProfileSchema} */ p) => {
			p.characters[p.currentCharacter[message.guild?.id || 'DM']].species = chosenSpecies;
		},
	);

	await message
		.reply({
			embeds: [new MessageEmbed({
				color: characterData.color,
				author: { name: characterData.name, icon_url: characterData.avatarURL },
				description: `*A stranger carefully steps over the pack's borders. ${upperCasePronoun(characterData, 2)} face seems friendly. Curious eyes watch ${pronoun(characterData, 1)} as ${pronoun(characterData, 0)} come close to the Alpha.* "Welcome," *the Alpha says.* "What is your name?" \n"${characterData.name}," *the ${chosenSpecies} responds. The Alpha takes a friendly step towards ${pronoun(characterData, 1)}.* "It's nice to have you here, ${characterData.name}," *they say. More and more packmates come closer to greet the newcomer.*`,
				footer: { text: 'You are now done setting up your character for RPGing! Type "rp profile" to look at it. With "rp help" you can see how else you can customize your profile, as well as your other options.' },
			})],
			failIfNotExists: false,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});

	await playAdvice(message);
}