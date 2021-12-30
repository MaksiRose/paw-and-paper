const missing = require('../../utils/checkAccountCompletion');
const arrays = require('../../utils/arrays');
const profileModel = require('../../models/profileSchema');

module.exports = {
	name: 'quest',
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {
		await message.channel.sendTyping();
		if (!profileData || profileData.name === '') return missing.missingName(message);
		if (profileData.species === '') return missing.missingSpecies(message, profileData);
		if (profileData.hasCooldown === true) return cooldown.cooldownMessage(message, profileData);
		if (profileData.energy <= 0 || profileData.health <= 0 || profileData.hunger <= 0 || profileData.thirst <= 0) return passedout.passedOut(message, profileData);

		if (profileData.isResting === true) await isresting.isResting(message, profileData, embedArray);
		await cooldown.commandCooldown(message);

		if (profileData.hasQuest == false) {
			embedArray.push({
				color: '#9d9e51',
				author: { name: `${message.guild.name}`, icon_url: `${message.guild.iconURL()}` },
				title: 'You have no open quests at the moment :(',
				footer: 'Go playing or exploring to get quests!',
			});

			await message.reply({
				embeds: embedArray,
			});
		}
		else {
			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { hasQuest: false } },
				{ upsert: true, new: true },
			);

			const bar_emoji = '◻️';
			let hit_emoji = '';
			let miss_emoji = '';
			let hit_value = 0;
			let miss_value = 0;
			const questnumber = profileData.unlockedranks + 1;

			function progressbar(string, index, replacement) {
				return string.substring(0, index) + replacement + string.substring(index + bar_emoji.length);
			}

			function random_number(max) {
				return Math.floor(Math.random() * (max + 1));
			}

			// Logistic function
			function sigmoid(current_level, recommended_level) {
				const x = (current_level / (0.5 * recommended_level)) - 1.58; // 1.58 is the x value where y reaches 50%
				return 100 / (1 + Math.pow(Math.E, -5.11 * x)); // 5.11 is the steepness level
			}

			async function failure_embed(bot_reply, quest_number) {
				const species_arrayposition = species.nameArray.findIndex(function(speciesarg) {
					return speciesarg == profileData.species;
				});

				let description = null;
				if (quest_number == 1) {
					description = `"I can't... I can't do it," *${profileData.name} heaves, ${profileData.chest[2]} chest struggling to fall and rise.\nSuddenly the boulder shakes and falls away from the cave entrance.*\n"You are too weak for a task like this. Come back to camp, Youngling." *The Elderly turns around and slowly walks back towards camp, not dwelling long by the exhausted ${profileData.species}.*`;
				}
				else if (quest_number == 2) {
					if (species.habitatArray[species_arrayposition] == 'warm') {
						description = `*No matter how long the ${profileData.species} pulls and tugs, ${profileData.pronounArray[0]} just can't break free. ${profileData.name} lies there for a while until finally, an Elderly comes. Two other packmates that accompany them are anxiously looking out.*\n"That's ${profileData.pronounArray[1]}!" *the Elderly shouts. The other two run to the ${profileData.species} and bite away the root.*\n"Are you all right? Thank goodness we found you!" *the Elderly asks.*`;
					}
					else if (species.habitatArray[species_arrayposition] == 'cold') {
						description = `*No matter how long the ${profileData.species} pulls and tugs, ${profileData.pronounArray[0]} just can't break free. ${profileData.name} lies there for a while until finally, an Elderly comes. Two other packmates that accompany them are anxiously looking out.*\n"That's ${profileData.pronounArray[1]}!" *the Elderly shouts. The other two run to the ${profileData.species} and pull him out from under the log with their mouths.*\n"Are you all right? Thank goodness we found you!" *the Elderly asks.*`;
					}
					else if (species.habitatArray[species_arrayposition] == 'water') {
						description = `*No matter how long the ${profileData.species} pulls and tugs, ${profileData.pronounArray[0]} just can't break free. ${profileData.name} lies there for a while until finally, an Elderly comes. Two other packmates that accompany them are anxiously looking out.*\n"That's ${profileData.pronounArray[1]}!" *the Elderly shouts. The other two run to the ${profileData.species} and push him away from the log with their heads.*\n"Are you all right? Thank goodness we found you!" *the Elderly asks.*`;
					}
				}
				else if (quest_number == 3) {
					if (species.habitatArray[species_arrayposition] == 'warm' || species.habitatArray[species_arrayposition] == 'cold') {
						description = `*It almost looks like the humans are catching up to the ${profileData.species} when suddenly a larger ${profileData.species} comes running from the side. They pick up ${profileData.name} and run sideways as fast as lightning. Before ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'knows' : 'know')} what has happened to ${profileData.pronounArray[1]}, they are already out of reach.*\n"That was close," *the Elderly says.* "Good thing I was nearby."`;
					}
					else if (species.habitatArray[species_arrayposition] == 'water') {
						description = `*It almost looks like the humans are catching up to the ${profileData.species} when suddenly a larger ${profileData.species} comes swimming from the side. They push away ${profileData.name} with their head and swim sideways as fast as lightning. Before ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'knows' : 'know')} what has happened to ${profileData.pronounArray[1]}, they are already out of reach.*\n"That was close," *the Elderly says.* "Good thing I was nearby."`;
					}
				}
				else if (quest_number == 4) {
					if (species.habitatArray[species_arrayposition] == 'warm' || species.habitatArray[species_arrayposition] == 'cold') {
						description = `*The ${profileData.species} gasps as ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'drops' : 'drop')} down to the ground, defeated. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)}'${((profileData.pronounArray[5] == 'singular') ? 's' : 're')} just not fast enough... Suddenly ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'is' : 'are')} lifted by the neck. Another ${profileData.species} has ${profileData.pronounArray[1]} in their mouth and runs as fast as they can. ${profileData.name} is saved!*`;
					}
					else if (species.habitatArray[species_arrayposition] == 'water') {
						description = `*The ${profileData.species} gasps as ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'stops' : 'stop')} swimming, defeated. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)}'${((profileData.pronounArray[5] == 'singular') ? 's' : 're')} just not fast enough... Suddenly ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'feels' : 'feel')} a thrust from the side. Another ${profileData.species} pushes into them with their head and swims as fast as they can. ${profileData.name} is saved!*`;
					}
				}
				embedArray.push({
					color: `${profileData.color}`,
					author: { name: `${profileData.name}`, icon_url: `${profileData.avatarURL}` },
					description: description,
					footer: null,
				});

				bot_reply = await bot_reply.edit({
					embeds: embedArray,
					components: [],
				});
			}

			async function success_embed(bot_reply, quest_number) {
				const species_arrayposition = species.nameArray.findIndex(function(speciesarg) {
					return speciesarg == profileData.species;
				});

				let description = null;
				let footer = null;

				if (quest_number == 1) {
					description = `*A large thump erupts into the forest, sending flocks of crows fleeing to the sky. ${profileData.name} collapses, panting and yearning for breath after the difficult task of pushing the giant boulder. Another ${profileData.species} runs out of the cave, jumping around ${profileData.name} with relief. Suddenly, an Elderly shows up behind the two.*\n"Well done, Youngling, you have proven to be worthy of the Apprentice status. If you ever choose to rank up, just come to me," *the proud elder says with a raspy voice.*`;
				}
				else if (quest_number == 2) {
					if (species.habitatArray[species_arrayposition] == 'warm') {
						description = `*After fighting with the trunk for a while, the ${profileData.species} now slips out with slightly ruffled fur. ${profileData.name} shakes ${profileData.pronounArray[4]}. Just at this moment, a worried Elderly comes running.*\n"Is everything alright? You've been gone for a while, and we heard cries of pain, so we were worried!" *They look over to the tree trunk.*\n"Oh, looks like you've already solved the problem yourself! Very well done! I think you're ready to become a Hunter or Healer if you're ever interested."`;
					}
					else if (species.habitatArray[species_arrayposition] == 'cold') {
						description = `*After fighting with the root for a while, the ${profileData.species} now slips out with slightly ruffled fur. ${profileData.name} shakes ${profileData.pronounArray[4]}. Just at this moment, a worried Elderly comes running.*\n"Is everything alright? You've been gone for a while, and we heard cries of pain, so we were worried!" *They look over to the bush.*\n"Oh, looks like you've already solved the problem yourself! Very well done! I think you're ready to become a Hunter or Healer if you're ever interested."`;
					}
					else if (species.habitatArray[species_arrayposition] == 'water') {
						description = `*After fighting with the trunk for a while, the ${profileData.species} now slips out. ${profileData.name} shakes ${profileData.pronounArray[4]}. Just at this moment, a worried Elderly comes swimming.*\n"Is everything alright? You've been gone for a while, and we heard cries of pain, so we were worried!" *They look over to the bush.*\n"Oh, looks like you've already solved the problem yourself! Very well done! I think you're ready to become a Hunter or Healer if you're ever interested."`;
					}
				}
				else if (quest_number == 3) {
					if (species.habitatArray[species_arrayposition] == 'warm' || species.habitatArray[species_arrayposition] == 'cold') {
						description = `*The engine noise became quieter and quieter before it finally disappeared entirely after endless maneuvers. Relieved, the ${profileData.species} runs to the pack, which is not far away. An Elderly is already coming towards ${profileData.pronounArray[1]}.*\n"You're alright! We heard the humans. And you didn't lead them straight to us, very good! Your wisdom, skill, and experience qualify you as an Elderly, ${profileData.name}. I'll talk to the other Elderlies about it. Just let me know if you want to join us."`;
					}
					else if (species.habitatArray[species_arrayposition] == 'water') {
						description = `*The engine noise became quieter and quieter before it finally disappeared entirely after endless maneuvers. Relieved, the ${profileData.species} swims to the pack, which is not far away. An Elderly is already swimming towards ${profileData.pronounArray[1]}.*\n"You're alright! We heard the humans. And you didn't lead them straight to us, very good! Your wisdom, skill, and experience qualify you as an Elderly, ${profileData.name}. I'll talk to the other Elderlies about it. Just let me know if you want to join us."`;
					}
				}
				else if (quest_number == 4) {
					if (species.habitatArray[species_arrayposition] == 'warm' || species.habitatArray[species_arrayposition] == 'cold') {
						description = `*The ${profileData.species} runs for a while before the situation seems to clear up. ${profileData.name} gasps in exhaustion. That was close. Full of adrenaline, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'goes' : 'go')} back to the pack. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} feels strangely stronger than before.*`;
					}
					else if (species.habitatArray[species_arrayposition] == 'water') {
						description = `*The ${profileData.species} runs for a while before the situation seems to clear up. ${profileData.name} gasps in exhaustion. That was close. Full of adrenaline, ${profileData.pronounArray[0]} ${((profileData.pronounArray[5] == 'singular') ? 'swims' : 'swim')} back to the pack. ${profileData.pronounArray[0].charAt(0).toUpperCase()}${profileData.pronounArray[0].slice(1)} feels strangely stronger than before.*`;
					}

					let plushealth = 0;
					let plusenergy = 0;
					let plushunger = 0;
					let plusthirst = 0;

					const random = Math.floor(Math.random() * 4);

					if (random == 0) {
						plushealth = 10;
						footer = '+10 maximum health';
					}
					else if (random == 1) {
						plusenergy = 10;
						footer = '+10 maximum energy';
					}
					else if (random == 2) {
						plushunger = 10;
						footer = '+10 maximum hunger';
					}
					else {
						plusthirst = 10;
						footer = '+10 maximum thirst';
					}

					await profileModel.findOneAndUpdate(
						{ userId: message.author.id, serverId: message.guild.id },
						{
							$inc: {
								maxHealth: plushealth,
								maxEnergy: plusenergy,
								maxHunger: plushunger,
								maxThirst: plusthirst,
							},
						},
						{ upsert: true, new: true },
					);
				}

				embedArray.push({
					color: `${profileData.color}`,
					author: { name: `${profileData.name}`, icon_url: `${profileData.avatarURL}` },
					description: description,
					footer: footer,
				});

				bot_reply = await bot_reply.edit({
					embeds: embedArray,
					components: [],
				});
			}

			async function quest(quest_number, bot_reply, first) {
				const species_arrayposition = species.nameArray.findIndex(function(speciesarg) {
					return speciesarg == profileData.species;
				});

				const text_or_color = ((Math.floor(Math.random() * 2) == 0) ? 'color' : 'text');
				const which_color = ((Math.floor(Math.random() * 3) == 0) ? 'green' : ((Math.floor(Math.random() * 2) == 0) ? 'blue' : 'red'));
				let footertext = `Click the ${((text_or_color == 'color') ? `${which_color} button` : `button labeled "${which_color.charAt(0).toUpperCase()}${which_color.slice(1)}"`)} to `;

				if (quest_number == 1) {
					footertext = footertext + 'push the rock! But watch out for your energy bar.';
				}
				else if (quest_number == 2) {
					if (species.habitatArray[species_arrayposition] == 'warm') {
						footertext = footertext + 'push the root! But watch out for your energy bar.';
					}
					else if (species.habitatArray[species_arrayposition] == 'cold' || species.habitatArray[species_arrayposition] == 'water') {
						footertext = footertext + 'push the tree! But watch out for your energy bar.';
					}
				}
				else if (quest_number == 3) {
					if (species.habitatArray[species_arrayposition] == 'warm' || species.habitatArray[species_arrayposition] == 'cold') {
						footertext = footertext + 'run from the humans! But watch out for your energy bar.';
					}
					else if (species.habitatArray[species_arrayposition] == 'water') {
						footertext = footertext + 'swim from the humans! But watch out for your energy bar.';
					}
				}
				else if (quest_number == 4) {
					if (species.habitatArray[species_arrayposition] == 'warm') {
						footertext = footertext + 'run from the sandstorm! But watch out for your energy bar.';
					}
					else if (species.habitatArray[species_arrayposition] == 'cold') {
						footertext = footertext + 'run from the snowstorm! But watch out for your energy bar.';
					}
					else if (species.habitatArray[species_arrayposition] == 'water') {
						footertext = footertext + 'swim from the underwater landslide! But watch out for your energy bar.';
					}
				}

				embedArray.push({
					color: `${profileData.color}`,
					author: { name: `${profileData.name}`, icon_url: `${profileData.avatarURL}` },
					description: `${progressbar(bar_emoji.repeat(10), hit_value, hit_emoji)}\n${progressbar(bar_emoji.repeat(10), miss_value, miss_emoji)}`,
					footer: {
						text: `${footertext}`,
					},
				});

				const component_arrays = [
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

				const final_component_array = component_arrays[Math.floor((Math.random() * 3))];

				let curId = final_component_array.length;
				while (curId !== 0) {
					const randId = Math.floor(Math.random() * curId);
					curId -= 1;
					const tmp = final_component_array[curId];
					final_component_array[curId] = final_component_array[randId];
					final_component_array[randId] = tmp;
				}

				if (first) {
					bot_reply = await message.reply({
						embeds: embedArray,
						components: [{
							type: 'ACTION_ROW',
							components: final_component_array,
						}],
					});
				}
				else {
					bot_reply = await bot_reply.edit({
						embeds: embedArray,
						components: [{
							type: 'ACTION_ROW',
							components: final_component_array,
						}],
					});
				}

				const filter = i => i.customId.includes('quest') && i.user.id === message.author.id;
				const collector = message.channel.createMessageComponentCollector({ filter, max: 1, time: 5000 });
				collector.on('end', async collected => {
					if (collected.size == 0 || !collected.first().customId.includes(`${which_color}${text_or_color}`)) {
						miss_value = miss_value + bar_emoji.length;
					}
					else if (random_number(100) > sigmoid(profileData.levels, 2)) {
						miss_value = miss_value + bar_emoji.length;
					}
					else {
						hit_value = hit_value + bar_emoji.length;
					}

					embedArray.splice(-1, 1);
					if (hit_value == 18) {
						if (profileData.unlockedranks < 3) {
							await profileModel.findOneAndUpdate(
								{ userId: message.author.id, serverId: message.guild.id },
								{ $inc: { unlockedRanks: +1 } },
								{ upsert: true, new: true },
							);
						}

						return success_embed(bot_reply, quest_number);
					}
					else if (miss_value == 18) {
						return failure_embed(bot_reply, quest_number);
					}
					else {
						return quest(questnumber, bot_reply, false);
					}
				});
			}

			if (profileData.rank == 'Youngling') {
				hit_emoji = '🪨'; // rock emoji
				miss_emoji = '⚡';
			}
			else if (profileData.rank == 'Apprentice') {
				hit_emoji = '🪵'; // wood emoji
				miss_emoji = '⚡';
			}
			else if (profileData.rank == 'Hunter' || 'Healer') {
				hit_emoji = '💨';
				miss_emoji = '💂';
			}
			else if (profileData.rank == 'Elderly') {
				arrays.species(profileData);
				const species_arrayposition = species.nameArray.findIndex(function(speciesarg) {
					return speciesarg == profileData.species;
				});

				hit_emoji = '💨';
				if (species.habitatArray[species_arrayposition] == 'warm') {
					miss_emoji = '🏜️';
				}
				else if (species.habitatArray[species_arrayposition] == 'cold') {
					miss_emoji = '🌨️';
				}
				else if (species.habitatArray[species_arrayposition] == 'water') {
					miss_emoji = '⛰️';
				}
			}
			let bot_reply;
			quest(questnumber, bot_reply, true);
		}
	},
};
