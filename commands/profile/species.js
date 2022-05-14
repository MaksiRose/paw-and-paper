// @ts-check
const { default_color } = require('../../config.json');
const profileModel = require('../../models/profileModel');
const startCooldown = require('../../utils/startCooldown');
const { speciesMap } = require('../../utils/itemsInfo');
const { hasNoName } = require('../../utils/checkAccountCompletion');
const { pronoun } = require('../../utils/getPronouns');
const { playAdvice } = require('../../utils/adviceMessages');
const { MessageSelectMenu, MessageActionRow, MessageEmbed } = require('discord.js');
const disableAllComponents = require('../../utils/disableAllComponents');

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

	const characterData = userData?.characters?.[userData?.currentCharacter?.[message.guild.id]];

	if (await hasNoName(message, characterData)) {

		return;
	}

	userData = await startCooldown(message);

	if (characterData.species !== '') {

		await message
			.reply({
				embeds: [ new MessageEmbed({
					color: /** @type {`#${string}`} */ (default_color),
					author: { name: `${message.guild.name}`, icon_url: message.guild.iconURL() },
					title: `${characterData.name} is a ${characterData.species}! You cannot change ${pronoun(characterData, 2)} species unless you reset your account or create another one via \`rp accounts\`.`,
					description: `List of current available species: ${[...speciesMap.keys()].sort().join(', ')}`,
				})],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});
		return;
	}

	const chosenSpecies = argumentsArray.join(' ').toLowerCase();
	const speciesNameArray = [...speciesMap.keys()].sort();

	const speciesMenu = new MessageSelectMenu({
		customId: 'species-options',
		placeholder: 'Select a species',
	});

	let speciesPage = 0;

	for (const speciesName of speciesNameArray.slice(0, 24)) {

		speciesMenu.addOptions({ label: speciesName, value: speciesName });
	}

	if (speciesNameArray.length > 25) {

		speciesMenu.addOptions({ label: 'Show more species options', value: 'species_page', description: 'You are currently on page 1', emoji: '📋' });
	}


	if (chosenSpecies !== null && speciesMap.has(chosenSpecies)) {

		await successMessage(message, chosenSpecies, characterData);

		return;
	}

	const botReply = await message
		.reply({
			embeds: [ new MessageEmbed({
				color: /** @type {`#${string}`} */ (default_color),
				author: { name: message.guild.name, icon_url: message.guild.iconURL() },
				title: `What species is ${characterData.name}?`,
				description: 'If you want an earthly, extant species added that is not on the list, create a GitHub account and [use this form](https://github.com/MaksiRose/paw-and-paper/issues/new?assignees=&labels=improvement%2Cnon-code&template=species_request.yaml&title=New+species%3A+) to suggest it.',
			})],
			components: [
				new MessageActionRow({ components: [speciesMenu] }),
			],
			failIfNotExists: false,
		})
		.catch((error) => { throw new Error(error); });

	await interactionCollector();

	async function interactionCollector() {

		const filter = (/** @type {import('discord.js').MessageComponentInteraction} */ i) => (i.isSelectMenu() && i.values[0] == 'species_page' || i.isSelectMenu() && speciesMap.has(i.values[0])) && i.user.id == message.author.id;

		/** @type {import('discord.js').MessageComponentInteraction | null} */
		await botReply
			.awaitMessageComponent({ filter, time: 120_000 })
			.then(async interaction => {

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
			p.characters[p.currentCharacter[message.guild.id]].species = chosenSpecies;
		},
	);

	await message
		.reply({
			embeds: [new MessageEmbed({
				color: /** @type {`#${string}`} */ (default_color),
				author: { name: `${message.guild.name}`, icon_url: message.guild.iconURL() },
				description: `*A stranger carefully steps over the pack's borders. Their face seems friendly. Curious eyes watch them as they come close to the Alpha.* "Welcome," *the Alpha says.* "What is your name?" \n"${characterData.name}," *the ${chosenSpecies} responds. The Alpha took a friendly step towards them.* "It's nice to have you here, ${characterData.name}," *they said. More and more packmates came closer to greet the newcomer.*`,
				footer: { text: 'You are now done setting up your character for RPGing! Type "rp profile" to look at it. With "rp help" you can see how else you can customize your profile, as well as your other options.' },
			})],
			failIfNotExists: false,
		})
		.catch((error) => {
			if (error.httpStatus !== 404) { throw new Error(error); }
		});

	await playAdvice(message);
}