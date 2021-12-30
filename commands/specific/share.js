const profileModel = require('../../models/profileSchema');
const missing = require('../../utils/checkAccountCompletion');
const condition = require('../../utils/condition');

module.exports = {
	name: 'share',
	async sendMessage(client, message, argumentsArray, profileData, serverData, embedArray) {

		if (!profileData || profileData.name === '') return missing.missingName(message);
		if (profileData.species === '') return missing.missingSpecies(message, profileData);
		if (profileData.hasCooldown === true) return cooldown.cooldownMessage(message, profileData);
		if (profileData.hasQuest == true) return quest.quest(message, profileData);
		if (profileData.energy <= 0 || profileData.health <= 0 || profileData.hunger <= 0 || profileData.thirst <= 0) return passedout.passedOut(message, profileData);
		if (profileData.rank != 'Elderly') {
			const wrong_rank_embed = new Discord.MessageEmbed()
				.setAuthor(`${profileData.name}`, `${profileData.avatarURL}`)
				.setColor(`${profileData.color}`)
				.setDescription(`*${profileData.name} is     about to begin sharing a story when an elderly interrupts them.* "Oh, young ${profileData.species}, you need to have a lot more adventures before you can start advising others!"`);
			return await message.reply({ embeds: [wrong_rank_embed] });
		}
		if (profileData.isResting === true) await isresting.isResting(message, profileData, embedArray);
		await cooldown.commandCooldown(message);
		condition.depleteThirst(message, profileData);
		condition.depleteHunger(message, profileData);
		condition.depleteEnergy(message, profileData);

		function Loottable(max, min) { return Math.floor(Math.random() * max + min); }
		let total_energy = Loottable(5, 1) + extraLostEnergyPoints;
		if (profileData.energy - total_energy < 0) total_energy = total_energy - (total_energy - profileData.energy);

		const stats_profileData = await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{
				$inc: { energy: -total_energy },
				$set: { currentRegion: 'ruins' },
			},
			{ upsert: true, new: true },
		);

		let footertext = `-${total_energy} energy (${stats_profileData.energy}/${stats_profileData.maxEnergy})`;
		if (hungerPoints >= 1) footertext = footertext + `\n-${hungerPoints} hunger (${stats_profileData.hunger}/${stats_profileData.maxHunger})`;
		if (thirstPoints >= 1) footertext = footertext + `\n-${thirstPoints} thirst (${stats_profileData.thirst}/${stats_profileData.maxThirst})`;

		let total_HP = 0;
		const playerhurtkind = [...profileData.injuryArray];
		let gethurtlater = 0;

		const embed1 = new Discord.MessageEmbed();
		const embed = new Discord.MessageEmbed()
			.setAuthor(`${profileData.name}`, `${profileData.avatarURL}`)
			.setColor(`${profileData.color}`);
		let bot_reply;
		let chosen_profileData;

		if (!message.mentions.users.size) {
			const docs = await profileModel.find({
				serverId: message.guild.id,
				currentRegion: 'ruins',
			});

			const ruins_array_ID = docs.map(doc => doc.userId);
			ruins_array_ID.splice(ruins_array_ID.indexOf(`${profileData.userId}`), 1);

			if (ruins_array_ID != '') {
				const index = Loottable(ruins_array_ID.length, 0);

				chosen_profileData = await profileModel.findOne({
					userId: ruins_array_ID[index],
					serverId: message.guild.id,
				});

				if (chosen_profileData.energy <= 0 || chosen_profileData.health <= 0 || chosen_profileData.hunger <= 0 || chosen_profileData.thirst <= 0) {
					return NO_SHARING();
				}
				else if (chosen_profileData.name === '' || chosen_profileData.species === '') {
					return NO_SHARING();
				}
				else {
					const found_user_XP = Loottable(41, 20);

					chosen_profileData = await profileModel.findOneAndUpdate(
						{ userId: ruins_array_ID[index], serverId: message.guild.id },
						{ $inc: { experience: +found_user_XP } },
						{ upsert: true, new: true },
					);

					footertext = footertext + `\n+${found_user_XP} XP for ${chosen_profileData.name} (${chosen_profileData.experience}/${chosen_profileData.levels * 50})`;
					embed.setDescription(`*${chosen_profileData.name} comes running to the old wooden trunk at the ruins where ${profileData.name} sits, ready to tell an exciting story from long ago. Their eyes are sparkling as the ${profileData.species} recounts great adventures and the lessons to be learned from them.*`);
					embed.setFooter(footertext);
					if (chosen_profileData.experience >= chosen_profileData.levels * 50) {
						chosen_profileData = await profileModel.findOneAndUpdate(
							{ userId: ruins_array_ID[index], serverId: message.guild.id },
							{
								$inc: {
									experience: -found_user_XP,
									levels: +1,
								},
							},
							{ upsert: true, new: true },
						);

						embed1.setAuthor(`${chosen_profileData.name}`, `${chosen_profileData.avatarURL}`);
						embed1.setColor(`${chosen_profileData.color}`);
						embed1.setTitle(`${chosen_profileData.name} just leveled up! They are now level ${chosen_profileData.levels}.`);
						embedArray.push(embed, embed1);
						bot_reply = await message.reply({ embeds: embedArray });
					}
					else {
						embedArray.push(embed);
						bot_reply = await message.reply({ embed: embedArray });
					}
				}
			}
			else {
				return NO_SHARING();
			}
		}
		else if (message.mentions.users.first().id === message.author.id) {
			if (profileData.pronounArray[5] == 'singular') {
				embed.setDescription(`*${profileData.name} is very wise from all the adventures ${profileData.pronounArray[0]} had, but also a little... quaint. Sometimes ${profileData.pronounArray[0]} sits down at the fireplace, mumbling to ${profileData.pronounArray[4]} a story from back in the day. Busy packmates look at ${profileData.pronounArray[1]} in confusion as they pass by.*`);
			}
			else if (profileData.pronounArray[5] == 'plural') {
				embed.setDescription(`*${profileData.name} is very wise from all the adventures ${profileData.pronounArray[0]} had, but also a little... quaint. Sometimes ${profileData.pronounArray[0]} sit down at the fireplace, mumbling to ${profileData.pronounArray[4]} a story from back in the day. Busy packmates look at ${profileData.pronounArray[1]} in confusion as they pass by.*`);
			}
			embedArray.push(embed);
			bot_reply = await message.reply({ embeds: embedArray });

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{
					$inc: {
						energy: +total_energy,
						hunger: +hungerPoints,
						thirst: +thirstPoints,
						experience: -total_XP,
					},
				},
				{ upsert: true, new: true },
			);
		}
		else {
			chosen_profileData = await profileModel.findOne({
				userId: message.mentions.users.first().id,
				serverId: message.guild.id,
			});

			if (chosen_profileData.energy <= 0 || chosen_profileData.health <= 0 || chosen_profileData.hunger <= 0 || chosen_profileData.thirst <= 0) {
				await profileModel.findOneAndUpdate(
					{ userId: message.author.id, serverId: message.guild.id },
					{
						$inc: {
							energy: +total_energy,
							hunger: +hungerPoints,
							thirst: +thirstPoints,
							experience: -total_XP,
						}
					},
					{ upsert: true, new: true },
				);
				return passedout.passedOut(message, chosen_profileData);
			}
			else if (chosen_profileData.name === '' || chosen_profileData.species === '') {
				embed.setAuthor(message.guild.name, message.guild.iconURL());
				embed.setColor('#9d9e51');
				embed.setTitle('The mentioned user has no account or the account was not completed!');
				embedArray.push(embed);
				return bot_reply = await message.reply({ embeds: embedArray });
			}
			else {
				const found_user_XP = Loottable(41, 20);

				chosen_profileData = await profileModel.findOneAndUpdate(
					{ userId: message.mentions.users.first().id, serverId: message.guild.id },
					{ $inc: { experience: found_user_XP } },
					{ upsert: true, new: true },
				);

				footertext = footertext + `\n\n+${found_user_XP} XP for ${chosen_profileData.name} (${chosen_profileData.experience}/${chosen_profileData.levels * 50})`;
				embed.setDescription(`*${chosen_profileData.name} comes running to the old wooden trunk at the ruins where ${profileData.name} sits, ready to tell an exciting story from long ago. Their eyes are sparkling as the ${profileData.species} recounts great adventures and the lessons to be learned of them.*`);
				embed.setFooter(footertext);
				if (chosen_profileData.experience >= chosen_profileData.levels * 50) {
					chosen_profileData = await profileModel.findOneAndUpdate(
						{ userId: message.mentions.users.first().id, serverId: message.guild.id },
						{
							$inc: {
								experience: -found_user_XP,
								levels: +1,
							},
						},
						{ upsert: true, new: true },
					);

					embed1.setAuthor(`${chosen_profileData.name}`, `${chosen_profileData.avatarURL}`);
					embed1.setColor(`${chosen_profileData.color}`);
					embed1.setTitle(`${chosen_profileData.name} just leveled up! They are now level ${chosen_profileData.levels}.`);
					embedArray.push(embed, embed1);
					bot_reply = await message.reply({ embeds: embedArray });
				}
				else {
					embedArray.push(embed);
					bot_reply = await message.reply({ embeds: embedArray });
				}
			}
		}
		if (chosen_profileData.injuryArray[2] > 0) {
			const luckyvalue = Loottable(10, 1);
			if (luckyvalue <= 3) {
				gethurtlater = 1;

				total_HP = Loottable(5, 3);
				if (profileData.health - total_HP < 0) total_HP = total_HP - (total_HP - profileData.health);
				await profileModel.findOneAndUpdate(
					{ userId: message.author.id, serverId: message.guild.id },
					{ $inc: { health: -total_HP } },
					{ upsert: true, new: true },
				);

				playerhurtkind[2] = playerhurtkind[2] + 1;

				embed1.setAuthor(`${profileData.name}`, `${profileData.avatarURL}`);
				embed1.setColor(`${profileData.color}`);
				embed1.setDescription(`*Suddenly, ${profileData.name} starts coughing uncontrollably. Thinking back, they spent all day alongside ${tagged_profileData.name}, who was coughing as well. That was probably not the best idea!*`);
				embed1.setFooter(`-${total_HP} HP (from cold)`);

				await embedArray.push(embed1);
				bot_reply = await bot_reply.edit({ embeds: embedArray });
			}
		}

		async function NO_SHARING() {
			embed.setDescription(`*${profileData.name} sits on an old wooden trunk at the ruins, ready to tell a story to any willing listener. But to ${profileData.pronounArray[2]} disappointment, no one seems to be around.*`);
			embed.setFooter(footertext);
			embedArray.push(embed);
			bot_reply = await message.reply({ embeds: embedArray });
		}

		await damage.unhealedDamage(message, profileData, bot_reply);
		total_HP = total_HP + extra_lost_HP;

		if (gethurtlater == 1) {
			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{ $set: { injuryArray: playerhurtkind } },
				{ upsert: true, new: true },
			);
		}

		if (stats_profileData.energy === 0 || stats_profileData.maxHealth - total_HP === 0 || stats_profileData.hunger === 0 || stats_profileData.thirst === 0) {
			passedout.passedOut(message, profileData);

			let newlevel = profileData.levels;
			newlevel = Math.round(newlevel - (newlevel / 10));

			arrays.commonPlantNames();
			arrays.uncommonPlantNames();
			arrays.rarePlantNames();
			arrays.species(profileData);
			const profile_inventory = [[], [], [], []];
			for (let i = 0; i < arrays.commonPlantNamesArray.length; i++) profile_inventory[0].push(0);
			for (let i = 0; i < uncommonPlantNamesArray.length; i++) profile_inventory[1].push(0);
			for (let i = 0; i < rarePlantNamesArray.length; i++) profile_inventory[2].push(0);
			for (let i = 0; i < species.nameArray.length; i++) profile_inventory[3].push(0);

			await profileModel.findOneAndUpdate(
				{ userId: message.author.id, serverId: message.guild.id },
				{
					$set: {
						levels: newlevel,
						experience: 0,
						inventoryArray: profile_inventory,
					},
				},
				{ upsert: true, new: true },
			);
		}
	},
};