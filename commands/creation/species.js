const config = require('../../config.json');
const profileModel = require('../../models/profileModel');
const startCooldown = require('../../utils/startCooldown');
const { speciesMap } = require('../../utils/itemsInfo');
const { hasNoName } = require('../../utils/checkAccountCompletion');

module.exports = {
	name: 'species',
	async sendMessage(client, message, argumentsArray, profileData) {

		if (await hasNoName(message, profileData)) {

			return;
		}

		profileData = await startCooldown(message, profileData);

		if (profileData.species != '') {

			return await message
				.reply({
					embeds: [{
						color: '#9d9e51',
						author: { name: `${message.guild.name}`, icon_url: message.guild.iconURL() },
						title: `${profileData.name} is a ${profileData.species}! You cannot change ${profileData.pronounArray[2]} species unless you reset your account.`,
					}],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		const chosenSpecies = argumentsArray.join(' ').toLowerCase();
		const speciesNameArray = [...speciesMap.keys()].sort();
		let selectMenuOptionsArray = new Array();
		let speciesPage = 0;

		for (const speciesName of speciesNameArray.slice(0, 24)) {

			selectMenuOptionsArray.push({ label: speciesName, value: speciesName });
		}

		if (speciesNameArray.length > 25) {

			selectMenuOptionsArray.push({ label: 'Show more species options', value: 'species_page', description: 'You are currently on page 1', emoji: '📋' });
		}


		if (chosenSpecies != null && speciesMap.has(chosenSpecies)) {

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { species: chosenSpecies } },
			);

			return await message
				.reply({
					embeds: [{
						color: config.default_color,
						author: { name: `${message.guild.name}`, icon_url: message.guild.iconURL() },
						description: `*The Alpha took a friendly step towards the ${chosenSpecies}.* "It's nice to have you here, ${profileData.name}," *they said. More and more packmates came closer to greet the newcomer.*`,
						footer: { text: 'You are now done setting up your account! Type "rp profile" to look at it. With "rp help" you can see how else you can customize your profile, as well as your other options.' },
					}],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		const botReply = await message
			.reply({
				embeds: [{
					color: config.default_color,
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: `What species is ${profileData.name}?`,
					description: 'If you want an earthly, extant species that is not on the list, open a ticket. Alternatively, you can [learn how to add it yourself here](https://github.com/MaksiRose/paw-and-paper#add-a-species)',
				}],
				components: [{
					type: 'ACTION_ROW',
					components: [{
						type: 'SELECT_MENU',
						customId: 'species-options',
						placeholder: 'Select a species',
						options: selectMenuOptionsArray,
					}],
				}],
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		await interactionCollector();

		async function interactionCollector() {

			const filter = i => (i.values[0] == 'species_page' || speciesMap.has(i.values[0])) && i.user.id == message.author.id;

			const interaction = await botReply
				.awaitMessageComponent({ filter, time: 120000 })
				.catch(() => {return null;});

			if (interaction == null) {

				return await botReply
					.edit({
						components: [],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			if (interaction.values[0] == 'species_page') {

				speciesPage++;
				if (speciesPage >= Math.ceil(speciesNameArray.length / 24)) {

					speciesPage = 0;
				}

				selectMenuOptionsArray = [];

				for (const speciesName of speciesNameArray.slice((speciesPage * 24), 24 + (speciesPage * 24))) {

					selectMenuOptionsArray.push({ label: speciesName, value: speciesName });
				}

				selectMenuOptionsArray.push({ label: 'Show more species options', value: 'species_page', description: `You are currently on page ${speciesPage + 1}`, emoji: '📋' });

				await interaction.message
					.edit({
						components: [{
							type: 'ACTION_ROW',
							components: [{
								type: 'SELECT_MENU',
								customId: 'species-options',
								placeholder: 'Select a species',
								options: selectMenuOptionsArray,
							}],
						}],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				return await interactionCollector();
			}

			if (speciesMap.has(interaction.values[0])) {

				await profileModel.findOneAndUpdate(
					{ userId: message.author.id, serverId: message.guild.id },
					{ $set: { species: interaction.values[0] } },
				);

				return await interaction.message
					.edit({
						embeds: [{
							color: '#9d9e51',
							author: { name: `${message.guild.name}`, icon_url: message.guild.iconURL() },
							description: `*The Alpha took a friendly step towards the ${interaction.values[0]}.* "It's nice to have you here, ${profileData.name}" *they said. More and more packmates came closer to greet the newcomer.*`,
							footer: { text: 'You are now done setting up your account! Type "rp profile" to can look at it. With "rp help" you can see how else you can customize your profile, as well as your other options.' },
						}],
						components: [],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}
		}
	},
};
