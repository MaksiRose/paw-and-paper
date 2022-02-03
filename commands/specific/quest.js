const checkAccountCompletion = require('../../utils/checkAccountCompletion');
const checkValidity = require('../../utils/checkValidity');
const maps = require('../../utils/maps');
const profileModel = require('../../models/profileModel');
const startCooldown = require('../../utils/startCooldown');

module.exports = {
	name: 'quest',
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

		if (await checkAccountCompletion.hasNotCompletedAccount(message, profileData)) {

			return;
		}

		if (await checkValidity.isPassedOut(message, profileData)) {

			return;
		}

		if (await checkValidity.hasCooldown(message, profileData, module.exports.name)) {

			return;
		}

		await checkValidity.isResting(message, profileData, embedArray);

		profileData = await startCooldown(message, profileData);

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

		await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { hasQuest: false } },
		);

		let hitEmoji = '';
		let missEmoji = '';
		let hitValue = 1;
		let missValue = 1;

		if (profileData.rank == 'Youngling') {

			// rock emoji
			hitEmoji = '🪨';
			missEmoji = '⚡';
		}

		if (profileData.rank == 'Apprentice') {

			// wood emoji
			hitEmoji = '🪵';
			missEmoji = '⚡';
		}

		if (profileData.rank == 'Hunter' || profileData.rank == 'Healer') {

			hitEmoji = '💨';
			missEmoji = '💂';
		}

		if (profileData.rank == 'Elderly') {

			hitEmoji = '💨';

			if (maps.speciesMap.get(profileData.species).habitat == 'warm') {

				missEmoji = '🏜️';
			}

			if (maps.speciesMap.get(profileData.species).habitat == 'cold') {

				missEmoji = '🌨️';
			}

			if (maps.speciesMap.get(profileData.species).habitat == 'water') {

				missEmoji = '⛰️';
			}
		}

		let botReply;
		await quest(true);

		async function quest(first) {

			const buttonTextOrColor = ((Math.floor(Math.random() * 2) == 0) ? 'color' : 'text');
			const buttonColorKind = ((Math.floor(Math.random() * 3) == 0) ? 'green' : ((Math.floor(Math.random() * 2) == 0) ? 'blue' : 'red'));
			let embedFooterText = `Click the ${((buttonTextOrColor == 'color') ? `${buttonColorKind} button` : `button labeled "${buttonColorKind.charAt(0).toUpperCase()}${buttonColorKind.slice(1)}"`)} to `;

			if (profileData.rank == 'Youngling') {

				embedFooterText += 'push the rock!';
			}

			if (profileData.rank == 'Apprentice') {

				if (maps.speciesMap.get(profileData.species).habitat == 'warm') {

					embedFooterText += 'push the root!';
				}

				if (maps.speciesMap.get(profileData.species).habitat == 'cold' || maps.speciesMap.get(profileData.species).habitat == 'water') {

					embedFooterText += 'push the tree!';
				}
			}

			if (profileData.rank == 'Hunter' || profileData.rank == 'Healer') {

				if (maps.speciesMap.get(profileData.species).habitat == 'warm' || maps.speciesMap.get(profileData.species).habitat == 'cold') {

					embedFooterText += 'run from the humans!';
				}

				if (maps.speciesMap.get(profileData.species).habitat == 'water') {

					embedFooterText += 'swim from the humans!';
				}
			}

			if (profileData.rank == 'Elderly') {

				if (maps.speciesMap.get(profileData.species).habitat == 'warm') {

					embedFooterText += 'run from the sandstorm!';
				}

				if (maps.speciesMap.get(profileData.species).habitat == 'cold') {

					embedFooterText += 'run from the snowstorm!';
				}

				if (maps.speciesMap.get(profileData.species).habitat == 'water') {

					embedFooterText += 'swim from the underwater landslide!';
				}
			}

			embedFooterText += 'But watch out for your energy bar.\nSometimes you will lose energy even if choose right, depending on how many levels you have.';

			embedArray.push({
				color: `${profileData.color}`,
				author: { name: `${profileData.name}`, icon_url: `${profileData.avatarURL}` },
				description: `${progressbar(hitValue, hitEmoji)}\n${progressbar(missValue, missEmoji)}`,
				footer: {
					text: embedFooterText,
				},
			});

			const allComponentsArray = [
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
			];

			/*
			allComponentsArray has three Arrays of different Buttons
			finalComponentArray is assigned one of those three Arrays, containing three Buttons
			In the while Loop, the Buttons are randomly rearranged
			This is done by assigning the highest Array Index to highestArrayIndex, then swapping that Array position with any position lower or equal to itself, and then lowering highestArrayIndex
			*/
			const finalComponentArray = allComponentsArray[Math.floor((Math.random() * 3))];

			let highestArrayIndex = finalComponentArray.length - 1;
			while (highestArrayIndex != 0) {

				const randomArrayIndex = Math.floor(Math.random() * highestArrayIndex);

				// this swaps positions of highestArrayIndex with randomArrayIndex
				const temporaryElement = finalComponentArray[highestArrayIndex];
				finalComponentArray[highestArrayIndex] = finalComponentArray[randomArrayIndex];
				finalComponentArray[randomArrayIndex] = temporaryElement;

				highestArrayIndex -= 1;
			}

			if (first) {

				botReply = await message
					.reply({
						embeds: embedArray,
						components: [{
							type: 'ACTION_ROW',
							components: finalComponentArray,
						}],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}
			else {

				botReply = await botReply
					.edit({
						embeds: embedArray,
						components: [{
							type: 'ACTION_ROW',
							components: finalComponentArray,
						}],
					})
					.catch((error) => {
						if (error.httpStatus !== 404) {
							throw new Error(error);
						}
					});
			}

			return await new Promise((resolve) => {

				const filter = i => i.customId.includes('quest') && i.user.id === message.author.id;

				const collector = message.channel.createMessageComponentCollector({ filter, max: 1, time: 5000 });
				collector.on('end', async collected => {

					const winChance = sigmoidFunction(profileData.levels, (profileData.rank == 'Elderly') ? 35 : (profileData.rank == 'Hunter' || profileData.rank == 'Healer') ? 20 : (profileData.rank == 'Apprentice') ? 10 : 2);

					if (collected.size == 0 || !collected.first().customId.includes(`${buttonColorKind}${buttonTextOrColor}`) || Math.floor(Math.random() * 100) + 1 > winChance) {

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

							if (maps.speciesMap.get(profileData.species).habitat == 'warm') {

								description = `*After fighting with the trunk for a while, the ${profileData.species} now slips out with slightly ruffled fur. ${profileData.name} shakes ${profileData.pronounArray[4]}. Just at this moment, a worried Elderly comes running.*\n"Is everything alright? You've been gone for a while, and we heard cries of pain, so we were worried!" *They look over to the tree trunk.*\n"Oh, looks like you've already solved the problem yourself! Very well done! I think you're ready to become a Hunter or Healer if you're ever interested."`;
							}

							if (maps.speciesMap.get(profileData.species).habitat == 'cold') {

								description = `*After fighting with the root for a while, the ${profileData.species} now slips out with slightly ruffled fur. ${profileData.name} shakes ${profileData.pronounArray[4]}. Just at this moment, a worried Elderly comes running.*\n"Is everything alright? You've been gone for a while, and we heard cries of pain, so we were worried!" *They look over to the bush.*\n"Oh, looks like you've already solved the problem yourself! Very well done! I think you're ready to become a Hunter or Healer if you're ever interested."`;
							}

							if (maps.speciesMap.get(profileData.species).habitat == 'water') {

								description = `*After fighting with the trunk for a while, the ${profileData.species} now slips out. ${profileData.name} shakes ${profileData.pronounArray[4]}. Just at this moment, a worried Elderly comes swimming.*\n"Is everything alright? You've been gone for a while, and we heard cries of pain, so we were worried!" *They look over to the bush.*\n"Oh, looks like you've already solved the problem yourself! Very well done! I think you're ready to become a Hunter or Healer if you're ever interested."`;
							}
						}

						if (profileData.rank == 'Hunter' || profileData.rank == 'Healer') {

							if (maps.speciesMap.get(profileData.species).habitat == 'warm' || maps.speciesMap.get(profileData.species).habitat == 'cold') {

								description = `*The engine noise became quieter and quieter before it finally disappeared entirely after endless maneuvers. Relieved, the ${profileData.species} runs to the pack, which is not far away. An Elderly is already coming towards ${profileData.pronounArray[1]}.*\n"You're alright! We heard the humans. And you didn't lead them straight to us, very good! Your wisdom, skill, and experience qualify you as an Elderly, ${profileData.name}. I'll talk to the other Elderlies about it. Just let me know if you want to join us."`;
							}

							if (maps.speciesMap.get(profileData.species).habitat == 'water') {

								description = `*The engine noise became quieter and quieter before it finally disappeared entirely after endless maneuvers. Relieved, the ${profileData.species} swims to the pack, which is not far away. An Elderly is already swimming towards ${profileData.pronounArray[1]}.*\n"You're alright! We heard the humans. And you didn't lead them straight to us, very good! Your wisdom, skill, and experience qualify you as an Elderly, ${profileData.name}. I'll talk to the other Elderlies about it. Just let me know if you want to join us."`;
							}
						}

						if (profileData.rank == 'Elderly') {

							if (maps.speciesMap.get(profileData.species).habitat == 'warm' || maps.speciesMap.get(profileData.species).habitat == 'cold') {

								description = `*The ${profileData.species} runs for a while before the situation seems to clear up. ${profileData.name} gasps in exhaustion. That was close. Full of adrenaline, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'goes' : 'go')} back to the pack. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} feels strangely stronger than before.*`;
							}

							if (maps.speciesMap.get(profileData.species).habitat == 'water') {

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
					else if (missValue >= 10) {

						let description = '';

						if (profileData.rank == 'Youngling') {

							description = `"I can't... I can't do it," *${profileData.name} heaves, ${profileData.pronounArray[2]} chest struggling to fall and rise.\nSuddenly the boulder shakes and falls away from the cave entrance.*\n"You are too weak for a task like this. Come back to camp, Youngling." *The Elderly turns around and slowly walks back towards camp, not dwelling long by the exhausted ${profileData.species}.*`;
						}

						if (profileData.rank == 'Apprentice') {

							if (maps.speciesMap.get(profileData.species).habitat == 'warm') {

								description = `*No matter how long the ${profileData.species} pulls and tugs, ${profileData.pronounArray[0]} just can't break free. ${profileData.name} lies there for a while until finally, an Elderly comes. Two other packmates that accompany them are anxiously looking out.*\n"That's ${profileData.pronounArray[1]}!" *the Elderly shouts. The other two run to the ${profileData.species} and bite away the root.*\n"Are you all right? Thank goodness we found you!" *the Elderly asks.*`;
							}

							if (maps.speciesMap.get(profileData.species).habitat == 'cold') {

								description = `*No matter how long the ${profileData.species} pulls and tugs, ${profileData.pronounArray[0]} just can't break free. ${profileData.name} lies there for a while until finally, an Elderly comes. Two other packmates that accompany them are anxiously looking out.*\n"That's ${profileData.pronounArray[1]}!" *the Elderly shouts. The other two run to the ${profileData.species} and pull him out from under the log with their mouths.*\n"Are you all right? Thank goodness we found you!" *the Elderly asks.*`;
							}

							if (maps.speciesMap.get(profileData.species).habitat == 'water') {

								description = `*No matter how long the ${profileData.species} pulls and tugs, ${profileData.pronounArray[0]} just can't break free. ${profileData.name} lies there for a while until finally, an Elderly comes. Two other packmates that accompany them are anxiously looking out.*\n"That's ${profileData.pronounArray[1]}!" *the Elderly shouts. The other two run to the ${profileData.species} and push him away from the log with their heads.*\n"Are you all right? Thank goodness we found you!" *the Elderly asks.*`;
							}
						}

						if (profileData.rank == 'Hunter' || profileData.rank == 'Healer') {

							if (maps.speciesMap.get(profileData.species).habitat == 'warm' || maps.speciesMap.get(profileData.species).habitat == 'cold') {

								description = `*It almost looks like the humans are catching up to the ${profileData.species} when suddenly a larger ${profileData.species} comes running from the side. They pick up ${profileData.name} and run sideways as fast as lightning. Before ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'knows' : 'know')} what has happened to ${profileData.pronounArray[1]}, they are already out of reach.*\n"That was close," *the Elderly says.* "Good thing I was nearby."`;
							}

							if (maps.speciesMap.get(profileData.species).habitat == 'water') {

								description = `*It almost looks like the humans are catching up to the ${profileData.species} when suddenly a larger ${profileData.species} comes swimming from the side. They push away ${profileData.name} with their head and swim sideways as fast as lightning. Before ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'knows' : 'know')} what has happened to ${profileData.pronounArray[1]}, they are already out of reach.*\n"That was close," *the Elderly says.* "Good thing I was nearby."`;
							}
						}

						if (profileData.rank == 'Elderly') {

							if (maps.speciesMap.get(profileData.species).habitat == 'warm' || maps.speciesMap.get(profileData.species).habitat == 'cold') {

								description = `*The ${profileData.species} gasps as ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'drops' : 'drop')} down to the ground, defeated. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)}'${((profileData.pronounArray[5] == 'singular') ? 's' : 're')} just not fast enough... Suddenly ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'is' : 'are')} lifted by the neck. Another ${profileData.species} has ${profileData.pronounArray[1]} in their mouth and runs as fast as they can. ${profileData.name} is saved!*`;
							}

							if (maps.speciesMap.get(profileData.species).habitat == 'water') {

								description = `*The ${profileData.species} gasps as ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'stops' : 'stop')} swimming, defeated. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)}'${((profileData.pronounArray[5] == 'singular') ? 's' : 're')} just not fast enough... Suddenly ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'feels' : 'feel')} a thrust from the side. Another ${profileData.species} pushes into them with their head and swims as fast as they can. ${profileData.name} is saved!*`;
							}
						}

						embedArray.push({
							color: `${profileData.color}`,
							author: { name: `${profileData.name}`, icon_url: `${profileData.avatarURL}` },
							description: description,
						});

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
					else {

						await quest(false);
						return resolve();
					}
				});
			});
		}

		function progressbar(index, replacement) {

			const barEmoji = '◻️';
			return barEmoji.repeat(index - 1) + replacement + barEmoji.repeat(10 - index);
		}

		// Logistic function
		function sigmoidFunction(currentLevel, recommendedLevel) {

			// 1.58 is the x value where y reaches 50%
			const x = (currentLevel / (0.5 * recommendedLevel)) - 1.58;

			// 5.11 is the steepness level
			return 100 / (1 + Math.pow(Math.E, -5.11 * x));
		}
	},
};
