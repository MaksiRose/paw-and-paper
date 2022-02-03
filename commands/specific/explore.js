const maps = require('../../utils/maps');
const profileModel = require('../../models/profileModel');
const checkAccountCompletion = require('../../utils/checkAccountCompletion');
const checkValidity = require('../../utils/checkValidity');
const condition = require('../../utils/condition');
const items = require('../../utils/items');
const levels = require('../../utils/levels');
const config = require('../../config.json');
const startCooldown = require('../../utils/startCooldown');

module.exports = {
	name: 'explore',
	aliases: ['e'],
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

		if (await checkAccountCompletion.hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await checkValidity.isInvalid(message, profileData, embedArray, [module.exports.name].concat(module.exports.aliases))) {

			return;
		}

		profileData = await startCooldown(message, profileData);

		if ([...Object.values(profileData.inventoryObject).map(type => Object.values(type))].filter(value => value > 0).length > 25) {

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} approaches the pack borders, ${profileData.pronounArray[2]} mouth filled with various things. As eager as ${profileData.pronounArray[0]} ${(profileData.pronounArray[5] == 'singular') ? 'is' : 'are'} to go exploring, ${profileData.pronounArray[0]} decide${(profileData.pronounArray[5] == 'singular') ? 's' : ''} to store some things away first.*`,
				footer: { text: 'You can only hold up to 25 items in your personal inventory. Type "rp store" to put things into the pack inventory!' },
			});

			return await message
				.reply({
					embeds: embedArray,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		if (profileData.rank == 'Youngling') {

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*A hunter cuts ${profileData.name} as they see ${profileData.pronounArray[1]} running towards the pack borders.* "You don't have enough experience to go into the wilderness, ${profileData.rank}," *they say.*`,
			});

			return await message
				.reply({
					embeds: embedArray,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});
		}

		let chosenBiome = argumentsArray.join(' ').toLowerCase();
		let chosenBiomeNumber = null;
		let allBiomesArray = [];
		const userSpeciesMap = maps.speciesMap.get(profileData.species);

		if (userSpeciesMap.habitat == 'warm') {

			allBiomesArray = ['shrubland', 'savanna', 'desert'];
		}

		if (userSpeciesMap.habitat == 'cold') {

			allBiomesArray = ['forest', 'taiga', 'tundra'];
		}

		if (userSpeciesMap.habitat == 'water') {

			allBiomesArray = ['river', 'coral reef', 'ocean'];
		}


		if (profileData.rank == 'Apprentice') {

			allBiomesArray.length = 1;
		}

		if (profileData.rank == 'Healer' || profileData.rank == 'Hunter') {

			allBiomesArray.length = 2;
		}


		let botReply;

		if (allBiomesArray.includes(chosenBiome)) {

			chosenBiomeNumber = allBiomesArray.findIndex(index => index == chosenBiome);

			embedArray.push({
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: `*${profileData.name} slips out of camp, ${profileData.pronounArray[2]} body disappearing in the morning mist. For a while ${profileData.pronounArray[0]} will look around in the ${chosenBiome}, searching for anything of use…*`,
			});

			botReply = await message
				.reply({
					embeds: embedArray,
				})
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			return await new Promise((resolve) => {
				setTimeout(async function() {
					await startExploring();
					return resolve();
				}, 15000);
			});
		}


		const selectBiomeComponent = {
			type: 'ACTION_ROW',
			components: [{
				type: 'SELECT_MENU',
				customId: 'biome-travel',
				placeholder: 'Select a biome',
				options: [],
			}],
		};

		for (let i = 0; i < allBiomesArray.length; i++) {

			selectBiomeComponent.components[0].options.push({ label: allBiomesArray[i], value: allBiomesArray[i] });
		}

		embedArray.push({
			color: profileData.color,
			author: { name: profileData.name, icon_url: profileData.avatarURL },
			description: `*${profileData.name} is longing for adventure as ${profileData.pronounArray[0]} look${(profileData.pronounArray[5] == 'singular') ? 's' : ''} into the wild outside of camp. All there is to decide is where the journey will lead ${profileData.pronounArray[1]}.*`,
		});

		botReply = await message
			.reply({
				embeds: embedArray,
				components: [selectBiomeComponent],
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		return await new Promise((resolve) => {

			client.on('messageCreate', async function removeExploreComponents(newMessage) {

				if (!botReply || newMessage.author.id != message.author.id || !newMessage.content.toLowerCase().startsWith(config.prefix)) {

					return;
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

				return client.off('messageCreate', removeExploreComponents), resolve();
			});

			async function filter(i) {

				if (!i.message.reference || !i.message.reference.messageId) {

					return false;
				}

				const userMessage = await i.channel.messages
					.fetch(i.message.reference.messageId)
					.catch((error) => {
						throw new Error(error);
					});

				return userMessage.id == message.id && i.customId == 'biome-travel' && i.user.id == message.author.id;
			}

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

				chosenBiome = interaction.values[0];
				chosenBiomeNumber = allBiomesArray.findIndex(index => index == interaction.values[0]);

				embedArray.splice(-1, 1, {
					color: profileData.color,
					author: { name: profileData.name, icon_url: profileData.avatarURL },
					description: `*${profileData.name} slips out of camp, ${profileData.pronounArray[2]} body disappearing in the morning mist. For a while ${profileData.pronounArray[0]} will look around in the ${chosenBiome}, searching for anything of use…*`,
				});

				botReply = await interaction.message
					.edit({
						embeds: embedArray,
						components: [],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				await new Promise((resolve) => {
					setTimeout(async function() {
						await startExploring();
						return resolve();
					}, 15000);
				});
				return resolve();
			});
		});

		async function startExploring() {

			await botReply
				.delete()
				.catch((error) => {
					if (error.httpStatus !== 404) {
						throw new Error(error);
					}
				});

			const thirstPoints = await condition.decreaseThirst(profileData);
			const hungerPoints = await condition.decreaseHunger(profileData);
			const extraLostEnergyPoints = await condition.decreaseEnergy(profileData);
			let energyPoints = Loottable(5, 1) + extraLostEnergyPoints;
			let experiencePoints = 0;
			let healthPoints = 0;
			const userInjuryObject = { ...profileData.injuryObject };

			if (profileData.energy - energyPoints < 0) {

				energyPoints = profileData.energy;
			}

			if (chosenBiomeNumber == 0) {

				experiencePoints = Loottable(11, 5);
			}

			if (chosenBiomeNumber == 1) {
				experiencePoints = Loottable(21, 10);
			}

			if (chosenBiomeNumber == 2) {
				experiencePoints = Loottable(41, 20);
			}

			profileData = await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{
					$inc: {
						experience: +experiencePoints,
						energy: -energyPoints,
						hunger: -hungerPoints,
						thirst: -thirstPoints,
					},
				},
			);

			const embed = {
				color: profileData.color,
				author: { name: profileData.name, icon_url: profileData.avatarURL },
				description: '',
				footer: { text: '' },
			};

			let embedFooterStatsText = `+${experiencePoints} XP (${profileData.experience}/${profileData.levels * 50})\n-${energyPoints} energy (${profileData.energy}/${profileData.maxEnergy})`;

			if (hungerPoints >= 1) {

				embedFooterStatsText += `\n-${hungerPoints} hunger (${profileData.hunger}/${profileData.maxHunger})`;
			}

			if (thirstPoints >= 1) {

				embedFooterStatsText += `\n-${thirstPoints} thirst (${profileData.thirst}/${profileData.maxThirst})`;
			}


			await message.channel
				.sendTyping()
				.catch((error) => {
					throw new Error(error);
				});

			const questChance = Loottable((profileData.rank == 'Elderly') ? 500 : (profileData.rank == 'Hunter' || profileData.rank == 'Healer') ? 400 : 300, 1);

			if (questChance <= 1 && chosenBiomeNumber == (profileData.unlockedRanks - 1) && chosenBiomeNumber == (allBiomesArray.length - 1)) {
				await findQuest();
			}
			else {
				await findSomething();
			}


			await condition.decreaseHealth(message, profileData, botReply);
			await levels.levelCheck(message, profileData, botReply);

			if (await checkValidity.isPassedOut(message, profileData)) {

				await levels.decreaseLevel(message, profileData);
			}


			async function findQuest() {

				await profileModel.findOneAndUpdate(
					{ userId: message.author.id, serverId: message.guild.id },
					{ $set: { hasQuest: true } },
				);

				if (profileData.rank == 'Apprentice') {

					if (userSpeciesMap.habitat == 'warm') {

						embed.description = `*The ${profileData.species} wanders through the peaceful shrubland, carefully surveying the undergrowth around ${profileData.pronounArray[1]}. To ${profileData.pronounArray[2]} left are thick bushes at the bottom of a lone tree. Suddenly ${profileData.name} sees something pink that seems to glisten between the shrubs. Could this be a particularly precious plant? Curious, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'trots' : 'trot')} over to it, but even a closer look doesn't reveal what it is. Determined, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'pushes' : 'push')} into the shrubs but ${((profileData.pronounArray[5] == 'singular') ? 'is' : 'are')} disappointed. It was just an ordinary dog rose. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} ${((profileData.pronounArray[5] == 'singular') ? 'tries' : 'try')} to climb back out, but ${profileData.pronounArray[2]} paw won't move. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} ${((profileData.pronounArray[5] == 'singular') ? 'is' : 'are')} stuck under a bulky root! Now ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'has' : 'have')} to gather all ${profileData.pronounArray[2]} strength in order not to have to stay here forever.*`;
					}

					if (userSpeciesMap.habitat == 'cold') {

						embed.description = `*The ${profileData.species} wanders through the peaceful forest, carefully surveying the undergrowth around ${profileData.pronounArray[1]}. To ${profileData.pronounArray[2]} left is a long, thick tree trunk overgrown with sodden moss. Suddenly ${profileData.name} sees something pink that seems to glisten under the trunk. Could this be a particularly precious plant? Curious, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'trots' : 'trot')} over to it, but even a closer look doesn't reveal what it is. Determined, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'squeezes' : 'squeeze')} down but ${((profileData.pronounArray[5] == 'singular') ? 'is' : 'are')} disappointed. It was just an ordinary dog rose. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} ${((profileData.pronounArray[5] == 'singular') ? 'tries' : 'try')} to climb back out, but the opening is too narrow. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} ${((profileData.pronounArray[5] == 'singular') ? 'is' : 'are')} stuck! Now ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'has' : 'have')} to gather all ${profileData.pronounArray[2]} strength in order not to have to stay here forever.*`;
					}

					if (userSpeciesMap.habitat == 'water') {

						embed.description = `*The ${profileData.species} swims through the peaceful river, carefully surveying the algae around ${profileData.pronounArray[1]}. In front of ${profileData.pronounArray[1]} is a thick strainer, which through the leaves is barely passable even underneath. Suddenly ${profileData.name} sees something pink that seems to glisten at the bottom of the fallen trunk. Could this be a particularly precious plant? Curious, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'swims' : 'swim')} over to it, but even a closer look doesn't reveal what it is. Determined, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'pushes' : 'push')} underneath but ${((profileData.pronounArray[5] == 'singular') ? 'is' : 'are')} disappointed. It was just an ordinary dog rose. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} ${((profileData.pronounArray[5] == 'singular') ? 'tries' : 'try')} to climb back out, but ${profileData.pronounArray[2]} fin won't move. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} ${((profileData.pronounArray[5] == 'singular') ? 'is' : 'are')} stuck! Now ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'has' : 'have')} to gather all ${profileData.pronounArray[2]} strength in order not to have to stay here forever.*`;
					}
				}

				if (profileData.rank == 'Healer' || profileData.rank == 'Hunter') {

					if (userSpeciesMap.habitat == 'warm') {

						embed.description = `*It is a quiet morning in the savanna. Only the rustling of the scarce bushes and trees breaks the silence. ${profileData.name} meanders between the trees, looking for food for ${profileData.pronounArray[2]} pack. But suddenly, the ${profileData.species} hears a motor. Frightened, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'looks' : 'look')} into the distance: indeed, there is a jeep in front of ${profileData.pronounArray[1]}, and it is heading straight for ${profileData.pronounArray[1]}! Now every second counts.*`;
					}

					if (userSpeciesMap.habitat == 'cold') {

						embed.description = `*It is a quiet morning in the taiga. Only the chirping of birds in the trees breaks the silence. ${profileData.name} meanders over the sand, looking for food for ${profileData.pronounArray[2]} pack. But suddenly, the ${profileData.species} hears a motor. Frightened, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'looks' : 'look')} into the distance: indeed, there is a jeep in front of ${profileData.pronounArray[1]}, and it is heading straight for ${profileData.pronounArray[1]}! Now every second counts.*`;
					}

					if (userSpeciesMap.habitat == 'water') {

						embed.description = `*It is a quiet morning in the coral reef. Only once in a while a fish passes by. ${profileData.name} floats through the water, looking for food for ${profileData.pronounArray[2]} pack. But suddenly, the ${profileData.species} hears a motor. Frightened, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'looks' : 'look')} to the surface: indeed, there is a motorboat in front of ${profileData.pronounArray[1]}, and it is heading straight for ${profileData.pronounArray[1]}! Now every second counts.*`;
					}
				}

				if (profileData.rank == 'Elderly') {

					if (userSpeciesMap.habitat == 'warm') {

						embed.description = `*Something is off, the ${profileData.speices} senses it. In the desert, it was strangely quiet, not this peaceful silence, but as if ${profileData.pronounArray[0]} were all alone. ${profileData.name} looks around and can't see a soul far and wide. Then it dawns on ${profileData.pronounArray[1]}. A glance over ${profileData.pronounArray[2]} shoulder confirms ${profileData.pronounArray[2]} fear, a big sandstorm is approaching and coming ${profileData.pronounArray[2]} way. If ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'doesn\'t' : 'don\'t')} hurry now, ${profileData.pronounArray[0]} may never find ${profileData.pronounArray[2]} way back.*`;
					}

					if (userSpeciesMap.habitat == 'cold') {

						embed.description = `*Something is off, the ${profileData.speices} senses it. In the tundra, it was strangely quiet, not this peaceful silence, but as if ${profileData.pronounArray[0]} were all alone. ${profileData.name} looks around and can't see a soul far and wide. Then it dawns on ${profileData.pronounArray[1]}. A glance over ${profileData.pronounArray[2]} shoulder confirms ${profileData.pronounArray[2]} fear, a big snowstorm is approaching and coming ${profileData.pronounArray[2]} way. If ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'doesn\'t' : 'don\'t')} hurry now, ${profileData.pronounArray[0]} may never find ${profileData.pronounArray[2]} way back.*`;
					}

					if (userSpeciesMap.habitat == 'water') {

						embed.description = `*Something is off, the ${profileData.speices} senses it. In the ocean, it was strangely quiet, not this peaceful silence, but as if ${profileData.pronounArray[0]} were all alone. ${profileData.name} looks around and can't see a soul far and wide. Then it dawns on ${profileData.pronounArray[1]}. A glance over ${profileData.pronounArray[2]} shoulder confirms ${profileData.pronounArray[2]} fear, a big landslide is approaching and coming ${profileData.pronounArray[2]} way. If ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'doesn\'t' : 'don\'t')} hurry now, ${profileData.pronounArray[0]} may never find ${profileData.pronounArray[2]} way back.*`;
					}
				}

				embed.footer.text = `Type 'rp quest' to continue!\n\n${embed.footer.text}`;

				embedArray.splice(-1, 1, embed);
				botReply = await message
					.reply({
						embeds: embedArray,
						allowedMentions: { repliedUser: true },
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			async function findSomething() {

				const betterLuckValue = (profileData.levels - 1) * 2;

				const findSomethingChance = weightedTable({ 0: 10, 1: 90 + betterLuckValue });
				if (findSomethingChance == 0) {

					embed.description = `*${profileData.name} trots back into camp, mouth empty, and luck run out. Maybe ${profileData.pronounArray[0]} will go exploring again later, bring something that time!*`;
					embed.footer.text = embedFooterStatsText;

					embedArray.splice(-1, 1, embed);
					return botReply = await message
						.reply({
							embeds: embedArray,
							allowedMentions: { repliedUser: true },
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});
				}

				const findHerbChance = weightedTable({ 0: 1, 1: 1 });
				if (findHerbChance == 0) {

					const getHurtChance = weightedTable({ 0: 10, 1: 90 });
					if (getHurtChance == 0) {

						healthPoints = Loottable(5, 3);

						if (profileData.health - healthPoints < 0) {

							healthPoints = profileData.health;
						}

						profileData = await profileModel.findOneAndUpdate(
							{ userId: message.author.id, serverId: message.guild.id },
							{ $inc: { health: -healthPoints } },
						);

						const weightedHurtChance = weightedTable({ 0: 15, 1: 78, 2: 7 });
						switch (true) {

							case (weightedHurtChance == 0 && profileData.injuryObject.poison == false):

								userInjuryObject.poison = true;

								if (userSpeciesMap.habitat == 'warm') {

									embed.description = `*Piles of sand and lone, scraggly bushes are dotting the landscape all around ${profileData.name}, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'pads' : 'pad')} through the scattered branches from long-dead trees, carefully avoiding the cacti, trying to reach a ribwort plantain they saw. The ${profileData.species} steps on a root but feels it twist and pulse before it leaps from its camouflage and latches onto ${profileData.pronounArray[2]} body. The snake pumps poison into ${profileData.pronounArray[1]} while ${profileData.pronounArray[0]} lash around, trying to throw it off, finally succeeding and rushing away.*`;
								}

								if (userSpeciesMap.habitat == 'cold') {

									embed.description = `*Many sticks and roots are popping up all around ${profileData.name}, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'shuffles' : 'shuffle')} through the fallen branches and twisting vines, trying to reach a ribwort plantain ${profileData.pronounArray[0]} found. The ${profileData.species} steps on a root but feels it weave and pulse before it leaps from its camouflage and latches onto ${profileData.pronounArray[2]} body. The snake pumps poison into ${profileData.pronounArray[1]} while ${profileData.pronounArray[0]} ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'lashes' : 'lash')} around, trying to throw it off, finally succeeding and rushing away.*`;
								}

								if (userSpeciesMap.habitat == 'water') {

									embed.description = `*Many plants and jellyfish are popping up all around ${profileData.name}, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'weaves' : 'weave')} through the jellyfish and twisting kelp, trying to reach a ribwort plantain ${profileData.pronounArray[0]} found. The ${profileData.species} pushes through a piece of kelp but feels it twist and pulse before it latches onto ${profileData.pronounArray[2]} body. The jellyfish wraps ${profileData.pronounArray[1]} with its stingers, poison flowing into ${profileData.pronounArray[1]} while ${profileData.pronounArray[0]} thrash around trying to throw it off, finally succeeding and rushing away to the surface.*`;
								}

								embed.footer.text = `-${healthPoints} HP (from poison)\n${embedFooterStatsText}`;

								break;

							case (weightedHurtChance == 1 && profileData.injuryObject.cold == false):

								userInjuryObject.cold = true;

								if (userSpeciesMap.habitat == 'warm') {

									embed.description = `*${profileData.name} pads along the ground, dashing from bush to bush, inspecting every corner for something ${profileData.pronounArray[0]} could add to the inventory. Suddenly, the ${profileData.species} sways, feeling tired and feeble. A coughing fit grew louder, escaping ${profileData.pronounArray[2]} throat.*`;
								}

								if (userSpeciesMap.habitat == 'cold') {

									embed.description = `*${profileData.name} plots around the forest, dashing from tree to tree, inspecting every corner for something ${profileData.pronounArray[0]} could add to the inventory. Suddenly, the ${profileData.species} sways, feeling tired and feeble. A coughing fit grew louder, escaping ${profileData.pronounArray[2]} throat.*`;
								}

								if (userSpeciesMap.habitat == 'water') {

									embed.description = `*${profileData.name} flips around in the water, swimming from rock to rock, inspecting every nook for something ${profileData.pronounArray[0]} could add to the inventory. Suddenly, the ${profileData.species} falters in ${profileData.pronounArray[2]} stroke, feeling tired and feeble. A coughing fit grew louder, bubbles escaping ${profileData.pronounArray[2]} throat to rise to the surface.*`;
								}

								embed.footer.text = `-${healthPoints} HP (from cold)\n${embedFooterStatsText}`;

								break;

							default:

								userInjuryObject.wounds += 1;

								if (userSpeciesMap.habitat == 'warm') {

									embed.description = `*The soft noise of sand shifting on the ground spooks ${profileData.name} as ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'walks' : 'walk')} around the area, searching for something useful for ${profileData.pronounArray[2]} pack. A warm wind brushes against ${profileData.pronounArray[2]} side, and a cactus bush sweeps atop ${profileData.pronounArray[2]} path, going unnoticed. A needle pricks into ${profileData.pronounArray[2]} skin, sending pain waves through ${profileData.pronounArray[2]} body.*`;
								}

								if (userSpeciesMap.habitat == 'cold') {

									embed.description = `*The thunks of acorns falling from trees spook ${profileData.name} as ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'prances' : 'prance')} around the forest, searching for something useful for ${profileData.pronounArray[2]} pack. A warm wind brushes against ${profileData.pronounArray[2]} side, and a thorn bush sweeps atop ${profileData.pronounArray[2]} path, going unnoticed. A thorn pricks into ${profileData.pronounArray[2]} skin, sending pain waves through ${profileData.pronounArray[2]} body.*`;
								}

								if (userSpeciesMap.habitat == 'water') {

									embed.description = `*The sudden silence in the water spooks ${profileData.name} as ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'swims' : 'swim')} around in the water, searching for something useful for their pack. A rocky outcropping appears next to ${profileData.pronounArray[1]}, unnoticed. The rocks scrape into ${profileData.pronounArray[2]} side, sending shockwaves of pain up ${profileData.pronounArray[2]} flank.*`;
								}
								// THIS IS CHANGED FROM WOUND TO INFECTION LATER
								embed.footer.text = `-${healthPoints} HP (from wound)\n${embedFooterStatsText}`;
						}

						embedArray.splice(-1, 1, embed);
						return botReply = await message
							.reply({
								embeds: embedArray,
								allowedMentions: { repliedUser: true },
							})
							.catch((error) => {
								if (error.httpStatus !== 404) {
									throw new Error(error);
								}
							});
					}

					let foundItem = null;

					switch (true) {

						case (weightedTable({ 0: 70, 1: 30 + betterLuckValue }) == 1 && chosenBiomeNumber > 0):

							switch (true) {

								case (weightedTable({ 0: 70, 1: 30 + betterLuckValue }) == 1 && chosenBiomeNumber == 2):

									foundItem = await items.randomRarePlant(message, profileData);

									break;

								default:

									foundItem = await items.randomUncommonPlant(message, profileData);
							}

							break;

						default:

							foundItem = await items.randomCommonPlant(message, profileData);
					}

					if (userSpeciesMap.habitat == 'warm') {

						embed.description = `*For a while, ${profileData.name} has been trudging through the hot sand, searching in vain for something useful. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} ${((profileData.pronounArray[5] == 'singular') ? 'was' : 'were')} about to give up when ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'discovers' : 'discover')} a ${foundItem} in a small, lone bush. What a find!*`;
					}

					if (userSpeciesMap.habitat == 'cold') {

						embed.description = `*For a while, ${profileData.name} has been trudging through the dense undergrowth, searching in vain for something useful. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} ${((profileData.pronounArray[5] == 'singular') ? 'was' : 'were')} about to give up when ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'discovers' : 'discover')} a ${foundItem} at the end of a tree trunk. What a find!*`;
					}

					if (userSpeciesMap.habitat == 'water') {

						embed.description = `*For a while, ${profileData.name} has been swimming through the water, searching in vain for something useful. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} ${((profileData.pronounArray[5] == 'singular') ? 'was' : 'were')} about to give up when ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'discovers' : 'discover')} a ${foundItem} among large algae. What a find!*`;
					}

					embed.footer.text = `${embedFooterStatsText}\n\n+1 ${foundItem}`;

					embedArray.splice(-1, 1, embed);
					return botReply = await message
						.reply({
							embeds: embedArray,
							allowedMentions: { repliedUser: true },
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});
				}

				let opponentLevel = Loottable(10, 1);
				let opponentsArray = [...userSpeciesMap.biome1OpponentArray];

				if (chosenBiomeNumber == 1) {

					opponentLevel = Loottable(15, 11);
					opponentsArray = [...userSpeciesMap.biome1OpponentArray, ...userSpeciesMap.biome2OpponentArray];
				}

				if (chosenBiomeNumber == 2) {

					opponentLevel = Loottable((profileData.levels > 40) ? profileData.levels - 15 : 25, 26);
					opponentsArray = [...userSpeciesMap.biome1OpponentArray, ...userSpeciesMap.biome2OpponentArray, ...userSpeciesMap.biome3OpponentArray];
				}

				const opponentSpecies = opponentsArray[Loottable(opponentsArray.length, 0)];
				let playerLevel = profileData.levels;

				if (userSpeciesMap.habitat == 'warm') {

					embed.description = `*${profileData.name} creeps close to the ground, ${profileData.pronounArray[2]} pelt blending with the sand surrounding ${profileData.pronounArray[1]}. The ${profileData.species} watches a pile of shrubs, ${profileData.pronounArray[2]} eyes flitting around before catching a motion out of the corner of ${profileData.pronounArray[2]} eyes. A particularly daring ${opponentSpecies} walks on the ground surrounding the bushes before sitting down and cleaning itself.*`;
				}

				if (userSpeciesMap.habitat == 'cold') {

					embed.description = `*${profileData.name} pads silently to the clearing, stopping just shy of leaving the safety of the thick trees that housed ${profileData.pronounArray[2]} pack, camp, and home. A lone ${opponentSpecies} stands in the clearing, snout in the stream that cuts the clearing in two, leaving it unaware of the ${profileData.species} a few meters behind it, ready to pounce.*`;
				}

				if (userSpeciesMap.habitat == 'water') {

					embed.description = `*${profileData.name} hides behind some kelp, looking around the clear water for any prey. A lone ${opponentSpecies} swims around aimlessly, not alarmed of any potential attacks. The ${profileData.species} gets in position, contemplating an ambush.*`;
				}

				embed.footer.text = `The ${opponentSpecies} is level ${opponentLevel}.`;

				embedArray.splice(-1, 1, embed);
				botReply = await message
					.reply({
						embeds: embedArray,
						components: [{
							type: 'ACTION_ROW',
							components: [{
								type: 'BUTTON',
								customId: 'enemy-fight',
								label: 'Fight',
								emoji: { name: '⚔️' },
								style: 'PRIMARY',
								disabled: (profileData.rank == 'Healer') ? true : false,
							}, {
								type: 'BUTTON',
								customId: 'enemy-flee',
								label: 'Flee',
								emoji: { name: '💨' },
								style: 'PRIMARY',
							}],
						}],
						allowedMentions: { repliedUser: true },
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				return await new Promise((resolve) => {

					let filter = async (i) => {

						if (!i.message.reference || !i.message.reference.messageId) {

							return false;
						}

						const userMessage = await i.channel.messages
							.fetch(i.message.reference.messageId)
							.catch((error) => {
								throw new Error(error);
							});

						return i.user.id == message.author.id && userMessage.id == message.id && (i.customId === 'enemy-flee' || i.customId === 'enemy-fight');
					};

					const collector2 = message.channel.createMessageComponentCollector({ filter, max: 1, time: 30000 });
					collector2.on('end', async (collected) => {

						if (!collected.size || collected.first().customId == 'enemy-flee') {

							if (userSpeciesMap.habitat == 'warm') {

								embed.description = `*${profileData.name} eyes the ${opponentSpecies}, which is still unaware of the possible danger. The ${profileData.species} paces, still unsure whether to attack. Suddenly, the ${profileData.species}'s head shoots up as it tries to find the source of the sound before running away. Looks like this hunt was unsuccessful.*`;
							}

							if (userSpeciesMap.habitat == 'cold') {

								embed.description = `*The ${opponentSpecies} sits in the clearing, unaware of ${profileData.name} hiding in the thicket behind it. The ${profileData.species} watches as the animal gets up, shakes the loose water droplets from its mouth, and walks into the forest, its shadow fading from ${profileData.name}'s sight. Looks like this hunt was unsuccessful.*`;
							}

							if (userSpeciesMap.habitat == 'water') {

								embed.description = `*${profileData.name} looks at the ${opponentSpecies}, which is still unaware of ${profileData.pronounArray[1]} watching through the kelp. Subconsciously, the ${profileData.species} starts swimming back and fourth, still unsure whether to attack. The ${opponentSpecies}'s head turns in a flash to eye the suddenly moving kelp before it frantically swims away. Looks like this hunt was unsuccessful.*`;
							}

							embed.footer.text = `${embedFooterStatsText}`;

							embedArray.splice(-1, 1, embed);
							botReply = await botReply
								.edit({
									embeds: embedArray,
									components: [],
								})
								.catch((error) => {
									if (error.httpStatus !== 404) {
										throw new Error(error);
									}
								});

							return resolve();
						}

						const fightComponents = {
							type: 'ACTION_ROW',
							components: [{
								type: 'BUTTON',
								customId: 'fight-attack',
								label: 'Attack',
								emoji: { name: '⏫' },
								style: 'PRIMARY',
							}, {
								type: 'BUTTON',
								customId: 'fight-defend',
								label: 'Defend',
								emoji: { name: '⏺️' },
								style: 'PRIMARY',
							}, {
								type: 'BUTTON',
								customId: 'fight-dodge',
								label: 'Dodge',
								emoji: { name: '↪️' },
								style: 'PRIMARY',
							}],
						};

						let totalRounds = 0;
						let lastRoundKind = '';

						await interactionCollector();

						async function interactionCollector() {

							await newRound();

							filter = async (i) => {

								if (!i.message.reference || !i.message.reference.messageId) {

									return false;
								}

								const userMessage = await i.channel.messages
									.fetch(i.message.reference.messageId)
									.catch((error) => {
										throw new Error(error);
									});

								return userMessage.id == message.id && (i.customId == 'fight-attack' || i.customId == 'fight-defend' || i.customId == 'fight-dodge') && i.user.id == message.author.id;
							};

							const collector3 = message.channel.createMessageComponentCollector({ filter, max: 1, time: 5000 });
							collector3.on('end', async (newCollected) => {

								++totalRounds;

								if (!newCollected.size || (newCollected.first().customId == 'fight-attack' && lastRoundKind == 'dodge') || (newCollected.first().customId == 'fight-defend' && lastRoundKind == 'attack') || (newCollected.first().customId == 'fight-dodge' && lastRoundKind == 'defend')) {

									opponentLevel = opponentLevel + 3;
								}

								if (newCollected.size > 0 && ((newCollected.first().customId == 'fight-attack' && lastRoundKind == 'defend') || (newCollected.first().customId == 'fight-defend' && lastRoundKind == 'dodge') || (newCollected.first().customId == 'fight-dodge' && lastRoundKind == 'attack'))) {

									playerLevel = playerLevel + 3;
								}

								if (totalRounds >= 3) {

									return await fightResult();
								}

								return await interactionCollector();
							});
						}

						function attackDescription() {

							embed.description = `⏫ *The ${opponentSpecies} gets ready to attack. ${profileData.name} must think quickly about how ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'wants' : 'want')} to react.*`;
							lastRoundKind = 'attack';
						}

						function defendDescription() {

							embed.description = `⏺️ *The ${opponentSpecies} gets into position to oppose an attack. ${profileData.name} must think quickly about how ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'wants' : 'want')} to react.*`;
							lastRoundKind = 'defend';
						}

						function dodgeDescription() {

							embed.description = `↪️ *Looks like the ${opponentSpecies} is preparing a maneuver for ${profileData.name}'s next move. The ${profileData.species} must think quickly about how ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'wants' : 'want')} to react.*`;
							lastRoundKind = 'dodge';
						}

						async function newRound() {

							const newRoundArray = ['attack', 'dodge', 'defend'];
							const newRoundArrayIndex = newRoundArray.indexOf(lastRoundKind);

							if (newRoundArrayIndex !== -1) {

								newRoundArray.splice(newRoundArrayIndex, 1);
							}

							const newRoundKind = newRoundArray[Math.floor(Math.random() * newRoundArray.length)];

							if (newRoundKind == 'attack') {

								attackDescription();
							}

							if (newRoundKind == 'dodge') {

								dodgeDescription();
							}

							if (newRoundKind == 'defend') {

								defendDescription();
							}

							embedArray.splice(-1, 1, embed);
							botReply = await botReply
								.edit({
									embeds: embedArray,
									components: [fightComponents],
								})
								.catch((error) => {
									if (error.httpStatus !== 404) {
										throw new Error(error);
									}
								});
						}

						async function fightResult() {

							opponentLevel = Loottable(opponentLevel, 0);
							playerLevel = Loottable(playerLevel, 0);

							if (playerLevel == opponentLevel || playerLevel + 1 == opponentLevel || playerLevel == opponentLevel + 1) {

								if (userSpeciesMap.habitat == 'warm') {

									embed.description = `*${profileData.name} and the ${opponentSpecies} are snarling at one another as they retreat to the opposite sides of the hill, now stirred up and filled with sticks from the surrounding bushes. The ${profileData.species} runs back to camp, ${profileData.pronounArray[2]} mouth empty as before.*`;
								}

								if (userSpeciesMap.habitat == 'cold') {

									embed.description = `*${profileData.name} and the ${opponentSpecies} are snarling at one another as they retreat into the bushes surrounding the clearing, now covered in trampled grass and loose clumps of dirt. The ${profileData.species} runs back to camp, ${profileData.pronounArray[2]} mouth empty as before.*`;
								}

								if (userSpeciesMap.habitat == 'water') {

									embed.description = `*${profileData.name} and the ${opponentSpecies} glance at one another as they swim in opposite directions from the kelp, now cloudy from the stirred up dirt. The ${profileData.species} swims back to camp, ${profileData.pronounArray[2]} mouth empty as before.*`;
								}

								embed.footer.text = `${embedFooterStatsText}`;
							}
							else if (playerLevel > opponentLevel) {

								const userInventory = {
									commonPlants: { ...profileData.inventoryObject.commonPlants },
									uncommonPlants: { ...profileData.inventoryObject.uncommonPlants },
									rarePlants: { ...profileData.inventoryObject.rarePlants },
									meat: { ...profileData.inventoryObject.meat },
								};
								userInventory.meat[opponentSpecies] += 1;

								if (userSpeciesMap.habitat == 'warm') {

									embed.description = `*${profileData.name} shakes the sand from ${profileData.pronounArray[2]} paws, the still figure of the ${opponentSpecies} casting a shadow for ${profileData.pronounArray[1]} to rest in before returning home with the meat. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} ${((profileData.pronounArray[5] == 'singular') ? 'turns' : 'turn')} to the dead ${opponentSpecies} to start dragging it back to camp. The meat would be well-stored in the camp, added to the den of food for the night, after being cleaned.*`;
								}

								if (userSpeciesMap.habitat == 'cold') {

									embed.description = `*${profileData.name} licks ${profileData.pronounArray[2]} paws, freeing the dirt that is under ${profileData.pronounArray[2]} claws. The ${profileData.species} turns to the dead ${opponentSpecies} behind ${profileData.pronounArray[1]}, marveling at the size of it. Then, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'grabs' : 'grab')} the ${opponentSpecies} by the neck, dragging it into the bushes and back to the camp.*`;
								}

								if (userSpeciesMap.habitat == 'water') {

									embed.description = `*The ${profileData.species} swims quickly to the surface, trying to stay as stealthy and unnoticed as possible. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} ${((profileData.pronounArray[5] == 'singular') ? 'break' : 'breaks')} the surface, gain ${profileData.pronounArray[2]} bearing, and the ${profileData.species} begins swimming to the shore, dragging the dead ${opponentSpecies} up the shore to the camp.*`;
								}

								embed.footer.text = `${embedFooterStatsText}\n+1 ${opponentSpecies}`;

								profileData = await profileModel.findOneAndUpdate(
									{ userId: message.author.id, serverId: message.guild.id },
									{ $set: { inventoryObject: userInventory } },
								);
							}
							else if (opponentLevel > playerLevel) {

								healthPoints = Loottable(5, 3);

								if (profileData.health - healthPoints < 0) {

									healthPoints = profileData.health;
								}

								await profileModel.findOneAndUpdate(
									{ userId: message.author.id, serverId: message.guild.id },
									{ $inc: { health: -healthPoints } },
								);

								switch (weightedTable({ 0: 1, 1: 1 })) {

									case 0:

										userInjuryObject.wounds += 1;

										if (userSpeciesMap.habitat == 'warm') {

											embed.description = `*The ${profileData.species} rolls over in the sand, pinned down by the ${opponentSpecies}.* "Get off my territory," *it growls before walking away from the shaking form of ${profileData.name} laying on the sand. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} ${((profileData.pronounArray[5] == 'singular') ? 'lets' : 'let')} the ${opponentSpecies} walk away for a little, trying to put space between the two animals. After catching ${profileData.pronounArray[2]} breath, the ${profileData.species} pulls ${profileData.pronounArray[4]} off the ground, noticing sand sticking to ${profileData.pronounArray[2]} side. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} ${((profileData.pronounArray[5] == 'singular') ? 'shakes' : 'shake')} ${profileData.pronounArray[2]} body, sending bolts of pain up ${profileData.pronounArray[2]} side from the wound. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} slowly ${((profileData.pronounArray[5] == 'singular') ? 'walks' : 'walk')} away from the valley that the ${opponentSpecies} was sitting in before running back towards camp.*`;
										}

										if (userSpeciesMap.habitat == 'cold') {

											embed.description = `*${profileData.name} runs into the brush, trying to avoid making the wound from the ${opponentSpecies} any worse than it already is. The ${profileData.species} stops and confirms that the ${opponentSpecies} isn't following ${profileData.pronounArray[1]}, before walking back inside the camp borders.*`;
										}

										if (userSpeciesMap.habitat == 'water') {

											embed.description = `*Running from the ${opponentSpecies}, ${profileData.name} flips and spins around in the water, trying to escape from the grasp of the animal behind ${profileData.pronounArray[1]}. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} ${((profileData.pronounArray[5] == 'singular') ? 'slips' : 'slip')} into a small crack in a wall, waiting silently for the creature to give up. Finally, the ${opponentSpecies} swims away, leaving the ${profileData.species} alone. Slowly emerging from the crevice, ${profileData.name} flinches away from the wall as ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'hits' : 'hit')} it, a wound making itself known from the fight. Hopefully, it can be treated back at the camp.*`;
										}

										embed.footer.text = `-${healthPoints} HP (from wound)\n${embedFooterStatsText}`;

										break;

									default:

										userInjuryObject.sprains += 1;

										if (userSpeciesMap.habitat == 'warm') {

											embed.description = `*${profileData.name} limps back to camp, ${profileData.pronounArray[2]} paw sprained from the fight with the ${opponentSpecies}. Only barely did ${profileData.pronounArray[0]} get away, leaving the enemy alone in the sand that is now stirred up and filled with sticks from the surrounding bushes. Maybe next time, the ${profileData.species} will be successful in ${profileData.pronounArray[2]} hunt.*`;
										}

										if (userSpeciesMap.habitat == 'cold') {

											embed.description = `*${profileData.name} limps back to camp, ${profileData.pronounArray[2]} paw sprained from the fight with the ${opponentSpecies}. Only barely did ${profileData.pronounArray[0]} get away, leaving the enemy alone in a clearing now filled with trampled grass and dirt clumps. Maybe next time, the ${profileData.species} will be successful in ${profileData.pronounArray[2]} hunt.*`;
										}

										if (userSpeciesMap.habitat == 'water') {

											embed.description = `*${profileData.name} swims back to camp in pain, ${profileData.pronounArray[2]} fin sprained from the fight with the ${opponentSpecies}. Only barely did ${profileData.pronounArray[0]} get away, leaving the enemy alone in the water that is now cloudy from the stirred up dirt. Maybe next time, the ${profileData.species} will be successful in ${profileData.pronounArray[2]} hunt.*`;
										}

										embed.footer.text = `-${healthPoints} HP (from sprain)\n${embedFooterStatsText}`;
								}
							}

							embedArray.splice(-1, 1, embed);
							botReply = await botReply
								.edit({
									embeds: embedArray,
									components: [],
								})
								.catch((error) => {
									if (error.httpStatus !== 404) {
										throw new Error(error);
									}
								});

							return resolve();
						}
					});
				});
			}
		}

		function Loottable(max, min) {

			return Math.floor(Math.random() * max) + min;
		}

		function weightedTable(values) {

			const table = [];

			for (const i in values) {

				for (let j = 0; j < values[i]; j++) {

					table.push(i);
				}
			}

			return table[Math.floor(Math.random() * table.length)];
		}
	},
};
