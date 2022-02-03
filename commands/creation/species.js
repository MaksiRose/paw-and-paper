const config = require('../../config.json');
const profileModel = require('../../models/profileModel');
const maps = require('../../utils/maps');
const checkAccountCompletion = require('../../utils/checkAccountCompletion');
const startCooldown = require('../../utils/startCooldown');

module.exports = {
	name: 'species',
	async sendMessage(client, message, argumentsArray, profileData) {

		if (await checkAccountCompletion.hasNoName(message, profileData)) {

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
		const speciesNameArray = [...maps.speciesMap.keys()].sort();
		let selectMenuOptionsArray = new Array();
		let speciesPage = 0;

		for (const speciesName of speciesNameArray.slice(0, 24)) {

			selectMenuOptionsArray.push({ label: speciesName, value: speciesName });
		}

		if (speciesNameArray.length > 25) {

			selectMenuOptionsArray.push({ label: 'Show more species options', value: 'species_page', description: 'You are currently on page 1', emoji: '📋' });
		}


		if (chosenSpecies != null && maps.speciesMap.has(chosenSpecies)) {

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

		const maksi = await client.users
			.fetch(config.maksi)
			.catch((error) => {
				throw new Error(error);
			});

		const botReply = await message
			.reply({
				embeds: [{
					color: config.default_color,
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: `What species is ${profileData.name}?`,
					footer: { text: `If you want an earthly species that is not on the list, contact ${maksi.tag}. Seriously, just ask. It takes one minute and I'll be happy to do it.` },
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

		client.on('messageCreate', async function removeSpeciesComponents(newMessage) {

			if (!botReply || newMessage.author.id != message.author.id || newMessage.content.startsWith(config.prefix)) {

				return;
			}

			if (!newMessage.channel.messages.cache.get(botReply.id)) {

				return client.off('messageCreate', removeSpeciesComponents);
			}

			await botReply
				.edit({
					components: [],
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			return client.off('messageCreate', removeSpeciesComponents);
		});

		await interactionCollector();

		async function interactionCollector() {

			const filter = async (i) => {

				if (!i.message.reference || !i.message.reference.messageId) {

					return false;
				}

				const userMessage = await i.channel.messages.fetch(i.message.reference.messageId);
				return userMessage.id == message.id && (i.values[0] == 'species_page' || maps.speciesMap.has(i.values[0])) && i.user.id == message.author.id;
			};

			const collector = message.channel.createMessageComponentCollector({ filter, max: 1, time: 120000 });
			collector.on('end', async (collected) => {

				if (!collected.size) {

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

				const interaction = collected.first();

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

				if (maps.speciesMap.has(interaction.values[0])) {

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
			});
		}
	},
};