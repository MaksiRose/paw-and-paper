const config = require('../../config.json');
const profileModel = require('../../models/profileSchema');
const arrays = require('../../utils/arrays');

module.exports = {
	name: 'name',
	async sendMessage(client, message, argumentsArray, profileData) {

		const species = arrays.species(profileData);

		try {

			profileData = await profileModel.findOne({ userId: message.author.id, serverId: message.guild.id });
			const profileInventoryArray = [[], [], [], []];
			if (!profileData) {

				for (let i = 0; i < arrays.commonPlantNamesArray.length; i++) {

					profileInventoryArray[0].push(0);
				}

				for (let i = 0; i < arrays.uncommonPlantNamesArray.length; i++) {
					profileInventoryArray[1].push(0);
				}

				for (let i = 0; i < arrays.rarePlantNamesArray.length; i++) {
					profileInventoryArray[2].push(0);
				}

				for (let i = 0; i < species.nameArray.length; i++) {
					profileInventoryArray[3].push(0);
				}

				const profile = await profileModel.create({
					userId: message.author.id,
					serverId: message.guild.id,
					name: '',
					description: '',
					color: config.DEFAULT_COLOR,
					species: '',
					rank: 'Youngling',
					avatarURL: message.author.avatarURL(),
					levels: 1,
					experience: 0,
					health: 100,
					energy: 100,
					hunger: 100,
					thirst: 100,
					maxHealth: 100,
					maxEnergy: 100,
					maxHunger: 100,
					maxThirst: 100,
					isResting: false,
					hasCooldown: false,
					hasQuest: false,
					currentRegion: 'sleeping dens',
					unlockedRanks: 0,
					pronounArray: ['they', 'them', 'their', 'theirs', 'themselves', 'plural'],
					injuryArray: [0, 0, 0, 0, 0],
					inventoryArray: profileInventoryArray,
				});

				profile.save();
			}
		}
		catch (err) {

			console.log(err);

			return await message.reply({
				embeds: [{
					color: config.ERROR_COLOR,
					title: 'En error occured trying to change your name.',
				}],
			});
		}

		const name = argumentsArray.join(' ').charAt(0).toUpperCase() + argumentsArray.join(' ').slice(1);

		if (!argumentsArray.length) {

			return await message.reply({
				embeds: [{
					color: config.DEFAULT_COLOR,
					author: { name: message.guild.name, icon_url: message.guild.iconURL() },
					title: 'Use this command to name or rename your character. Here is how to use it:',
					description: '\n\nrp name [name]\nReplace [name] with the desired name.',
				}],
			});
		}

		await profileModel.findOneAndUpdate(
			{ userId: message.author.id, serverId: message.guild.id },
			{ $set: { name: name } },
			{ upsert: true, new: true },
		);

		await message.reply({
			embeds: [{
				color: config.DEFAULT_COLOR,
				author: { name: message.guild.name, icon_url: message.guild.iconURL() },
				description: `*A stranger carefully steps over the pack's borders. Their face seems friendly. Curious eyes watch them as they come close to the Alpha.* "Welcome," *the Alpha says.* "What is your name?" \n**"${name},"** *the creature responds.*`,
				footer: { text: 'To continue setting up your profile, type "rp species"' },
			}],
		});
	},
};
