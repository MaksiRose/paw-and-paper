// @ts-check
const { default_color } = require('../../config.json');
const { profileModel } = require('../../models/profileModel');
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
 * @param {import('../../typedef').ProfileSchema} profileData
 * @returns {Promise<void>}
 */
module.exports.sendMessage = async (client, message, argumentsArray, profileData) => {

	if (await hasNoName(message, profileData)) {

		return;
	}

	profileData = await startCooldown(message, profileData);

	if (profileData.species !== '') {

		await message
			.reply({
				embeds: [ new MessageEmbed({
					color: /** @type {`#${string}`} */ (default_color),
					author: { name: `${message.guild.name}`, icon_url: message.guild.iconURL() },
					title: `${profileData.name} is a ${profileData.species}! You cannot change ${pronoun(profileData, 2)} species unless you reset your account or create another one via \`rp accounts\`.`,
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

		await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { species: chosenSpecies } },
		);

		await message
			.reply({
				embeds: [ new MessageEmbed({
					color: /** @type {`#${string}`} */ (default_color),
					author: { name: `${message.guild.name}`, icon_url: message.guild.iconURL() },
					description: `*The Alpha took a friendly step towards the ${chosenSpecies}.* "It's nice to have you here, ${profileData.name}," *they said. More and more packmates came closer to greet the newcomer.*`,
					footer: { text: 'You are now done setting up your account! Type "rp profile" to look at it. With "rp help" you can see how else you can customize your profile, as well as your other options.' },
				})],
				failIfNotExists: false,
			})
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		await playAdvice(message);

		return;
	}

	const botReply = await message
		.reply({
			embeds: [ new MessageEmbed({
				color: /** @type {`#${string}`} */ (default_color),
				author: { name: message.guild.name, icon_url: message.guild.iconURL() },
				title: `What species is ${profileData.name}?`,
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
			.awaitMessageComponent({ filter, time: 120000 })
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

					await profileModel.findOneAndUpdate(
						{ userId: message.author.id, serverId: message.guild.id },
						{ $set: { species: interaction.values[0] } },
					);

					await /** @type {import('discord.js').Message} */ (interaction.message)
						.edit({
							embeds: [{
								color: '#9d9e51',
								author: { name: message.guild.name, icon_url: message.guild.iconURL() },
								description: `*The Alpha took a friendly step towards the ${interaction.values[0]}.* "It's nice to have you here, ${profileData.name}" *they said. More and more packmates came closer to greet the newcomer.*`,
								footer: { text: 'You are now done setting up your account! Type "rp profile" to look at it. With "rp help" you can see how else you can customize your profile, as well as your other options.' },
							}],
							components: disableAllComponents(/** @type {import('discord.js').Message} */ (interaction.message).components),
						})
						.catch((error) => {
							if (error.httpStatus !== 404) { throw new Error(error); }
						});

					await playAdvice(message);

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