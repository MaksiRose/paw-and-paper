const profileModel = require('../../models/profileModel');
const startCooldown = require('../../utils/startCooldown');
const { generateRandomNumber, generateWinChance } = require('../../utils/randomizers');
const { speciesMap } = require('../../utils/itemsInfo');
const { hasNotCompletedAccount } = require('../../utils/checkAccountCompletion');
const { isPassedOut, hasCooldown, isResting } = require('../../utils/checkValidity');
const { createCommandCollector } = require('../../utils/commandCollector');

module.exports = {
	name: 'quest',
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

		if (await hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await isPassedOut(message, profileData, false)) {

			return;
		}

		if (await hasCooldown(message, profileData, module.exports.name)) {

			return;
		}

		profileData = await startCooldown(message, profileData);

		await isResting(message, profileData, embedArray);

		if (profileData.hasQuest == false) {

			embedArray.push({
				color: '#9d9e51',
				author: { name: `${message.guild.name}`, icon_url: `${message.guild.iconURL()}` },
				title: 'You have no open quests at the moment :(',
				footer: 'Go playing or exploring to get quests!',
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

		let botReply;
		const filter = i => i.customId.includes('quest') && i.user.id === message.author.id;

		if (argumentsArray[0] == 'start') {

			botReply = await message
				.reply({
					embeds: [{
						color: profileData.color,
						author: { name: profileData.name, icon_url: profileData.avatarURL },
						description: 'Loading...',
					}],
				});

			return await startQuest();
		}

		botReply = await this.introduceQuest(message, profileData, embedArray, '');
		embedArray.pop();

		return await botReply
			.awaitMessageComponent({ filter, time: 30000 })
			.then(async () => await startQuest())
			.catch(async () => {
				return await botReply
					.edit({ components: [] })
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			});

		async function startQuest() {

			profileData = await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { hasQuest: false } },
			);

			let hitEmoji = '';
			let missEmoji = '';
			let hitValue = 1;
			let missValue = 1;

			if (profileData.rank == 'Youngling') {

				hitEmoji = '🪨';
				missEmoji = '⚡';
			}

			if (profileData.rank == 'Apprentice') {

				hitEmoji = '🪵';
				missEmoji = '⚡';
			}

			if (profileData.rank == 'Hunter' || profileData.rank == 'Healer') {

				hitEmoji = '💨';
				missEmoji = '💂';
			}

			if (profileData.rank == 'Elderly') {

				hitEmoji = '💨';

				if (speciesMap.get(profileData.species).habitat == 'warm') {

					missEmoji = '🏜️';
				}

				if (speciesMap.get(profileData.species).habitat == 'cold') {

					missEmoji = '🌨️';
				}

				if (speciesMap.get(profileData.species).habitat == 'water') {

					missEmoji = '⛰️';
				}
			}

			await startNewRound();

			async function startNewRound() {

				const buttonTextOrColor = generateRandomNumber(2, 0) == 0 ? 'color' : 'text';
				const buttonColorKind = generateRandomNumber(3, 0) == 0 ? 'green' : generateRandomNumber(2, 0) == 0 ? 'blue' : 'red';
				let embedFooterText = `Click the ${(buttonTextOrColor == 'color' ? `${buttonColorKind} button` : `button labeled as ${buttonColorKind}`)} to `;

				if (profileData.rank == 'Youngling') {

					embedFooterText += 'push the rock!';
				}

				if (profileData.rank == 'Apprentice') {

					if (speciesMap.get(profileData.species).habitat == 'warm') {

						embedFooterText += 'push the root!';
					}

					if (speciesMap.get(profileData.species).habitat == 'cold' || speciesMap.get(profileData.species).habitat == 'water') {

						embedFooterText += 'push the tree!';
					}
				}

				if (profileData.rank == 'Hunter' || profileData.rank == 'Healer') {

					if (speciesMap.get(profileData.species).habitat == 'warm' || speciesMap.get(profileData.species).habitat == 'cold') {

						embedFooterText += 'run from the humans!';
					}

					if (speciesMap.get(profileData.species).habitat == 'water') {

						embedFooterText += 'swim from the humans!';
					}
				}

				if (profileData.rank == 'Elderly') {

					if (speciesMap.get(profileData.species).habitat == 'warm') {

						embedFooterText += 'run from the sandstorm!';
					}

					if (speciesMap.get(profileData.species).habitat == 'cold') {

						embedFooterText += 'run from the snowstorm!';
					}

					if (speciesMap.get(profileData.species).habitat == 'water') {

						embedFooterText += 'swim from the underwater landslide!';
					}
				}

				embedFooterText += ' But watch out for your energy bar.\nSometimes you will lose energy even if choose right, depending on how many levels you have.';

				embedArray.push({
					color: `${profileData.color}`,
					author: { name: `${profileData.name}`, icon_url: `${profileData.avatarURL}` },
					description: `${drawProgressbar(hitValue, hitEmoji)}\n${drawProgressbar(missValue, missEmoji)}`,
					footer: { text: embedFooterText },
				});

				const buttonArray = [
					[
						{
							type: 'BUTTON',
							label: 'Blue',
							customId: 'quest-bluetext-redcolor',
							style: 'DANGER',
						},
						{
							type: 'BUTTON',
							label: 'Red',
							customId: 'quest-redtext-bluecolor',
							style: 'PRIMARY',
						},
						{
							type: 'BUTTON',
							label: 'Green',
							customId: 'quest-greentext-greencolor',
							style: 'SUCCESS',
						},
					],
					[
						{
							type: 'BUTTON',
							label: 'Green',
							customId: 'quest-greentext-redcolor',
							style: 'DANGER',
						},
						{
							type: 'BUTTON',
							label: 'Blue',
							customId: 'quest-bluetext-bluecolor',
							style: 'PRIMARY',
						},
						{
							type: 'BUTTON',
							label: 'Red',
							customId: 'quest-redtext-greencolor',
							style: 'SUCCESS',
						},
					],
					[
						{
							type: 'BUTTON',
							label: 'Red',
							customId: 'quest-redtext-redcolor',
							style: 'DANGER',
						},
						{
							type: 'BUTTON',
							label: 'Green',
							customId: 'quest-greentext-bluecolor',
							style: 'PRIMARY',
						},
						{
							type: 'BUTTON',
							label: 'Blue',
							customId: 'quest-bluetext-greencolor',
							style: 'SUCCESS',
						},
					],
				][generateRandomNumber(3, 0)].sort(() => Math.random() - 0.5);

				botReply = await botReply
					.edit({
						content: null,
						embeds: embedArray,
						components: [{
							type: 'ACTION_ROW',
							components: buttonArray,
						}],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});

				const interaction = await botReply
					.awaitMessageComponent({ filter, time: 5000 })
					.catch(() => {return null;});

				const winChance = generateWinChance(profileData.levels, profileData.rank == 'Elderly' ? 35 : (profileData.rank == 'Hunter' || profileData.rank == 'Healer') ? 20 : profileData.rank == 'Apprentice' ? 10 : 2);

				if (interaction == null || !interaction.customId.includes(`${buttonColorKind}${buttonTextOrColor}`) || generateRandomNumber(100, 0) > winChance) {

					++missValue;
				}
				else {
					++hitValue;
				}

				embedArray.splice(-1, 1);
				if (hitValue >= 10) {

					if (profileData.unlockedRanks < 3) {

						await profileModel.findOneAndUpdate(
							{ userId: message.author.id, serverId: message.guild.id },
							{ $inc: { unlockedRanks: +1 } },
						);
					}

					let description = '';
					let footer = 'Type \'rp rank\' to rank up';

					if (profileData.rank == 'Youngling') {

						description = `*A large thump erupts into the forest, sending flocks of crows fleeing to the sky. ${profileData.name} collapses, panting and yearning for breath after the difficult task of pushing the giant boulder. Another ${profileData.species} runs out of the cave, jumping around ${profileData.name} with relief. Suddenly, an Elderly shows up behind the two.*\n"Well done, Youngling, you have proven to be worthy of the Apprentice status. If you ever choose to rank up, just come to me," *the proud elder says with a raspy voice.*`;
					}

					if (profileData.rank == 'Apprentice') {

						if (speciesMap.get(profileData.species).habitat == 'warm') {

							description = `*After fighting with the trunk for a while, the ${profileData.species} now slips out with slightly ruffled fur. ${profileData.name} shakes ${profileData.pronounArray[4]}. Just at this moment, a worried Elderly comes running.*\n"Is everything alright? You've been gone for a while, and we heard cries of pain, so we were worried!" *They look over to the tree trunk.*\n"Oh, looks like you've already solved the problem yourself! Very well done! I think you're ready to become a Hunter or Healer if you're ever interested."`;
						}

						if (speciesMap.get(profileData.species).habitat == 'cold') {

							description = `*After fighting with the root for a while, the ${profileData.species} now slips out with slightly ruffled fur. ${profileData.name} shakes ${profileData.pronounArray[4]}. Just at this moment, a worried Elderly comes running.*\n"Is everything alright? You've been gone for a while, and we heard cries of pain, so we were worried!" *They look over to the bush.*\n"Oh, looks like you've already solved the problem yourself! Very well done! I think you're ready to become a Hunter or Healer if you're ever interested."`;
						}

						if (speciesMap.get(profileData.species).habitat == 'water') {

							description = `*After fighting with the trunk for a while, the ${profileData.species} now slips out. ${profileData.name} shakes ${profileData.pronounArray[4]}. Just at this moment, a worried Elderly comes swimming.*\n"Is everything alright? You've been gone for a while, and we heard cries of pain, so we were worried!" *They look over to the bush.*\n"Oh, looks like you've already solved the problem yourself! Very well done! I think you're ready to become a Hunter or Healer if you're ever interested."`;
						}
					}

					if (profileData.rank == 'Hunter' || profileData.rank == 'Healer') {

						if (speciesMap.get(profileData.species).habitat == 'warm' || speciesMap.get(profileData.species).habitat == 'cold') {

							description = `*The engine noise became quieter and quieter before it finally disappeared entirely after endless maneuvers. Relieved, the ${profileData.species} runs to the pack, which is not far away. An Elderly is already coming towards ${profileData.pronounArray[1]}.*\n"You're alright! We heard the humans. And you didn't lead them straight to us, very good! Your wisdom, skill, and experience qualify you as an Elderly, ${profileData.name}. I'll talk to the other Elderlies about it. Just let me know if you want to join us."`;
						}

						if (speciesMap.get(profileData.species).habitat == 'water') {

							description = `*The engine noise became quieter and quieter before it finally disappeared entirely after endless maneuvers. Relieved, the ${profileData.species} swims to the pack, which is not far away. An Elderly is already swimming towards ${profileData.pronounArray[1]}.*\n"You're alright! We heard the humans. And you didn't lead them straight to us, very good! Your wisdom, skill, and experience qualify you as an Elderly, ${profileData.name}. I'll talk to the other Elderlies about it. Just let me know if you want to join us."`;
						}
					}

					if (profileData.rank == 'Elderly') {

						if (speciesMap.get(profileData.species).habitat == 'warm' || speciesMap.get(profileData.species).habitat == 'cold') {

							description = `*The ${profileData.species} runs for a while before the situation seems to clear up. ${profileData.name} gasps in exhaustion. That was close. Full of adrenaline, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'goes' : 'go')} back to the pack. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} feels strangely stronger than before.*`;
						}

						if (speciesMap.get(profileData.species).habitat == 'water') {

							description = `*The ${profileData.species} runs for a while before the situation seems to clear up. ${profileData.name} gasps in exhaustion. That was close. Full of adrenaline, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'swims' : 'swim')} back to the pack. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} feels strangely stronger than before.*`;
						}

						let maxHealthPoints = 0;
						let maxEnergyPoints = 0;
						let maxHungerPoints = 0;
						let maxThirstPoints = 0;

						const random = Math.floor(Math.random() * 4);

						if (random == 0) {
							maxHealthPoints = 10;
							footer = '+10 maximum health\n\n';
						}
						else if (random == 1) {
							maxEnergyPoints = 10;
							footer = '+10 maximum energy\n\n';
						}
						else if (random == 2) {
							maxHungerPoints = 10;
							footer = '+10 maximum hunger\n\n';
						}
						else {
							maxThirstPoints = 10;
							footer = '+10 maximum thirst\n\n';
						}

						await profileModel.findOneAndUpdate(
							{ userId: message.author.id, serverId: message.guild.id },
							{
								$inc: {
									maxHealth: maxHealthPoints,
									maxEnergy: maxEnergyPoints,
									maxHunger: maxHungerPoints,
									maxThirst: maxThirstPoints,
								},
							},
						);
					}

					embedArray.push({
						color: `${profileData.color}`,
						author: { name: `${profileData.name}`, icon_url: `${profileData.avatarURL}` },
						description: description,
						footer: { text: footer },
					});

					return await botReply
						.edit({
							embeds: embedArray,
							components: [],
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});
				}
				else if (missValue >= 10) {

					let description = '';

					if (profileData.rank == 'Youngling') {

						description = `"I can't... I can't do it," *${profileData.name} heaves, ${profileData.pronounArray[2]} chest struggling to fall and rise.\nSuddenly the boulder shakes and falls away from the cave entrance.*\n"You are too weak for a task like this. Come back to camp, Youngling." *The Elderly turns around and slowly walks back towards camp, not dwelling long by the exhausted ${profileData.species}.*`;
					}

					if (profileData.rank == 'Apprentice') {

						if (speciesMap.get(profileData.species).habitat == 'warm') {

							description = `*No matter how long the ${profileData.species} pulls and tugs, ${profileData.pronounArray[0]} just can't break free. ${profileData.name} lies there for a while until finally, an Elderly comes. Two other packmates that accompany them are anxiously looking out.*\n"That's ${profileData.pronounArray[1]}!" *the Elderly shouts. The other two run to the ${profileData.species} and bite away the root.*\n"Are you all right? Thank goodness we found you!" *the Elderly asks.*`;
						}

						if (speciesMap.get(profileData.species).habitat == 'cold') {

							description = `*No matter how long the ${profileData.species} pulls and tugs, ${profileData.pronounArray[0]} just can't break free. ${profileData.name} lies there for a while until finally, an Elderly comes. Two other packmates that accompany them are anxiously looking out.*\n"That's ${profileData.pronounArray[1]}!" *the Elderly shouts. The other two run to the ${profileData.species} and pull him out from under the log with their mouths.*\n"Are you all right? Thank goodness we found you!" *the Elderly asks.*`;
						}

						if (speciesMap.get(profileData.species).habitat == 'water') {

							description = `*No matter how long the ${profileData.species} pulls and tugs, ${profileData.pronounArray[0]} just can't break free. ${profileData.name} lies there for a while until finally, an Elderly comes. Two other packmates that accompany them are anxiously looking out.*\n"That's ${profileData.pronounArray[1]}!" *the Elderly shouts. The other two run to the ${profileData.species} and push him away from the log with their heads.*\n"Are you all right? Thank goodness we found you!" *the Elderly asks.*`;
						}
					}

					if (profileData.rank == 'Hunter' || profileData.rank == 'Healer') {

						if (speciesMap.get(profileData.species).habitat == 'warm' || speciesMap.get(profileData.species).habitat == 'cold') {

							description = `*It almost looks like the humans are catching up to the ${profileData.species} when suddenly a larger ${profileData.species} comes running from the side. They pick up ${profileData.name} and run sideways as fast as lightning. Before ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'knows' : 'know')} what has happened to ${profileData.pronounArray[1]}, they are already out of reach.*\n"That was close," *the Elderly says.* "Good thing I was nearby."`;
						}

						if (speciesMap.get(profileData.species).habitat == 'water') {

							description = `*It almost looks like the humans are catching up to the ${profileData.species} when suddenly a larger ${profileData.species} comes swimming from the side. They push away ${profileData.name} with their head and swim sideways as fast as lightning. Before ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'knows' : 'know')} what has happened to ${profileData.pronounArray[1]}, they are already out of reach.*\n"That was close," *the Elderly says.* "Good thing I was nearby."`;
						}
					}

					if (profileData.rank == 'Elderly') {

						if (speciesMap.get(profileData.species).habitat == 'warm' || speciesMap.get(profileData.species).habitat == 'cold') {

							description = `*The ${profileData.species} gasps as ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'drops' : 'drop')} down to the ground, defeated. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)}'${((profileData.pronounArray[5] == 'singular') ? 's' : 're')} just not fast enough... Suddenly ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'is' : 'are')} lifted by the neck. Another ${profileData.species} has ${profileData.pronounArray[1]} in their mouth and runs as fast as they can. ${profileData.name} is saved!*`;
						}

						if (speciesMap.get(profileData.species).habitat == 'water') {

							description = `*The ${profileData.species} gasps as ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'stops' : 'stop')} swimming, defeated. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)}'${((profileData.pronounArray[5] == 'singular') ? 's' : 're')} just not fast enough... Suddenly ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'feels' : 'feel')} a thrust from the side. Another ${profileData.species} pushes into them with their head and swims as fast as they can. ${profileData.name} is saved!*`;
						}
					}

					embedArray.push({
						color: `${profileData.color}`,
						author: { name: `${profileData.name}`, icon_url: `${profileData.avatarURL}` },
						description: description,
					});

					return await botReply
						.edit({
							embeds: embedArray,
							components: [],
						})
						.catch((error) => {
							if (error.httpStatus !== 404) {
								throw new Error(error);
							}
						});
				}
				else {

					return await startNewRound();
				}
			}

			function drawProgressbar(index, replacement) {

				const barEmoji = '◻️';
				return barEmoji.repeat(index - 1) + replacement + barEmoji.repeat(10 - index);
			}
		}
	},
	async introduceQuest(message, profileData, embedArray, footerText) {

		const embed = {
			color: profileData.color,
			author: { name: profileData.name, icon_url: profileData.avatarURL },
			description: '',
			footer: { text: '' },
		};

		if (profileData.rank == 'Youngling') {

			embed.description = `*${profileData.name} lifts ${profileData.pronounArray[2]} head to investigate the sound of a faint cry. Almost sure that it was someone in need of help, ${profileData.pronounArray[0]} dashes from where ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'is' : 'are')} standing and bolts for the sound. Soon ${profileData.name} comes along to the intimidating mouth of a dark cave covered by a boulder. The cries for help still ricocheting through ${profileData.pronounArray[2]} brain. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} must help them...*`;
		}

		if (profileData.rank == 'Apprentice') {

			if (speciesMap.get(profileData.species).habitat == 'warm') {

				embed.description = `*The ${profileData.species} wanders through the peaceful shrubland, carefully surveying the undergrowth around ${profileData.pronounArray[1]}. To ${profileData.pronounArray[2]} left are thick bushes at the bottom of a lone tree. Suddenly ${profileData.name} sees something pink that seems to glisten between the shrubs. Could this be a particularly precious plant? Curious, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'trots' : 'trot')} over to it, but even a closer look doesn't reveal what it is. Determined, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'pushes' : 'push')} into the shrubs but ${((profileData.pronounArray[5] == 'singular') ? 'is' : 'are')} disappointed. It was just an ordinary dog rose. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} ${((profileData.pronounArray[5] == 'singular') ? 'tries' : 'try')} to climb back out, but ${profileData.pronounArray[2]} paw won't move. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} ${((profileData.pronounArray[5] == 'singular') ? 'is' : 'are')} stuck under a bulky root! Now ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'has' : 'have')} to gather all ${profileData.pronounArray[2]} strength in order not to have to stay here forever.*`;
			}

			if (speciesMap.get(profileData.species).habitat == 'cold') {

				embed.description = `*The ${profileData.species} wanders through the peaceful forest, carefully surveying the undergrowth around ${profileData.pronounArray[1]}. To ${profileData.pronounArray[2]} left is a long, thick tree trunk overgrown with sodden moss. Suddenly ${profileData.name} sees something pink that seems to glisten under the trunk. Could this be a particularly precious plant? Curious, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'trots' : 'trot')} over to it, but even a closer look doesn't reveal what it is. Determined, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'squeezes' : 'squeeze')} down but ${((profileData.pronounArray[5] == 'singular') ? 'is' : 'are')} disappointed. It was just an ordinary dog rose. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} ${((profileData.pronounArray[5] == 'singular') ? 'tries' : 'try')} to climb back out, but the opening is too narrow. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} ${((profileData.pronounArray[5] == 'singular') ? 'is' : 'are')} stuck! Now ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'has' : 'have')} to gather all ${profileData.pronounArray[2]} strength in order not to have to stay here forever.*`;
			}

			if (speciesMap.get(profileData.species).habitat == 'water') {

				embed.description = `*The ${profileData.species} swims through the peaceful river, carefully surveying the algae around ${profileData.pronounArray[1]}. In front of ${profileData.pronounArray[1]} is a thick strainer, which through the leaves is barely passable even underneath. Suddenly ${profileData.name} sees something pink that seems to glisten at the bottom of the fallen trunk. Could this be a particularly precious plant? Curious, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'swims' : 'swim')} over to it, but even a closer look doesn't reveal what it is. Determined, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'pushes' : 'push')} underneath but ${((profileData.pronounArray[5] == 'singular') ? 'is' : 'are')} disappointed. It was just an ordinary dog rose. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} ${((profileData.pronounArray[5] == 'singular') ? 'tries' : 'try')} to climb back out, but ${profileData.pronounArray[2]} fin won't move. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} ${((profileData.pronounArray[5] == 'singular') ? 'is' : 'are')} stuck! Now ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'has' : 'have')} to gather all ${profileData.pronounArray[2]} strength in order not to have to stay here forever.*`;
			}
		}

		if (profileData.rank == 'Healer' || profileData.rank == 'Hunter') {

			if (speciesMap.get(profileData.species).habitat == 'warm') {

				embed.description = `*It is a quiet morning in the savanna. Only the rustling of the scarce bushes and trees breaks the silence. ${profileData.name} meanders between the trees, looking for food for ${profileData.pronounArray[2]} pack. But suddenly, the ${profileData.species} hears a motor. Frightened, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'looks' : 'look')} into the distance: indeed, there is a jeep in front of ${profileData.pronounArray[1]}, and it is heading straight for ${profileData.pronounArray[1]}! Now every second counts.*`;
			}

			if (speciesMap.get(profileData.species).habitat == 'cold') {

				embed.description = `*It is a quiet morning in the taiga. Only the chirping of birds in the trees breaks the silence. ${profileData.name} meanders over the sand, looking for food for ${profileData.pronounArray[2]} pack. But suddenly, the ${profileData.species} hears a motor. Frightened, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'looks' : 'look')} into the distance: indeed, there is a jeep in front of ${profileData.pronounArray[1]}, and it is heading straight for ${profileData.pronounArray[1]}! Now every second counts.*`;
			}

			if (speciesMap.get(profileData.species).habitat == 'water') {

				embed.description = `*It is a quiet morning in the coral reef. Only once in a while a fish passes by. ${profileData.name} floats through the water, looking for food for ${profileData.pronounArray[2]} pack. But suddenly, the ${profileData.species} hears a motor. Frightened, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'looks' : 'look')} to the surface: indeed, there is a motorboat in front of ${profileData.pronounArray[1]}, and it is heading straight for ${profileData.pronounArray[1]}! Now every second counts.*`;
			}
		}

		if (profileData.rank == 'Elderly') {

			if (speciesMap.get(profileData.species).habitat == 'warm') {

				embed.description = `*Something is off, the ${profileData.speices} senses it. In the desert, it was strangely quiet, not this peaceful silence, but as if ${profileData.pronounArray[0]} were all alone. ${profileData.name} looks around and can't see a soul far and wide. Then it dawns on ${profileData.pronounArray[1]}. A glance over ${profileData.pronounArray[2]} shoulder confirms ${profileData.pronounArray[2]} fear, a big sandstorm is approaching and coming ${profileData.pronounArray[2]} way. If ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'doesn\'t' : 'don\'t')} hurry now, ${profileData.pronounArray[0]} may never find ${profileData.pronounArray[2]} way back.*`;
			}

			if (speciesMap.get(profileData.species).habitat == 'cold') {

				embed.description = `*Something is off, the ${profileData.speices} senses it. In the tundra, it was strangely quiet, not this peaceful silence, but as if ${profileData.pronounArray[0]} were all alone. ${profileData.name} looks around and can't see a soul far and wide. Then it dawns on ${profileData.pronounArray[1]}. A glance over ${profileData.pronounArray[2]} shoulder confirms ${profileData.pronounArray[2]} fear, a big snowstorm is approaching and coming ${profileData.pronounArray[2]} way. If ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'doesn\'t' : 'don\'t')} hurry now, ${profileData.pronounArray[0]} may never find ${profileData.pronounArray[2]} way back.*`;
			}

			if (speciesMap.get(profileData.species).habitat == 'water') {

				embed.description = `*Something is off, the ${profileData.speices} senses it. In the ocean, it was strangely quiet, not this peaceful silence, but as if ${profileData.pronounArray[0]} were all alone. ${profileData.name} looks around and can't see a soul far and wide. Then it dawns on ${profileData.pronounArray[1]}. A glance over ${profileData.pronounArray[2]} shoulder confirms ${profileData.pronounArray[2]} fear, a big landslide is approaching and coming ${profileData.pronounArray[2]} way. If ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'doesn\'t' : 'don\'t')} hurry now, ${profileData.pronounArray[0]} may never find ${profileData.pronounArray[2]} way back.*`;
			}
		}

		embed.footer.text = `${footerText}\n\nClick the button to continue! Level ${profileData.rank == 'Elderly' ? '35' : (profileData.rank == 'Hunter' || profileData.rank == 'Healer') ? '20' : profileData.rank == 'Apprentice' ? '10' : '2'} is recommended for this.`;


		embedArray.push(embed);
		const botReply = await message
			.reply({
				content: `<@${message.author.id}>`,
				embeds: embedArray,
				components: [{
					type: 'ACTION_ROW',
					components: [{
						type: 'BUTTON',
						customId: 'quest-start',
						label: 'Start quest',
						emoji: { name: '⭐' },
						style: 'SUCCESS',
					}],
				}],
			})
			.catch((error) => {
				if (error.httpStatus !== 404) {
					throw new Error(error);
				}
			});

		createCommandCollector(message.author.id, message.guild.id, botReply);

		return botReply;
	},
};
